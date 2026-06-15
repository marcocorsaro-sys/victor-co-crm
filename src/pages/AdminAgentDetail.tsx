import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useOperations } from '../hooks/useOperations'
import { useProfiles } from '../hooks/useProfiles'
import { useBudgets } from '../hooks/useBudgets'
import { formatEur, formatDate, formatDateTime, estimatePipelineCommission, getPipelineWeight, PIPELINE_FORMULAS } from '../lib/calculations'
import { exportCsv } from '../lib/exportCsv'
import KpiCard from '../components/KpiCard'
import OperationDetailModal from '../components/OperationDetailModal'
import OperationsTotalsFooter from '../components/OperationsTotalsFooter'
import FormulaTip from '../components/FormulaTip'
import DateRangePicker from '../components/DateRangePicker'
import type { OperationWithAgent } from '../lib/supabase'

export default function AdminAgentDetail() {
  const { agentId } = useParams<{ agentId: string }>()
  const navigate = useNavigate()
  const { operations, loading: opsLoading } = useOperations()
  const { agents, loading: profilesLoading } = useProfiles()
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const { allocations } = useBudgets(selectedYear)
  const [detailOp, setDetailOp] = useState<OperationWithAgent | null>(null)

  // ── Filtri tabella immobili ──
  const [search, setSearch] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fType, setFType] = useState('')
  const [fOrigin, setFOrigin] = useState('')
  const [fProbability, setFProbability] = useState('') // '30' | '60' | '90' | 'none' | ''
  const [fHasCollaborator, setFHasCollaborator] = useState('') // 'yes' | 'no' | ''
  const [fPublishedSite, setFPublishedSite] = useState('') // 'yes' | 'no' | ''
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [dateField, setDateField] = useState<'sale' | 'mandate' | 'added'>('sale')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const loading = opsLoading || profilesLoading
  const agent = agents.find(a => a.id === agentId)
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 3 + i)

  const agentOps = useMemo(() =>
    operations.filter(o => o.agent_id === agentId),
    [operations, agentId]
  )

  const yearStart = new Date(selectedYear, 0, 1)
  const yearEnd = new Date(selectedYear + 1, 0, 1)

  const completedYear = useMemo(() =>
    agentOps.filter(o =>
      o.status === 'incassato' && o.sale_date &&
      new Date(o.sale_date) >= yearStart && new Date(o.sale_date) < yearEnd
    ),
    [agentOps, selectedYear]
  )

  const pipelineOps = useMemo(() =>
    agentOps.filter(o => o.status === 'pipeline'),
    [agentOps]
  )

  const propostaOps = useMemo(() =>
    agentOps.filter(o => o.status === 'proposta_accettata'),
    [agentOps]
  )

  // Completed KPIs
  const totalGross = completedYear.reduce((s, o) => s + (o.gross_commission || 0), 0)
  const totalAgent = completedYear.reduce((s, o) => s + (o.agent_commission || 0), 0)
  const totalCollected = completedYear.reduce((s, o) => s + (o.commission_collected || 0), 0)
  const agencyMargin = totalGross - totalAgent
  const totalValue = completedYear.reduce((s, o) => s + (o.final_value || o.property_value || 0), 0)

  // Pipeline estimated KPIs (central helper: handles fixed-mode + collaborator share)
  const getEstimated = (op: OperationWithAgent) => estimatePipelineCommission(op, agent)

  // Combina pipeline + proposte_accettate per il pannello "Pipeline Stime"
  // (proposte accettate hanno peso fisso 100% nelle versioni pesate)
  const allInProgressOps = [...pipelineOps, ...propostaOps]
  const pipelineValue = allInProgressOps.reduce((s, o) => s + (o.property_value || 0), 0)
  const pipelineEstGross = allInProgressOps.reduce((s, o) => s + (getEstimated(o)?.grossCommission || 0), 0)
  const pipelineEstAgent = allInProgressOps.reduce((s, o) => s + (getEstimated(o)?.agentCommission || 0), 0)
  const pipelineEstAgency = allInProgressOps.reduce((s, o) => s + (getEstimated(o)?.agencyRevenue || 0), 0)
  // Weighted: null probability → 50% fallback per pipeline; proposte accettate → 100%
  const weightFor = (op: OperationWithAgent) => op.status === 'proposta_accettata' ? 1 : getPipelineWeight(op)
  const pipelineWeightedGross = allInProgressOps.reduce((s, o) => {
    const est = getEstimated(o)
    return s + (est ? est.grossCommission * weightFor(o) : 0)
  }, 0)
  const pipelineWeightedAgent = allInProgressOps.reduce((s, o) => {
    const est = getEstimated(o)
    return s + (est ? est.agentCommission * weightFor(o) : 0)
  }, 0)
  const pipelineWeightedAgency = allInProgressOps.reduce((s, o) => {
    const est = getEstimated(o)
    return s + (est ? est.agencyRevenue * weightFor(o) : 0)
  }, 0)

  // Closing rate (year-based: closed in year / (closed + pipeline))
  const closingRate = (completedYear.length + pipelineOps.length) > 0
    ? (completedYear.length / (completedYear.length + pipelineOps.length) * 100) : 0

  // Budget
  const agentAllocation = allocations.find(a => a.agent_id === agentId)
  const budgetTarget = agentAllocation?.allocated_target || 0
  const budgetPct = budgetTarget > 0 ? (totalGross / budgetTarget * 100) : 0

  // Monthly breakdown for selected year
  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i,
      label: new Date(selectedYear, i).toLocaleDateString('it-IT', { month: 'short' }),
      closed: 0,
      grossComm: 0,
      agentComm: 0,
      value: 0,
    }))
    completedYear.forEach(op => {
      const m = new Date(op.sale_date!).getMonth()
      months[m].closed++
      months[m].grossComm += op.gross_commission || 0
      months[m].agentComm += op.agent_commission || 0
      months[m].value += op.final_value || op.property_value || 0
    })
    return months
  }, [completedYear, selectedYear])

  // ── Filter operations for display ──
  const displayOps = useMemo(() => {
    return agentOps.filter(o => {
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
  }, [agentOps, search, fStatus, fType, fOrigin, fProbability, fHasCollaborator, fPublishedSite, dateFrom, dateTo, dateField])

  // Totals on the filtered set (handy for the user)
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
    })
    return { value, gross, agentComm, collected, collaboratorComm, estGross, estAgent, weightedGross, weightedAgent, propostaGross, propostaAgent, closed, pipelineCount, propostaCount }
  }, [displayOps, agent])

  const hasFilters = !!(search || fStatus || fType || fOrigin || fProbability || fHasCollaborator || fPublishedSite || dateFrom || dateTo)
  const resetFilters = () => {
    setSearch(''); setFStatus(''); setFType(''); setFOrigin(''); setFProbability('')
    setFHasCollaborator(''); setFPublishedSite(''); setDateFrom(''); setDateTo('')
  }

  // CSV export of filtered set with all relevant columns
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
    const slug = (agent?.full_name || agentId || 'agente').toLowerCase().replace(/\s+/g, '-')
    exportCsv(headers, rows, `victorco-${slug}-${new Date().toISOString().split('T')[0]}.csv`)
  }

  if (!loading && !agent) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: 'var(--g)' }}>Agente non trovato</p>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>Torna indietro</button>
      </div>
    )
  }

  const mono = { fontFamily: "'JetBrains Mono', monospace" }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>← Indietro</button>
          {agent && (
            <>
              <div className="avatar" style={{ backgroundColor: agent.color, width: 48, height: 48, fontSize: 16 }}>
                {agent.initials}
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--w)' }}>{agent.full_name}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                  <span className={`badge badge-${agent.role === 'admin' ? 'agenzia' : 'agente'}`}>{agent.role}</span>
                  {agent.phone && (
                    <a href={`tel:${agent.phone}`} style={{ fontSize: 12, color: 'var(--teal)', textDecoration: 'none' }}>{agent.phone}</a>
                  )}
                  {agent.display_email && (
                    <a href={`mailto:${agent.display_email}`} style={{ fontSize: 12, color: 'var(--teal)', textDecoration: 'none' }}>{agent.display_email}</a>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        <select className="filter-select" value={selectedYear}
          onChange={e => setSelectedYear(Number(e.target.value))} style={{ width: 100 }}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <KpiCard value={completedYear.length.toString()} label={`Chiuse ${selectedYear}`} loading={loading}
          onClick={() => setFStatus(fStatus === 'incassato' ? '' : 'incassato')} />
        <KpiCard value={pipelineOps.length.toString()} label="Pipeline" loading={loading} color="amber"
          onClick={() => setFStatus(fStatus === 'pipeline' ? '' : 'pipeline')} />
        <KpiCard value={formatEur(totalGross)} label="Comm. Lorde" loading={loading} />
        <KpiCard value={formatEur(totalAgent)} label="Provvigioni Agente" loading={loading} color="teal" />
        <KpiCard value={formatEur(agencyMargin)} label="Margine Agenzia" loading={loading} color="green" />
        <KpiCard value={`${closingRate.toFixed(0)}%`} label="% Chiusura" loading={loading} />
      </div>

      {/* Budget + Pipeline side by side */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          {/* Budget */}
          <div style={{ background: 'var(--s1)', borderRadius: 12, padding: 16, border: '1px solid var(--bd)' }}>
            <div style={{ ...mono, fontSize: 11, color: 'var(--ld)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
              // Budget {selectedYear}
            </div>
            {budgetTarget > 0 ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                  <span style={{ color: 'var(--g)' }}>Obiettivo</span>
                  <span style={{ ...mono, color: 'var(--w)' }}>{formatEur(budgetTarget)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                  <span style={{ color: 'var(--g)' }}>Raggiunto</span>
                  <span style={{ ...mono, color: budgetPct >= 100 ? 'var(--green)' : 'var(--lime)' }}>{formatEur(totalGross)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                  <span style={{ color: 'var(--g)' }}>Avanzamento</span>
                  <span style={{ ...mono, fontWeight: 600, color: budgetPct >= 100 ? 'var(--green)' : 'var(--w)' }}>{budgetPct.toFixed(0)}%</span>
                </div>
                <div className="progress-bar" style={{ height: 6 }}>
                  <div className="progress-bar-fill" style={{
                    width: `${Math.min(budgetPct, 100)}%`,
                    backgroundColor: budgetPct >= 100 ? 'var(--green)' : agent?.color || 'var(--lime)',
                  }} />
                </div>
                {budgetTarget - totalGross > 0 && (
                  <div style={{ ...mono, fontSize: 11, color: 'var(--g)', marginTop: 6 }}>
                    Mancano {formatEur(budgetTarget - totalGross)}
                  </div>
                )}
              </>
            ) : (
              <p style={{ color: 'var(--g)', fontSize: 13 }}>Nessun budget allocato per {selectedYear}</p>
            )}
          </div>

          {/* Pipeline Stimate */}
          <div style={{ background: 'var(--s1)', borderRadius: 12, padding: 16, border: '1px solid var(--bd)' }}>
            <div style={{ ...mono, fontSize: 11, color: 'var(--ld)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12, display: 'flex', alignItems: 'center' }}>
              <span>// Pipeline Stime</span>
              <FormulaTip title="Pipeline Stime"
                formula={<>
                  <div><b>Comm. lorde stimate</b>: {PIPELINE_FORMULAS.pipelineGross}</div>
                  <div style={{ marginTop: 4 }}><b>Quota agente</b>: {PIPELINE_FORMULAS.agentShare}</div>
                  <div style={{ marginTop: 4 }}><b>Margine agenzia</b>: {PIPELINE_FORMULAS.agencyMargin}</div>
                </>}
                note="Include modalità fissa/% e quote collaboratori." />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
              <div>
                <div style={{ color: 'var(--g)', marginBottom: 2 }}>Valore immobili</div>
                <div style={{ ...mono, color: 'var(--w)', fontWeight: 600 }}>{formatEur(pipelineValue)}</div>
              </div>
              <div>
                <div style={{ color: 'var(--g)', marginBottom: 2 }}>Comm. lorde stimate</div>
                <div style={{ ...mono, color: 'var(--amber)', fontWeight: 600 }}>{formatEur(pipelineEstGross)}</div>
              </div>
              <div>
                <div style={{ color: 'var(--g)', marginBottom: 2 }}>Quota agente stimata</div>
                <div style={{ ...mono, color: 'var(--teal)', fontWeight: 600 }}>{formatEur(pipelineEstAgent)}</div>
              </div>
              <div>
                <div style={{ color: 'var(--g)', marginBottom: 2 }}>Margine agenzia stimato</div>
                <div style={{ ...mono, color: 'var(--green)', fontWeight: 600 }}>{formatEur(pipelineEstAgency)}</div>
              </div>
            </div>
            {pipelineWeightedGross !== pipelineEstGross && (
              <div style={{ borderTop: '1px solid var(--bd)', marginTop: 10, paddingTop: 8 }}>
                <div style={{ fontSize: 10, color: 'var(--g)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.3px', display: 'inline-flex', alignItems: 'center' }}>
                  <span>Pesato per probabilità</span>
                  <FormulaTip title="Pipeline pesata per probabilità"
                    formula={PIPELINE_FORMULAS.pipelineWeighted}
                    note={PIPELINE_FORMULAS.weight} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 12 }}>
                  <div>
                    <div style={{ color: 'var(--g)', marginBottom: 2 }}>Comm. lorde</div>
                    <div style={{ ...mono, color: 'var(--amber)', fontWeight: 600 }}>{formatEur(pipelineWeightedGross)}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--g)', marginBottom: 2 }}>Quota agente</div>
                    <div style={{ ...mono, color: 'var(--teal)', fontWeight: 600 }}>{formatEur(pipelineWeightedAgent)}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--g)', marginBottom: 2 }}>Margine agenzia</div>
                    <div style={{ ...mono, color: 'var(--green)', fontWeight: 600 }}>{formatEur(pipelineWeightedAgency)}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Commission rates */}
      {!loading && agent && (
        <div style={{ background: 'var(--s1)', borderRadius: 12, padding: 16, border: '1px solid var(--bd)', marginBottom: 20 }}>
          <div style={{ ...mono, fontSize: 11, color: 'var(--ld)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
            // Aliquote & Info Contratto
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--bd)' }}>
              <span style={{ color: 'var(--g)' }}>% su ops agenzia</span>
              <span style={{ ...mono, color: 'var(--w)' }}>{agent.comm_pct_agency}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--bd)' }}>
              <span style={{ color: 'var(--g)' }}>% su ops agente</span>
              <span style={{ ...mono, color: 'var(--w)' }}>{agent.comm_pct_agent}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--bd)' }}>
              <span style={{ color: 'var(--g)' }}>Tipo contratto</span>
              <span style={{ color: 'var(--w)' }}>{agent.contract_type || '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--bd)' }}>
              <span style={{ color: 'var(--g)' }}>Data inizio</span>
              <span style={{ color: 'var(--w)' }}>{agent.contract_start_date ? formatDate(agent.contract_start_date) : '—'}</span>
            </div>
            {totalCollected > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--bd)' }}>
                <span style={{ color: 'var(--g)' }}>Provvigioni incassate</span>
                <span style={{ ...mono, color: 'var(--green)' }}>{formatEur(totalCollected)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Monthly breakdown */}
      {!loading && (
        <div style={{ background: 'var(--s1)', borderRadius: 12, padding: 16, border: '1px solid var(--bd)', marginBottom: 20 }}>
          <div style={{ ...mono, fontSize: 11, color: 'var(--ld)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
            // Andamento Mensile {selectedYear}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mese</th><th>Chiuse</th><th>Valore</th><th>Comm. Lorde</th><th>Provvigioni Agente</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map(m => (
                  <tr key={m.month} style={m.closed === 0 ? { opacity: 0.4 } : {}}>
                    <td style={{ textTransform: 'capitalize' }}>{m.label}</td>
                    <td>{m.closed}</td>
                    <td style={mono}>{m.value > 0 ? formatEur(m.value) : '—'}</td>
                    <td style={mono}>{m.grossComm > 0 ? formatEur(m.grossComm) : '—'}</td>
                    <td style={{ ...mono, color: 'var(--teal)' }}>{m.agentComm > 0 ? formatEur(m.agentComm) : '—'}</td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td>Totale</td>
                  <td>{completedYear.length}</td>
                  <td style={mono}>{formatEur(totalValue)}</td>
                  <td style={mono}>{formatEur(totalGross)}</td>
                  <td style={{ ...mono, color: 'var(--teal)' }}>{formatEur(totalAgent)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Operations list with rich filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div className="section-heading" style={{ margin: 0 }}>
          Immobili {hasFilters && <span style={{ fontSize: 12, color: 'var(--g)', fontWeight: 400 }}>({displayOps.length} di {agentOps.length})</span>}
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

      {/* Filtered totals row */}
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

      <div className="table-wrap">
        <table style={{ minWidth: 1600 }}>
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
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={22}><div className="skeleton skeleton-row" /></td></tr>
            ) : displayOps.length === 0 ? (
              <tr><td colSpan={22} style={{ textAlign: 'center', color: 'var(--g)', padding: 24 }}>Nessuna operazione</td></tr>
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
                          background: op.sale_probability <= 30 ? 'rgba(239,68,68,0.15)' : op.sale_probability <= 60 ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)',
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
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(34,197,94,0.15)', color: 'var(--green)', fontWeight: 600 }}>SÌ</span>
                      ) : (
                        <span style={{ fontSize: 10, color: 'var(--g)' }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--gl)', maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      title={op.notes || ''}>
                      {op.notes ? op.notes.slice(0, 60) + (op.notes.length > 60 ? '…' : '') : '—'}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {!loading && agent && (
        <OperationsTotalsFooter
          operations={displayOps}
          resolveAgent={() => agent}
          yearLabel={selectedYear}
          completedYearFilter={selectedYear}
        />
      )}

      <OperationDetailModal
        open={!!detailOp}
        operation={detailOp}
        onClose={() => setDetailOp(null)}
        onEdit={() => setDetailOp(null)}
        isAdmin
      />
    </div>
  )
}
