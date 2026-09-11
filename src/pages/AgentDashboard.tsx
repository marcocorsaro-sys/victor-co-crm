import { Link } from 'react-router-dom'
import { useState, useMemo } from 'react'
import type { Profile, Operation } from '../lib/supabase'
import { useOperations } from '../hooks/useOperations'
import { useCollaboratedOperations } from '../hooks/useCollaboratedOperations'
import { useAgentsDirectory } from '../hooks/useAgentsDirectory'
import { formatEur, formatDate, formatDateTime, estimatePipelineCommission, getPipelineWeight, PIPELINE_FORMULAS } from '../lib/calculations'
import { exportCsv } from '../lib/exportCsv'
import KpiCard from '../components/KpiCard'
import OpModal from '../components/OpModal'
import CloseModal from '../components/CloseModal'
import OperationDetailModal from '../components/OperationDetailModal'
import OperationsTotalsFooter from '../components/OperationsTotalsFooter'
import ToastContainer from '../components/ToastContainer'
import FormulaTip from '../components/FormulaTip'
import DateRangePicker from '../components/DateRangePicker'
import { useToast } from '../hooks/useToast'

type Props = {
  profile: Profile
}

export default function AgentDashboard({ profile }: Props) {
  const { operations, loading, addOperation, updateOperation, deleteOperation } = useOperations(profile.id)
  const { operations: collaboratedOps, loading: collabLoading } = useCollaboratedOperations(profile.id)
  const { agents } = useAgentsDirectory()
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 3 + i)

  const [showOpModal, setShowOpModal] = useState(false)
  const [editingOp, setEditingOp] = useState<Operation | null>(null)
  const [closingOp, setClosingOp] = useState<Operation | null>(null)
  const [detailOp, setDetailOp] = useState<Operation | null>(null)
  const { toasts, addToast } = useToast()

  // ── Filtri tabella immobili ──
  const [search, setSearch] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fType, setFType] = useState('')
  const [fOrigin, setFOrigin] = useState('')
  const [fProbability, setFProbability] = useState('')
  const [fHasCollaborator, setFHasCollaborator] = useState('')
  const [fPublishedSite, setFPublishedSite] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [dateField, setDateField] = useState<'sale' | 'mandate' | 'added'>('sale')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const pipeline = operations.filter(o => o.status === 'pipeline')
  const completed = operations.filter(o => o.status === 'incassato')
  const proposte = operations.filter(o => o.status === 'proposta_accettata')
  const yearStart = new Date(selectedYear, 0, 1)
  const yearEnd = new Date(selectedYear + 1, 0, 1)
  const completedYear = completed.filter(o =>
    o.sale_date && new Date(o.sale_date) >= yearStart && new Date(o.sale_date) < yearEnd
  )
  const totalCommissions = completedYear.reduce((s, o) => s + (o.agent_commission || 0), 0)
  const pipelineValue = pipeline.reduce((s, o) => s + (o.property_value || 0), 0)

  // Expected agent commissions from pipeline (includes fixed-mode + collaborator)
  const pipelineExpectedAgent = pipeline.reduce((s, op) => {
    const r = estimatePipelineCommission(op, profile)
    return s + (r?.agentCommission || 0)
  }, 0)

  // Weighted by sale_probability (null → 50% fallback)
  const pipelineWeightedAgent = pipeline.reduce((s, op) => {
    const r = estimatePipelineCommission(op, profile)
    return s + (r ? r.agentCommission * getPipelineWeight(op) : 0)
  }, 0)

  // Proposta accettata: peso 100% (certa)
  const propostaExpectedAgent = proposte.reduce((s, op) => {
    const r = estimatePipelineCommission(op, profile)
    return s + (r?.agentCommission || 0)
  }, 0)

  const estimatedTotalYear = totalCommissions + propostaExpectedAgent + pipelineExpectedAgent
  const estimatedWeightedYear = totalCommissions + propostaExpectedAgent + pipelineWeightedAgent

  const getEstimated = (op: Operation) => estimatePipelineCommission(op, profile)

  // ── Filter operations ──
  const displayOps = useMemo(() => {
    return operations.filter(o => {
      if (search) {
        const q = search.toLowerCase()
        const hay = [
          o.property_name, o.address, o.buyer_name, o.collaborator_name,
          o.buyer_first_name, o.buyer_last_name,
          o.collaborator_first_name, o.collaborator_last_name,
          o.notes,
        ].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (fStatus && o.status !== fStatus) return false
      if (fType && o.type !== fType) return false
      if (fOrigin && o.origin !== fOrigin) return false
      if (fProbability) {
        if (fProbability === 'none' && o.sale_probability != null) return false
        if (fProbability !== 'none' && String(o.sale_probability) !== fProbability) return false
      }
      if (fHasCollaborator) {
        const hasCollab = !!(o.collaborator_id || o.collaborator_name || o.collaborator_first_name)
        if (fHasCollaborator === 'yes' && !hasCollab) return false
        if (fHasCollaborator === 'no' && hasCollab) return false
      }
      if (fPublishedSite) {
        if (fPublishedSite === 'yes' && !o.publish_to_website) return false
        if (fPublishedSite === 'no' && o.publish_to_website) return false
      }
      if (dateFrom || dateTo) {
        let dateStr: string | null = null
        if (dateField === 'sale') dateStr = o.sale_date
        else if (dateField === 'mandate') dateStr = o.mandate_start_date
        else dateStr = o.date_added.split('T')[0]
        if (!dateStr) return false
        if (dateFrom && dateStr < dateFrom) return false
        if (dateTo && dateStr > dateTo) return false
      }
      return true
    })
  }, [operations, search, fStatus, fType, fOrigin, fProbability, fHasCollaborator, fPublishedSite, dateFrom, dateTo, dateField])

  // Totals on filtered
  const filteredTotals = useMemo(() => {
    let value = 0, gross = 0, agentComm = 0, collected = 0, collaboratorComm = 0
    let estGross = 0, estAgent = 0, weightedGross = 0, weightedAgent = 0
    let propostaGross = 0, propostaAgent = 0
    let closed = 0, pipelineCount = 0, propostaCount = 0
    displayOps.forEach(o => {
      value += o.final_value || o.property_value || 0
      gross += o.gross_commission || 0
      agentComm += o.agent_commission || 0
      collected += o.commission_collected || 0
      collaboratorComm += o.collaborator_commission || 0
      if (o.status === 'incassato') closed++
      else if (o.status === 'pipeline') {
        pipelineCount++
        const est = getEstimated(o)
        if (est) {
          estGross += est.grossCommission
          estAgent += est.agentCommission
          const w = getPipelineWeight(o)
          weightedGross += est.grossCommission * w
          weightedAgent += est.agentCommission * w
        }
      } else if (o.status === 'proposta_accettata') {
        propostaCount++
        const est = getEstimated(o)
        if (est) {
          propostaGross += est.grossCommission
          propostaAgent += est.agentCommission
        }
      }
      // 'terminato' escluso dai totali
    })
    return { value, gross, agentComm, collected, collaboratorComm, estGross, estAgent, weightedGross, weightedAgent, propostaGross, propostaAgent, closed, pipelineCount, propostaCount }
  }, [displayOps, profile])

  const hasFilters = !!(search || fStatus || fType || fOrigin || fProbability || fHasCollaborator || fPublishedSite || dateFrom || dateTo)
  const resetFilters = () => {
    setSearch(''); setFStatus(''); setFType(''); setFOrigin(''); setFProbability('')
    setFHasCollaborator(''); setFPublishedSite(''); setDateFrom(''); setDateTo('')
  }

  // CSV export
  const handleExport = () => {
    const headers = [
      'Immobile', 'Indirizzo', 'Tipo', 'Origine', 'Stato', 'Probabilità',
      'Acquirente', 'Collaboratore', '% Coll.',
      'Modalità venditore', '% / Fisso venditore',
      'Modalità acquirente', '% / Fisso acquirente',
      'Valore', 'Valore finale',
      'Comm. Lorda', 'Quota Agente', 'Quota Coll.', 'Margine Agenzia',
      'Comm. Lorda Stimata', 'Quota Agente Stimata',
      'Comm. Incassata', 'Data Incasso',
      'Inizio Incarico', 'Fine Incarico', 'Data Vendita', 'Inserito il',
      'Pubblicato sul sito', 'Note',
    ]
    const rows = displayOps.map(o => {
      const est = o.status === 'pipeline' ? getEstimated(o) : null
      const collabName = [o.collaborator_first_name, o.collaborator_last_name].filter(Boolean).join(' ') || o.collaborator_name || ''
      const buyerN = [o.buyer_first_name, o.buyer_last_name].filter(Boolean).join(' ') || o.buyer_name || ''
      const sellerVal = o.comm_mode_seller === 'fixed' ? `${(o.comm_fixed_seller || 0).toFixed(2)}` : `${o.comm_pct_seller}%`
      const buyerVal = o.comm_mode_buyer === 'fixed' ? `${(o.comm_fixed_buyer || 0).toFixed(2)}` : `${o.comm_pct_buyer}%`
      const margin = o.gross_commission != null && o.agent_commission != null
        ? (o.gross_commission - o.agent_commission - (o.collaborator_commission || 0)).toFixed(2)
        : ''
      return [
        o.property_name, o.address || '', o.type, o.origin, o.status,
        o.sale_probability ? `${o.sale_probability}%` : '',
        buyerN, collabName, o.collaborator_comm_pct ? `${o.collaborator_comm_pct}%` : '',
        o.comm_mode_seller || 'pct', sellerVal,
        o.comm_mode_buyer || 'pct', buyerVal,
        (o.property_value || 0).toFixed(2), (o.final_value || 0).toFixed(2),
        (o.gross_commission || 0).toFixed(2), (o.agent_commission || 0).toFixed(2),
        (o.collaborator_commission || 0).toFixed(2), margin,
        est ? est.grossCommission.toFixed(2) : '', est ? est.agentCommission.toFixed(2) : '',
        (o.commission_collected || 0).toFixed(2), o.collection_date || '',
        o.mandate_start_date || '', o.mandate_end_date || '',
        o.sale_date || '', formatDateTime(o.date_added),
        o.publish_to_website ? 'Sì' : 'No',
        (o.notes || '').replace(/\r?\n/g, ' '),
      ]
    })
    const slug = (profile.full_name || 'agente').toLowerCase().replace(/\s+/g, '-')
    exportCsv(headers, rows, `victorco-${slug}-${new Date().toISOString().split('T')[0]}.csv`)
  }

  const handleAddOp = async (data: Partial<Operation>) => {
    const { error } = await addOperation(data)
    if (error) addToast('Errore nel salvataggio', 'error')
    else { addToast('Operazione aggiunta', 'success'); setShowOpModal(false) }
  }

  const handleEditOp = async (data: Partial<Operation>) => {
    if (!editingOp) return
    const { error } = await updateOperation(editingOp.id, data)
    if (error) addToast('Errore nella modifica', 'error')
    else { addToast('Operazione modificata', 'success'); setEditingOp(null); setShowOpModal(false) }
  }

  const handleCloseOp = async (data: Partial<Operation>) => {
    if (!closingOp) return
    const { error } = await updateOperation(closingOp.id, data)
    if (error) addToast('Errore nella chiusura', 'error')
    else { addToast('Operazione chiusa con successo', 'success'); setClosingOp(null) }
  }

  const handleDeleteOp = async (id: string) => {
    if (!confirm('Eliminare questa operazione?')) return
    const { error } = await deleteOperation(id)
    if (error) addToast("Errore nell'eliminazione", 'error')
    else addToast('Operazione eliminata', 'success')
  }

  const mono = { fontFamily: "'Montserrat', sans-serif" }

  return (
    <div>
      <ToastContainer toasts={toasts} />

      <VademecumBanner />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="section-heading" style={{ margin: 0 }}>Le mie operazioni</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="filter-select" value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))} style={{ width: 100 }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => { setEditingOp(null); setShowOpModal(true) }}>
            + Nuova Operazione
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard value={pipeline.length.toString()} label="In Pipeline" loading={loading}
          onClick={() => setFStatus(fStatus === 'pipeline' ? '' : 'pipeline')} />
        <KpiCard value={completedYear.length.toString()} label={`Chiuse ${selectedYear}`} loading={loading} color="green"
          onClick={() => setFStatus(fStatus === 'incassato' ? '' : 'incassato')} />
        <KpiCard value={formatEur(totalCommissions)} label="Provvigioni maturate" loading={loading} color="teal"
          legend={<FormulaTip title="Provvigioni maturate" formula={`Somma delle quote agente delle operazioni chiuse nel ${selectedYear}`} />} />
        <KpiCard value={formatEur(pipelineValue)} label="Valore pipeline" loading={loading} color="amber"
          legend={<FormulaTip title="Valore pipeline" formula="Somma del property_value di tutte le operazioni in pipeline" />} />
        <KpiCard value={formatEur(pipelineExpectedAgent)} label="Comm. stimate pipeline" loading={loading} color="amber"
          legend={<FormulaTip title="Comm. stimate pipeline (quota agente)"
            formula="Σ quota_agente(op) per ogni operazione in pipeline, senza pesi"
            note="Include modalità fissa/% e quote collaboratori." />} />
        <KpiCard value={formatEur(pipelineWeightedAgent)} label="Comm. pesate prob." loading={loading} color="teal"
          legend={<FormulaTip title="Comm. pipeline pesate (quota agente)"
            formula={PIPELINE_FORMULAS.pipelineWeighted.replace('Comm. lorda', 'Quota agente')}
            note={PIPELINE_FORMULAS.weight} />} />
        <KpiCard value={formatEur(estimatedTotalYear)} label={`Stima Tot. ${selectedYear}`} loading={loading} color="green"
          legend={<FormulaTip title={`Stima Tot. ${selectedYear} (quota agente)`}
            formula={`Provvigioni maturate ${selectedYear} + Comm. stimate pipeline (quota agente)`}
            note="Scenario ottimistico: tutta la pipeline chiude." />} />
        <KpiCard value={formatEur(estimatedWeightedYear)} label={`Stima Pesata ${selectedYear}`} loading={loading} color="teal"
          legend={<FormulaTip title={`Stima Pesata ${selectedYear} (quota agente)`}
            formula={`Provvigioni maturate ${selectedYear} + Comm. pipeline pesate`}
            note="Scenario realistico ponderato per probabilità di vendita." />} />
      </div>

      {/* ── Le mie collaborazioni ── */}
      {!collabLoading && collaboratedOps.length > 0 && (
        <div style={{ marginTop: 20, marginBottom: 20, padding: 16, background: 'var(--s1)', borderRadius: 12, border: '1px solid var(--bd)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ ...mono, fontSize: 11, color: 'var(--ld)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              📎 Le mie collaborazioni ({collaboratedOps.length})
            </div>
            <FormulaTip title="Le mie collaborazioni"
              formula="Operazioni in cui sei collaboratore interno (non principale). La tua quota viene scalata dalla quota dell'agente principale."
              note="Visibili in lettura grazie alla policy 'agent_collaborator_read'." />
          </div>
          <div className="table-wrap">
            <table style={{ minWidth: 800 }}>
              <thead>
                <tr>
                  <th>Immobile</th>
                  <th>Agente principale</th>
                  <th>Stato</th>
                  <th>Valore</th>
                  <th>% Coll.</th>
                  <th>Quota Coll. (stim.)</th>
                </tr>
              </thead>
              <tbody>
                {collaboratedOps.map(op => {
                  const principalAgent = (op.profiles as Profile | undefined) || agents.find(a => a.id === op.agent_id)
                  // Stima quota collaboratore: usa profilo agente principale per calcolare comm. lorda + scalare
                  const r = principalAgent ? estimatePipelineCommission(op, principalAgent) : null
                  // Quota collaboratore = quota agente principale (lorda) × pct collaborator
                  const quotaCollab = r && op.collaborator_comm_pct
                    ? (r.grossCommission * ((principalAgent!.comm_pct_agent || 50) / 100)) * (op.collaborator_comm_pct / 100)
                    : op.collaborator_commission || 0
                  return (
                    <tr key={op.id}>
                      <td>
                        <div className="clickable-cell" style={{ fontWeight: 600 }} onClick={() => setDetailOp(op)}>
                          {op.property_name}
                        </div>
                        {op.address && <div style={{ fontSize: 11, color: 'var(--g)' }}>{op.address}</div>}
                      </td>
                      <td>
                        {principalAgent && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div className="avatar" style={{ backgroundColor: principalAgent.color, width: 22, height: 22, fontSize: 9 }}>
                              {principalAgent.initials}
                            </div>
                            <span>{principalAgent.full_name}</span>
                          </div>
                        )}
                      </td>
                      <td><span className={`badge badge-${op.status}`}>{op.status.replace('_', ' ')}</span></td>
                      <td style={mono}>{formatEur(op.final_value || op.property_value || 0)}</td>
                      <td style={mono}>{op.collaborator_comm_pct ? `${op.collaborator_comm_pct}%` : '—'}</td>
                      <td style={{ ...mono, color: 'var(--teal)', fontWeight: 600 }}>
                        {op.status === 'incassato' && op.collaborator_commission
                          ? formatEur(op.collaborator_commission)
                          : quotaCollab > 0 ? `~${formatEur(quotaCollab)}` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 10, color: 'var(--g)', marginTop: 8, marginBottom: 0 }}>
            * Le quote stimate (in <i>corsivo con ~</i>) si basano sui valori e probabilità dell'operazione.
            La quota effettiva sarà disponibile alla chiusura.
          </p>
        </div>
      )}

      {/* Filtri */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 8 }}>
        <div className="section-heading" style={{ margin: 0 }}>
          Immobili {hasFilters && <span style={{ fontSize: 12, color: 'var(--g)', fontWeight: 400 }}>({displayOps.length} di {operations.length})</span>}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleExport}>Export CSV</button>
      </div>

      <div className="filters-bar">
        <input className="filter-input" placeholder="Cerca immobile, indirizzo, acquirente, collaboratore, note..."
          value={search} onChange={e => setSearch(e.target.value)} style={{ minWidth: 280, flex: 1 }} />
        <select className="filter-select" value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="">Tutti gli stati</option>
          <option value="pipeline">Pipeline</option>
          <option value="proposta_accettata">Proposta accettata</option>
              <option value="incassato">Incassato</option>
              <option value="terminato">Terminato</option>
        </select>
        <select className="filter-select" value={fType} onChange={e => setFType(e.target.value)}>
          <option value="">Tutti i tipi</option>
          <option value="vendita">Vendita</option>
          <option value="locazione">Locazione</option>
        </select>
        <select className="filter-select" value={fOrigin} onChange={e => setFOrigin(e.target.value)}>
          <option value="">Tutte le origini</option>
          <option value="agente">Agente</option>
          <option value="agenzia">Agenzia</option>
        </select>
        <select className="filter-select" value={fProbability} onChange={e => setFProbability(e.target.value)}>
          <option value="">Tutte le prob.</option>
          <option value="30">30%</option>
          <option value="60">60%</option>
          <option value="90">90%</option>
          <option value="none">Non definita</option>
        </select>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowAdvanced(!showAdvanced)}
          style={{ whiteSpace: 'nowrap' }}>
          {showAdvanced ? '▲ Meno' : '▼ Filtri avanzati'}
        </button>
        {hasFilters && (
          <button className="btn btn-secondary btn-sm" onClick={resetFilters} style={{ color: 'var(--red)' }}>
            ✕ Reset
          </button>
        )}
      </div>

      {showAdvanced && (
        <div style={{ background: 'var(--s1)', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid var(--bd)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Collaboratore</label>
              <select className="form-select" value={fHasCollaborator} onChange={e => setFHasCollaborator(e.target.value)}>
                <option value="">Tutti</option>
                <option value="yes">Con collaboratore</option>
                <option value="no">Senza collaboratore</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Pubblicazione sito</label>
              <select className="form-select" value={fPublishedSite} onChange={e => setFPublishedSite(e.target.value)}>
                <option value="">Tutti</option>
                <option value="yes">Pubblicato</option>
                <option value="no">Non pubblicato</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Filtra date su</label>
              <select className="form-select" value={dateField} onChange={e => setDateField(e.target.value as 'sale' | 'mandate' | 'added')}>
                <option value="sale">Data vendita</option>
                <option value="mandate">Data inizio incarico</option>
                <option value="added">Data inserimento</option>
              </select>
            </div>
            <DateRangePicker from={dateFrom} to={dateTo}
              onChange={(f, t) => { setDateFrom(f); setDateTo(t) }} label="Periodo" />
          </div>
        </div>
      )}

      {/* Riga totali sui filtri */}
      {!loading && hasFilters && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 12, padding: '10px 14px', background: 'var(--s2)', borderRadius: 8, fontSize: 12 }}>
          <div>
            <div style={{ color: 'var(--g)', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>Risultati</div>
            <div style={mono}><b>{filteredTotals.closed}</b> chiuse · <b>{filteredTotals.pipelineCount}</b> pipeline</div>
          </div>
          <div>
            <div style={{ color: 'var(--g)', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>Valore tot.</div>
            <div style={mono}>{formatEur(filteredTotals.value)}</div>
          </div>
          <div>
            <div style={{ color: 'var(--g)', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>Comm. Lorda</div>
            <div style={{ ...mono, color: 'var(--amber)' }}>{formatEur(filteredTotals.gross)}</div>
          </div>
          <div>
            <div style={{ color: 'var(--g)', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>Quota Agente</div>
            <div style={{ ...mono, color: 'var(--teal)' }}>{formatEur(filteredTotals.agentComm)}</div>
          </div>
          <div>
            <div style={{ color: 'var(--g)', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>Incassato</div>
            <div style={{ ...mono, color: 'var(--green)' }}>{formatEur(filteredTotals.collected)}</div>
          </div>
          {filteredTotals.estGross > 0 && (
            <>
              <div>
                <div style={{ color: 'var(--g)', fontSize: 10, textTransform: 'uppercase', marginBottom: 2, display: 'inline-flex', alignItems: 'center' }}>
                  <span>Stima Pipeline</span>
                  <FormulaTip title="Comm. lorde stimate pipeline (filtrato)" formula={PIPELINE_FORMULAS.pipelineGross} />
                </div>
                <div style={{ ...mono, color: 'var(--amber)' }}>{formatEur(filteredTotals.estGross)}</div>
              </div>
              <div>
                <div style={{ color: 'var(--g)', fontSize: 10, textTransform: 'uppercase', marginBottom: 2, display: 'inline-flex', alignItems: 'center' }}>
                  <span>Stima Pesata</span>
                  <FormulaTip title="Pipeline pesata (filtrato)" formula={PIPELINE_FORMULAS.pipelineWeighted} note={PIPELINE_FORMULAS.weight} />
                </div>
                <div style={{ ...mono, color: 'var(--teal)' }}>{formatEur(filteredTotals.weightedGross)}</div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tabella ricca */}
      <div className="table-wrap">
        <table style={{ minWidth: 1700 }}>
          <thead>
            <tr>
              <th>Immobile</th>
              <th>Tipo</th>
              <th>Origine</th>
              <th>Stato</th>
              <th>Prob.</th>
              <th>Acquirente</th>
              <th>Collaboratore</th>
              <th>% Vend.</th>
              <th>% Acq.</th>
              <th>Valore</th>
              <th>Val. Finale</th>
              <th>Comm. Lorda</th>
              <th>Quota Agente</th>
              <th>Quota Coll.</th>
              <th>Margine Agenzia</th>
              <th>Incassato</th>
              <th>Inizio Inc.</th>
              <th>Fine Inc.</th>
              <th>Data Vendita</th>
              <th>Inserito</th>
              <th>Sito</th>
              <th>Note</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={23}><div className="skeleton skeleton-row" /></td></tr>
              ))
            ) : displayOps.length === 0 ? (
              <tr><td colSpan={23} style={{ textAlign: 'center', color: 'var(--g)', padding: 24 }}>
                {hasFilters ? 'Nessun risultato per i filtri impostati' : 'Nessuna operazione'}
              </td></tr>
            ) : (
              displayOps.map(op => {
                const est = op.status === 'pipeline' ? getEstimated(op) : null
                const buyerN = [op.buyer_first_name, op.buyer_last_name].filter(Boolean).join(' ') || op.buyer_name || ''
                const collabN = [op.collaborator_first_name, op.collaborator_last_name].filter(Boolean).join(' ') || op.collaborator_name || ''
                const sellerCell = op.comm_mode_seller === 'fixed'
                  ? <span title="Modalità fissa">{formatEur(op.comm_fixed_seller || 0)}</span>
                  : <span>{op.comm_pct_seller}%</span>
                const buyerCell = op.comm_mode_buyer === 'fixed'
                  ? <span title="Modalità fissa">{formatEur(op.comm_fixed_buyer || 0)}</span>
                  : <span>{op.comm_pct_buyer}%</span>
                const margin = op.gross_commission != null && op.agent_commission != null
                  ? op.gross_commission - op.agent_commission - (op.collaborator_commission || 0)
                  : null
                return (
                  <tr key={op.id}>
                    <td style={{ minWidth: 200 }}>
                      <div className="clickable-cell" style={{ fontWeight: 600 }} onClick={() => setDetailOp(op)}>
                        {op.property_name}
                      </div>
                      {op.address && (
                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(op.address)}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 11, color: 'var(--g)', textDecoration: 'none' }}>
                          {op.address}
                        </a>
                      )}
                    </td>
                    <td><span className={`badge badge-${op.type}`}>{op.type}</span></td>
                    <td><span className={`badge badge-${op.origin}`}>{op.origin}</span></td>
                    <td><span className={`badge badge-${op.status}`}>{op.status}</span></td>
                    <td>
                      {op.status === 'pipeline' && op.sale_probability ? (
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 6,
                          color: op.sale_probability <= 30 ? 'var(--red)' : op.sale_probability <= 60 ? 'var(--amber)' : 'var(--green)',
                          background: op.sale_probability <= 30 ? 'rgba(192,57,43,0.15)' : op.sale_probability <= 60 ? 'rgba(183,121,31,0.15)' : 'rgba(29,143,95,0.15)',
                        }}>{op.sale_probability}%</span>
                      ) : op.status === 'pipeline' ? (
                        <span style={{ fontSize: 11, color: 'var(--g)' }}>—</span>
                      ) : null}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--gl)' }}>{buyerN || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--gl)' }}>
                      {collabN ? (
                        <span>
                          {collabN}
                          {op.collaborator_comm_pct ? <span style={{ color: 'var(--g)', marginLeft: 4 }}>({op.collaborator_comm_pct}%)</span> : null}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={mono}>{sellerCell}</td>
                    <td style={mono}>{buyerCell}</td>
                    <td style={mono}>{op.property_value ? formatEur(op.property_value) : '—'}</td>
                    <td style={mono}>{op.final_value ? formatEur(op.final_value) : '—'}</td>
                    <td style={{ ...mono, color: est ? 'var(--amber)' : undefined, fontStyle: est ? 'italic' : undefined }}>
                      {op.gross_commission ? formatEur(op.gross_commission) : est ? `~${formatEur(est.grossCommission)}` : '—'}
                    </td>
                    <td style={{ ...mono, color: 'var(--teal)', fontStyle: est ? 'italic' : undefined }}>
                      {op.agent_commission ? formatEur(op.agent_commission) : est ? `~${formatEur(est.agentCommission)}` : '—'}
                    </td>
                    <td style={mono}>{op.collaborator_commission ? formatEur(op.collaborator_commission) : '—'}</td>
                    <td style={{ ...mono, color: margin != null ? 'var(--green)' : undefined }}>
                      {margin != null ? formatEur(margin) : '—'}
                    </td>
                    <td style={{ ...mono, color: op.commission_collected ? 'var(--green)' : undefined }}>
                      {op.commission_collected ? formatEur(op.commission_collected) : '—'}
                      {op.collection_date && (
                        <div style={{ fontSize: 10, color: 'var(--g)' }}>{formatDate(op.collection_date)}</div>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--gl)' }}>{op.mandate_start_date ? formatDate(op.mandate_start_date) : '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--gl)' }}>{op.mandate_end_date ? formatDate(op.mandate_end_date) : '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--gl)' }}>{op.sale_date ? formatDate(op.sale_date) : '—'}</td>
                    <td style={{ fontSize: 11, color: 'var(--g)' }}>{formatDateTime(op.date_added)}</td>
                    <td>
                      {op.publish_to_website ? (
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(29,143,95,0.15)', color: 'var(--green)', fontWeight: 600 }}>SÌ</span>
                      ) : (
                        <span style={{ fontSize: 10, color: 'var(--g)' }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--gl)', maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      title={op.notes || ''}>
                      {op.notes ? op.notes.slice(0, 60) + (op.notes.length > 60 ? '…' : '') : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {op.status === 'pipeline' && (
                          <button className="btn btn-success btn-sm" onClick={() => setClosingOp(op)} title="Chiudi">✓</button>
                        )}
                        <button className="btn btn-secondary btn-sm" onClick={() => { setEditingOp(op); setShowOpModal(true) }} title="Modifica">✎</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteOp(op.id)} title="Elimina">✕</button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {!loading && (
        <OperationsTotalsFooter
          operations={displayOps}
          resolveAgent={() => profile}
          yearLabel={selectedYear}
          completedYearFilter={selectedYear}
        />
      )}

      <OpModal
        open={showOpModal}
        onClose={() => { setShowOpModal(false); setEditingOp(null) }}
        onSave={editingOp ? handleEditOp : handleAddOp}
        initial={editingOp}
        agentId={profile.id}
        agentProfile={profile}
        agents={agents}
      />

      <CloseModal
        open={!!closingOp}
        onClose={() => setClosingOp(null)}
        onConfirm={handleCloseOp}
        operation={closingOp}
        agentProfile={profile}
      />

      <OperationDetailModal
        open={!!detailOp}
        operation={detailOp}
        onClose={() => setDetailOp(null)}
        onEdit={(op) => { setDetailOp(null); setEditingOp(op); setShowOpModal(true) }}
        onCloseOp={(op) => { setDetailOp(null); setClosingOp(op) }}
        onChangeStatus={async (op, newStatus) => {
          const { error } = await updateOperation(op.id, { status: newStatus })
          if (error) addToast('Errore nel cambio stato', 'error')
          else { addToast(`Stato → ${newStatus.replace('_', ' ')}`, 'success'); setDetailOp(null) }
        }}
      />
    </div>
  )
}

function VademecumBanner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', background: 'var(--navy)', color: '#fff', borderRadius: 10, padding: '12px 18px', marginBottom: 20 }}>
      <div>
        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: '#b9ccd6' }}>Nuovo · uso interno</div>
        <div style={{ fontWeight: 600 }}>Vademecum Reels & Open House — v1 · come comunicare da intermediari, sempre</div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Link to="/vademecum" className="btn btn-sm" style={{ background: '#fff', color: 'var(--navy)', border: 'none' }}>Apri</Link>
        <a href="/docs/vademecum-reels-v1.pdf" download="VictorCo_Vademecum_Reels_OpenHouse_v1.pdf" className="btn btn-sm" style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.5)' }}>Scarica PDF</a>
      </div>
    </div>
  )
}
