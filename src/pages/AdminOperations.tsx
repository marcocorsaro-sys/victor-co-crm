import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Operation, OperationWithAgent, Profile } from '../lib/supabase'
import { useOperations } from '../hooks/useOperations'
import { useProfiles } from '../hooks/useProfiles'
import { formatEur, formatDate, formatDateTime, estimatePipelineCommission, getPipelineWeight, PIPELINE_FORMULAS } from '../lib/calculations'
import FormulaTip from '../components/FormulaTip'
import { exportCsv } from '../lib/exportCsv'
import OpModal from '../components/OpModal'
import CloseModal from '../components/CloseModal'
import OperationDetailModal from '../components/OperationDetailModal'
import OperationsTotalsFooter from '../components/OperationsTotalsFooter'
import AgentProfileModal from '../components/AgentProfileModal'
import ToastContainer from '../components/ToastContainer'
import { useToast } from '../hooks/useToast'
import DateRangePicker from '../components/DateRangePicker'

const PAGE_SIZE = 20

export default function AdminOperations() {
  const navigate = useNavigate()
  const { operations, loading, addOperation, updateOperation, deleteOperation } = useOperations()
  const { agents } = useProfiles()
  const { toasts, addToast } = useToast()

  const [search, setSearch] = useState('')
  const [fAgent, setFAgent] = useState('')
  const [fType, setFType] = useState('')
  const [fOrigin, setFOrigin] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [page, setPage] = useState(0)

  const [editingOp, setEditingOp] = useState<Operation | null>(null)
  const [closingOp, setClosingOp] = useState<Operation | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [detailOp, setDetailOp] = useState<OperationWithAgent | null>(null)
  const [detailAgent, setDetailAgent] = useState<Profile | null>(null)

  const filtered = useMemo(() => {
    return operations.filter(o => {
      if (search) {
        const q = search.toLowerCase()
        const buyersText = (o.buyers || []).map(b => `${b.first_name} ${b.last_name}`).join(' ').toLowerCase()
        const sellersText = (o.sellers || []).map(s => `${s.first_name} ${s.last_name}`).join(' ').toLowerCase()
        const match = o.property_name.toLowerCase().includes(q) ||
          (o.address || '').toLowerCase().includes(q) ||
          (o.buyer_name || '').toLowerCase().includes(q) ||
          buyersText.includes(q) ||
          sellersText.includes(q) ||
          (o.profiles?.full_name || '').toLowerCase().includes(q)
        if (!match) return false
      }
      if (fAgent && o.agent_id !== fAgent) return false
      if (fType && o.type !== fType) return false
      if (fOrigin && o.origin !== fOrigin) return false
      if (fStatus && o.status !== fStatus) return false
      if (dateFrom || dateTo) {
        // Filtro range date applicato solo alle completate (sale_date).
        // Le pipeline restano sempre visibili (sono "current").
        if (o.status === 'incassato') {
          if (!o.sale_date) return false
          const d = o.sale_date.split('T')[0]
          if (dateFrom && d < dateFrom) return false
          if (dateTo && d > dateTo) return false
        }
      }
      return true
    })
  }, [operations, search, fAgent, fType, fOrigin, fStatus, dateFrom, dateTo])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // Compute estimated commissions for pipeline operations (central helper)
  const getEstimated = (op: OperationWithAgent) => {
    const agent = agents.find(a => a.id === op.agent_id)
    return estimatePipelineCommission(op, agent)
  }

  // Pipeline totals from filtered operations
  // Includiamo sia 'pipeline' che 'proposta_accettata' nel "pipeline" totals
  // (sono entrambe operazioni in corso, non ancora incassate)
  const filteredPipeline = filtered.filter(o => o.status === 'pipeline' || o.status === 'proposta_accettata')
  const filteredCompleted = filtered.filter(o => o.status === 'incassato')

  const pipelineTotals = useMemo(() => {
    let value = 0, gross = 0, agentComm = 0, agencyRev = 0
    let weightedGross = 0, weightedAgentComm = 0, weightedAgencyRev = 0
    filteredPipeline.forEach(op => {
      value += op.property_value || 0
      const est = getEstimated(op)
      if (est) {
        gross += est.grossCommission
        agentComm += est.agentCommission
        agencyRev += est.agencyRevenue
        // Proposta accettata: peso fisso 100% (certa). Pipeline: peso da sale_probability.
        const w = op.status === 'proposta_accettata' ? 1 : getPipelineWeight(op)
        weightedGross += est.grossCommission * w
        weightedAgentComm += est.agentCommission * w
        weightedAgencyRev += est.agencyRevenue * w
      }
    })
    return { count: filteredPipeline.length, value, gross, agentComm, agencyRev, weightedGross, weightedAgentComm, weightedAgencyRev }
  }, [filteredPipeline, agents])

  const completedTotals = useMemo(() => {
    let value = 0, gross = 0, agentComm = 0
    filteredCompleted.forEach(op => {
      value += op.final_value || op.property_value || 0
      gross += op.gross_commission || 0
      agentComm += op.agent_commission || 0
    })
    return { count: filteredCompleted.length, value, gross, agentComm, agencyRev: gross - agentComm }
  }, [filteredCompleted])

  const getAgentName = (agentId: string) => agents.find(a => a.id === agentId)?.full_name || '—'
  const getAgentProfile = (agentId: string) => agents.find(a => a.id === agentId) || null

  const handleCreate = async (data: Partial<Operation>) => {
    const { error } = await addOperation(data)
    if (error) addToast('Errore nella creazione', 'error')
    else { addToast('Operazione creata', 'success'); setShowCreateModal(false) }
  }

  const handleEdit = async (data: Partial<Operation>) => {
    if (!editingOp) return
    const { error } = await updateOperation(editingOp.id, data)
    if (error) addToast('Errore nella modifica', 'error')
    else { addToast('Operazione modificata', 'success'); setEditingOp(null) }
  }

  const handleClose = async (data: Partial<Operation>) => {
    if (!closingOp) return
    const { error } = await updateOperation(closingOp.id, data)
    if (error) addToast('Errore nella chiusura', 'error')
    else { addToast('Operazione chiusa', 'success'); setClosingOp(null) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminare questa operazione?')) return
    const { error } = await deleteOperation(id)
    if (error) addToast("Errore nell'eliminazione", 'error')
    else addToast('Operazione eliminata', 'success')
  }

  const resetFilters = () => {
    setSearch(''); setFAgent(''); setFType(''); setFOrigin(''); setFStatus('')
    setDateFrom(''); setDateTo(''); setPage(0)
  }

  const hasFilters = !!(search || fAgent || fType || fOrigin || fStatus || dateFrom || dateTo)

  const handleExport = () => {
    const headers = ['Immobile', 'Agente', 'Tipo', 'Origine', 'Stato', 'Prob.', 'Valore', 'Comm. Agenzia', 'Quota Agente', 'Comm. Stimate', 'Quota Agente Stim.', 'Data', 'Inserito il']
    const rows = filtered.map(o => {
      const est = o.status === 'pipeline' ? getEstimated(o) : null
      return [
        o.property_name, getAgentName(o.agent_id), o.type, o.origin, o.status,
        o.sale_probability ? `${o.sale_probability}%` : '',
        (o.final_value || o.property_value || 0).toFixed(2),
        (o.gross_commission || 0).toFixed(2), (o.agent_commission || 0).toFixed(2),
        est ? est.grossCommission.toFixed(2) : '',
        est ? est.agentCommission.toFixed(2) : '',
        o.sale_date || o.date_added.split('T')[0], formatDateTime(o.date_added),
      ]
    })
    exportCsv(headers, rows, `victorco-operazioni-${new Date().toISOString().split('T')[0]}.csv`)
  }

  return (
    <div>
      <ToastContainer toasts={toasts} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="section-heading" style={{ margin: 0 }}>Operazioni</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={handleExport}>Export CSV</button>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>+ Nuova Operazione</button>
        </div>
      </div>

      <div className="filters-bar">
        <input className="filter-input" placeholder="Cerca immobile, indirizzo, acquirente, agente..."
          value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} style={{ minWidth: 280 }} />
        <select className="filter-select" value={fAgent} onChange={e => { setFAgent(e.target.value); setPage(0) }}>
          <option value="">Tutti gli agenti</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
        </select>
        <select className="filter-select" value={fType} onChange={e => { setFType(e.target.value); setPage(0) }}>
          <option value="">Tutti i tipi</option>
          <option value="vendita">Vendita</option>
          <option value="locazione">Locazione</option>
        </select>
        <select className="filter-select" value={fOrigin} onChange={e => { setFOrigin(e.target.value); setPage(0) }}>
          <option value="">Tutte le origini</option>
          <option value="agente">Agente</option>
          <option value="agenzia">Agenzia</option>
        </select>
        <select className="filter-select" value={fStatus} onChange={e => { setFStatus(e.target.value); setPage(0) }}>
          <option value="">Tutti gli stati</option>
          <option value="pipeline">Pipeline</option>
          <option value="proposta_accettata">Proposta accettata</option>
              <option value="incassato">Incassato</option>
              <option value="terminato">Terminato</option>
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
        <div style={{ marginBottom: 16 }}>
          <DateRangePicker from={dateFrom} to={dateTo}
            onChange={(f, t) => { setDateFrom(f); setDateTo(t); setPage(0) }} label="Periodo" />
        </div>
      )}

      {/* Totals Summary */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {/* Pipeline totals */}
          <div style={{ background: 'var(--s1)', borderRadius: 12, padding: 16, border: '1px solid var(--bd)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span className="badge badge-pipeline">pipeline</span>
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: 'var(--g)' }}>
                {pipelineTotals.count} immobili
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
              <div>
                <div style={{ color: 'var(--g)', marginBottom: 2 }}>Valore immobili</div>
                <div style={{ fontFamily: "'Montserrat', sans-serif", color: 'var(--w)', fontWeight: 600 }}>{formatEur(pipelineTotals.value)}</div>
              </div>
              <div>
                <div style={{ color: 'var(--g)', marginBottom: 2, display: 'inline-flex', alignItems: 'center' }}>
                  <span>Comm. lorde stimate</span>
                  <FormulaTip title="Comm. lorde stimate" formula={PIPELINE_FORMULAS.pipelineGross} />
                </div>
                <div style={{ fontFamily: "'Montserrat', sans-serif", color: 'var(--amber)', fontWeight: 600 }}>{formatEur(pipelineTotals.gross)}</div>
              </div>
              <div>
                <div style={{ color: 'var(--g)', marginBottom: 2, display: 'inline-flex', alignItems: 'center' }}>
                  <span>Quota agenti stimata</span>
                  <FormulaTip title="Quota agenti stimata" formula={PIPELINE_FORMULAS.agentShare} />
                </div>
                <div style={{ fontFamily: "'Montserrat', sans-serif", color: 'var(--teal)', fontWeight: 600 }}>{formatEur(pipelineTotals.agentComm)}</div>
              </div>
              <div>
                <div style={{ color: 'var(--g)', marginBottom: 2, display: 'inline-flex', alignItems: 'center' }}>
                  <span>Margine agenzia stimato</span>
                  <FormulaTip title="Margine agenzia stimato" formula={PIPELINE_FORMULAS.agencyMargin} />
                </div>
                <div style={{ fontFamily: "'Montserrat', sans-serif", color: 'var(--green)', fontWeight: 600 }}>{formatEur(pipelineTotals.agencyRev)}</div>
              </div>
            </div>
            {pipelineTotals.weightedGross !== pipelineTotals.gross && (
              <div style={{ borderTop: '1px solid var(--bd)', marginTop: 10, paddingTop: 8 }}>
                <div style={{ fontSize: 10, color: 'var(--g)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.3px', display: 'inline-flex', alignItems: 'center' }}>
                  <span>Pesato per probabilità</span>
                  <FormulaTip title="Pesato per probabilità"
                    formula={PIPELINE_FORMULAS.pipelineWeighted}
                    note={PIPELINE_FORMULAS.weight} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 12 }}>
                  <div>
                    <div style={{ color: 'var(--g)', marginBottom: 2 }}>Comm. lorde</div>
                    <div style={{ fontFamily: "'Montserrat', sans-serif", color: 'var(--amber)', fontWeight: 600 }}>{formatEur(pipelineTotals.weightedGross)}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--g)', marginBottom: 2 }}>Quota agenti</div>
                    <div style={{ fontFamily: "'Montserrat', sans-serif", color: 'var(--teal)', fontWeight: 600 }}>{formatEur(pipelineTotals.weightedAgentComm)}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--g)', marginBottom: 2 }}>Margine agenzia</div>
                    <div style={{ fontFamily: "'Montserrat', sans-serif", color: 'var(--green)', fontWeight: 600 }}>{formatEur(pipelineTotals.weightedAgencyRev)}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* Completed totals */}
          <div style={{ background: 'var(--s1)', borderRadius: 12, padding: 16, border: '1px solid var(--bd)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span className="badge badge-completata">completata</span>
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: 'var(--g)' }}>
                {completedTotals.count} immobili
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
              <div>
                <div style={{ color: 'var(--g)', marginBottom: 2 }}>Valore immobili</div>
                <div style={{ fontFamily: "'Montserrat', sans-serif", color: 'var(--w)', fontWeight: 600 }}>{formatEur(completedTotals.value)}</div>
              </div>
              <div>
                <div style={{ color: 'var(--g)', marginBottom: 2 }}>Comm. lorde</div>
                <div style={{ fontFamily: "'Montserrat', sans-serif", color: 'var(--amber)', fontWeight: 600 }}>{formatEur(completedTotals.gross)}</div>
              </div>
              <div>
                <div style={{ color: 'var(--g)', marginBottom: 2 }}>Quota agenti</div>
                <div style={{ fontFamily: "'Montserrat', sans-serif", color: 'var(--teal)', fontWeight: 600 }}>{formatEur(completedTotals.agentComm)}</div>
              </div>
              <div>
                <div style={{ color: 'var(--g)', marginBottom: 2 }}>Margine agenzia</div>
                <div style={{ fontFamily: "'Montserrat', sans-serif", color: 'var(--green)', fontWeight: 600 }}>{formatEur(completedTotals.agencyRev)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Immobile</th><th>Agente</th><th>Tipo</th><th>Origine</th><th>Stato</th><th>Prob.</th>
              <th>Val. Finale</th><th>Comm. Agenzia</th><th>Quota Agente</th><th>Data</th><th>Inserito</th><th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={12}><div className="skeleton skeleton-row" /></td></tr>
              ))
            ) : paged.length === 0 ? (
              <tr><td colSpan={12} style={{ textAlign: 'center', color: 'var(--g)', padding: 24 }}>Nessuna operazione trovata</td></tr>
            ) : (
              paged.map(op => (
                <tr key={op.id}>
                  <td>
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
                  <td><span className="clickable-cell" onClick={() => navigate(`/admin/agent/${op.agent_id}`)}>{getAgentName(op.agent_id)}</span></td>
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
                  <td style={{ fontFamily: "'Montserrat', sans-serif" }}>{formatEur(op.final_value || op.property_value || 0)}</td>
                  {(() => {
                    if (op.status === 'incassato') {
                      return (
                        <>
                          <td style={{ fontFamily: "'Montserrat', sans-serif" }}>{op.gross_commission ? formatEur(op.gross_commission) : '—'}</td>
                          <td style={{ fontFamily: "'Montserrat', sans-serif", color: 'var(--teal)' }}>{op.agent_commission ? formatEur(op.agent_commission) : '—'}</td>
                        </>
                      )
                    }
                    const est = getEstimated(op)
                    return (
                      <>
                        <td style={{ fontFamily: "'Montserrat', sans-serif", color: 'var(--amber)', fontStyle: 'italic' }} title="Stima">
                          {est ? `~${formatEur(est.grossCommission)}` : '—'}
                        </td>
                        <td style={{ fontFamily: "'Montserrat', sans-serif", color: 'var(--teal)', fontStyle: 'italic' }} title="Stima">
                          {est ? `~${formatEur(est.agentCommission)}` : '—'}
                        </td>
                      </>
                    )
                  })()}
                  <td style={{ fontSize: 12, color: 'var(--gl)' }}>{op.sale_date ? formatDate(op.sale_date) : formatDate(op.date_added)}</td>
                  <td style={{ fontSize: 11, color: 'var(--g)', whiteSpace: 'nowrap' }}>{formatDateTime(op.date_added)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {op.status === 'pipeline' && (
                        <button className="btn btn-success btn-sm" onClick={() => setClosingOp(op)}>✓</button>
                      )}
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditingOp(op)}>✎</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(op.id)}>✕</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button onClick={() => setPage(p => p - 1)} disabled={page === 0}>← Prec</button>
          <span className="page-info">Pag. {page + 1} di {totalPages} ({filtered.length} risultati)</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>Succ →</button>
        </div>
      )}

      {!loading && (
        <OperationsTotalsFooter
          operations={filtered}
          resolveAgent={(op) => getAgentProfile(op.agent_id)}
          completedLabel="Tot. Completate (filtrato)"
        />
      )}

      <OpModal open={showCreateModal} onClose={() => setShowCreateModal(false)} onSave={handleCreate} agents={agents} />
      {editingOp && (
        <OpModal open={!!editingOp} onClose={() => setEditingOp(null)} onSave={handleEdit} initial={editingOp} agents={agents} />
      )}
      <CloseModal open={!!closingOp} onClose={() => setClosingOp(null)} onConfirm={handleClose}
        operation={closingOp} agentProfile={closingOp ? getAgentProfile(closingOp.agent_id) : null} />
      <OperationDetailModal open={!!detailOp} operation={detailOp} onClose={() => setDetailOp(null)}
        onEdit={(op) => { setDetailOp(null); setEditingOp(op) }}
        onCloseOp={(op) => { setDetailOp(null); setClosingOp(op) }}
        onChangeStatus={async (op, newStatus) => {
          const { error } = await updateOperation(op.id, { status: newStatus })
          if (error) addToast('Errore nel cambio stato', 'error')
          else { addToast(`Stato → ${newStatus.replace('_', ' ')}`, 'success'); setDetailOp(null) }
        }}
        onDelete={(id) => { setDetailOp(null); handleDelete(id) }}
        isAdmin />
      <AgentProfileModal open={!!detailAgent} agent={detailAgent} operations={operations}
        onClose={() => setDetailAgent(null)} />
    </div>
  )
}
