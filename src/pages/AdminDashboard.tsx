import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOperations } from '../hooks/useOperations'
import { useProfiles } from '../hooks/useProfiles'
import { formatEur, formatDate, formatDateTime, estimatePipelineCommission, getPipelineWeight, PIPELINE_FORMULAS, ACCEPTED_PROPOSAL_WEIGHT, getBuyersDisplay } from '../lib/calculations'
import { exportCsv } from '../lib/exportCsv'
import KpiCard from '../components/KpiCard'
import MonthlyChart from '../components/MonthlyChart'
import ForecastCard from '../components/ForecastCard'
import BudgetSection from '../components/BudgetSection'
import YearComparisonChart from '../components/YearComparisonChart'
import YearComparisonSummary from '../components/YearComparisonSummary'
import OperationDetailModal from '../components/OperationDetailModal'
import OperationsTotalsFooter from '../components/OperationsTotalsFooter'
import AgentProfileModal from '../components/AgentProfileModal'
import FormulaTip from '../components/FormulaTip'
import type { OperationWithAgent, Profile } from '../lib/supabase'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { operations, loading: opsLoading } = useOperations()
  const { agents, loading: profilesLoading } = useProfiles()
  const loading = opsLoading || profilesLoading

  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [referenceYear, setReferenceYear] = useState(currentYear - 1)
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 3 + i)

  // Filters for global table
  const [fAgent, setFAgent] = useState('')
  const [fType, setFType] = useState('')
  const [fOrigin, setFOrigin] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fPeriod, setFPeriod] = useState('')

  // Detail modals
  const [detailOp, setDetailOp] = useState<OperationWithAgent | null>(null)
  const [detailAgent, setDetailAgent] = useState<Profile | null>(null)

  const yearStartDate = new Date(selectedYear, 0, 1)
  const yearEndDate = new Date(selectedYear + 1, 0, 1)

  const completed = operations.filter(o => o.status === 'incassato')
  const pipeline = operations.filter(o => o.status === 'pipeline')
  const proposte = operations.filter(o => o.status === 'proposta_accettata')
  const completedYear = completed.filter(o =>
    o.sale_date && new Date(o.sale_date) >= yearStartDate && new Date(o.sale_date) < yearEndDate
  )

  const totalGrossYear = completedYear.reduce((s, o) => s + (o.gross_commission || 0), 0)
  const totalAgentYear = completedYear.reduce((s, o) => s + (o.agent_commission || 0), 0)
  const marginYear = totalGrossYear - totalAgentYear

  // Pipeline commission estimates: raw + weighted by sale_probability (null → 50% fallback)
  const pipelineCommEstimates = pipeline.map(op => {
    const agent = agents.find(a => a.id === op.agent_id)
    const r = estimatePipelineCommission(op, agent)
    const weight = getPipelineWeight(op)
    const gross = r?.grossCommission || 0
    return { agentId: op.agent_id, gross, weight, weightedGross: gross * weight }
  })

  // Proposte accettate: separate da pipeline, pesate ACCEPTED_PROPOSAL_WEIGHT nella stima realistica
  const proposteCommEstimates = proposte.map(op => {
    const agent = agents.find(a => a.id === op.agent_id)
    const r = estimatePipelineCommission(op, agent)
    return { agentId: op.agent_id, gross: r?.grossCommission || 0 }
  })

  const pipelineExpectedGross = pipelineCommEstimates.reduce((s, e) => s + e.gross, 0)
  const pipelineWeightedGross = pipelineCommEstimates.reduce((s, e) => s + e.weightedGross, 0)
  const proposteGross = proposteCommEstimates.reduce((s, e) => s + e.gross, 0)
  // Stima totale = chiuse + proposte + pipeline intera (ottimistico)
  const estimatedTotalYear = totalGrossYear + proposteGross + pipelineExpectedGross
  // Stima pesata = chiuse + proposte × 90% + pipeline pesata (realistico)
  const estimatedWeightedYear = totalGrossYear + proposteGross * ACCEPTED_PROPOSAL_WEIGHT + pipelineWeightedGross

  const agentPerf = agents.filter(a => a.active).map(agent => {
    const agentOps = operations.filter(o => o.agent_id === agent.id)
    const agentCompletedYear = agentOps.filter(o =>
      o.status === 'incassato' && o.sale_date &&
      new Date(o.sale_date) >= yearStartDate && new Date(o.sale_date) < yearEndDate
    )
    const agentPipeline = agentOps.filter(o => o.status === 'pipeline')
    const agentProposte = agentOps.filter(o => o.status === 'proposta_accettata')
    const totalComm = agentCompletedYear.reduce((s, o) => s + (o.gross_commission || 0), 0)
    const agentComm = agentCompletedYear.reduce((s, o) => s + (o.agent_commission || 0), 0)
    const agencyComm = totalComm - agentComm
    const closingRate = agentOps.length > 0 ? (agentCompletedYear.length / (agentCompletedYear.length + agentPipeline.length + agentProposte.length)) * 100 : 0
    const pipelineGross = pipelineCommEstimates
      .filter(e => e.agentId === agent.id)
      .reduce((s, e) => s + e.gross, 0)
    const pipelineWeighted = pipelineCommEstimates
      .filter(e => e.agentId === agent.id)
      .reduce((s, e) => s + e.weightedGross, 0)
    const propostaGross = proposteCommEstimates
      .filter(e => e.agentId === agent.id)
      .reduce((s, e) => s + e.gross, 0)
    // Stima tot: proposte + pipeline intera; stima pesata: proposte × 90% + pipeline pesata
    const estimatedTotal = totalComm + propostaGross + pipelineGross
    const estimatedWeighted = totalComm + propostaGross * ACCEPTED_PROPOSAL_WEIGHT + pipelineWeighted
    return { agent, closed: agentCompletedYear.length, pipeline: agentPipeline.length, proposte: agentProposte.length, totalComm, agentComm, agencyComm, closingRate, pipelineGross, pipelineWeighted, propostaGross, estimatedTotal, estimatedWeighted }
  })

  const perfTotals = {
    closed: agentPerf.reduce((s, p) => s + p.closed, 0),
    pipeline: agentPerf.reduce((s, p) => s + p.pipeline, 0),
    proposte: agentPerf.reduce((s, p) => s + p.proposte, 0),
    totalComm: agentPerf.reduce((s, p) => s + p.totalComm, 0),
    agentComm: agentPerf.reduce((s, p) => s + p.agentComm, 0),
    agencyComm: agentPerf.reduce((s, p) => s + p.agencyComm, 0),
    pipelineGross: agentPerf.reduce((s, p) => s + p.pipelineGross, 0),
    pipelineWeighted: agentPerf.reduce((s, p) => s + p.pipelineWeighted, 0),
    propostaGross: agentPerf.reduce((s, p) => s + p.propostaGross, 0),
    estimatedTotal: agentPerf.reduce((s, p) => s + p.estimatedTotal, 0),
    estimatedWeighted: agentPerf.reduce((s, p) => s + p.estimatedWeighted, 0),
  }

  const filteredOps = operations.filter(o => {
    if (fAgent && o.agent_id !== fAgent) return false
    if (fType && o.type !== fType) return false
    if (fOrigin && o.origin !== fOrigin) return false
    if (fStatus && o.status !== fStatus) return false
    if (fPeriod) {
      // Logica filtro periodo (richiesta team): le pipeline sono "current" e
      // vengono mostrate sempre. Il filtro periodo si applica solo alle completate
      // tramite sale_date — NON tramite date_added (data di inserimento).
      if (o.status === 'pipeline') {
        // Pipeline = sempre visibile per i filtri periodo
        return true
      }
      if (!o.sale_date) return false
      const d = new Date(o.sale_date)
      const now = new Date()
      if (fPeriod === 'month') {
        if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false
      } else if (fPeriod === 'quarter') {
        const q = Math.floor(now.getMonth() / 3)
        const dq = Math.floor(d.getMonth() / 3)
        if (dq !== q || d.getFullYear() !== now.getFullYear()) return false
      } else if (fPeriod === 'year') {
        if (d.getFullYear() !== now.getFullYear()) return false
      }
    }
    return true
  })

  const getAgentName = (agentId: string) => agents.find(a => a.id === agentId)?.full_name || '—'

  const handleExport = () => {
    const headers = ['Immobile', 'Agente', 'Tipo', 'Origine', 'Stato', 'Val. Finale', 'Comm. Agenzia', 'Quota Agente', 'Acquirente', 'Data', 'Inserito il']
    const rows = filteredOps.map(o => [
      o.property_name, getAgentName(o.agent_id), o.type, o.origin, o.status,
      (o.final_value || o.property_value || 0).toFixed(2),
      (o.gross_commission || 0).toFixed(2), (o.agent_commission || 0).toFixed(2),
      getBuyersDisplay(o) || '', o.sale_date || o.date_added.split('T')[0], formatDateTime(o.date_added),
    ])
    exportCsv(headers, rows, `victorco-operazioni-${new Date().toISOString().split('T')[0]}.csv`)
  }

  return (
    <div>
      {/* Year selector + KPI heading */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div className="section-heading" style={{ margin: 0 }}>KPI Globali</div>
        <select className="filter-select" value={selectedYear}
          onChange={e => setSelectedYear(Number(e.target.value))} style={{ width: 100 }}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div className="kpi-grid">
        <KpiCard value={completedYear.length.toString()} label={`Ops Chiuse ${selectedYear}`} loading={loading}
          onClick={() => { setFStatus('incassato'); setFPeriod('year') }} />
        <KpiCard value={pipeline.length.toString()} label="Ops Pipeline" loading={loading} color="amber"
          onClick={() => { setFStatus('pipeline'); setFPeriod('') }} />
        <KpiCard value={formatEur(totalGrossYear)} label="Comm. Totali" loading={loading}
          legend={<FormulaTip title="Comm. Totali" formula={`Somma di gross_commission delle operazioni completate nel ${selectedYear}`} />} />
        <KpiCard value={formatEur(totalAgentYear)} label="Comm. Agenti" loading={loading} color="teal"
          legend={<FormulaTip title="Comm. Agenti" formula={`Somma di agent_commission delle operazioni completate nel ${selectedYear}`} />} />
        <KpiCard value={formatEur(marginYear)} label="Margine Agenzia" loading={loading} color="green"
          legend={<FormulaTip title="Margine Agenzia" formula="Comm. Totali - Comm. Agenti" note={PIPELINE_FORMULAS.agencyMargin} />} />
        <KpiCard value={formatEur(pipelineExpectedGross)} label="Comm. Stimate Pipeline" loading={loading} color="amber"
          legend={<FormulaTip title="Comm. Stimate Pipeline" formula={PIPELINE_FORMULAS.pipelineGross}
            note="Include modalità fissa/% e quote collaboratori." />} />
        <KpiCard value={formatEur(estimatedTotalYear)} label={`Stima Tot. ${selectedYear}`} loading={loading} color="green"
          legend={<FormulaTip title={`Stima Tot. ${selectedYear}`} formula={PIPELINE_FORMULAS.estimatedTotal}
            note="Scenario ottimistico: tutta la pipeline chiude entro l'anno." />} />
        <KpiCard value={formatEur(estimatedWeightedYear)} label={`Stima Pesata ${selectedYear}`} loading={loading} color="teal"
          legend={<FormulaTip title={`Stima Pesata ${selectedYear}`} formula={PIPELINE_FORMULAS.estimatedWeighted}
            note={PIPELINE_FORMULAS.weight} />} />
      </div>

      {/* Budget */}
      {!loading && <BudgetSection agents={agents} operations={operations} />}

      {/* Agent Performance */}
      <div className="section-heading">Performance Agenti {selectedYear}</div>
      <div className="table-wrap" style={{ marginBottom: 24 }}>
        <table>
          <thead>
            <tr>
              <th>Agente</th>
              <th>Chiuse</th>
              <th>Pipeline</th>
              <th>Comm. Totali<FormulaTip title="Comm. Totali" formula="Somma gross_commission delle operazioni chiuse dell'agente nell'anno selezionato" align="center" /></th>
              <th>Quota Agente<FormulaTip title="Quota Agente" formula="Somma agent_commission delle operazioni chiuse dell'agente nell'anno" align="center" /></th>
              <th>Quota Agenzia<FormulaTip title="Quota Agenzia" formula="Comm. Totali - Quota Agente" align="center" /></th>
              <th>Pipeline (tot.)<FormulaTip title="Pipeline (tot.)" formula={PIPELINE_FORMULAS.pipelineGross} align="center" /></th>
              <th>Pipeline Pesata<FormulaTip title="Pipeline Pesata" formula={PIPELINE_FORMULAS.pipelineWeighted} note={PIPELINE_FORMULAS.weight} align="center" /></th>
              <th>Stima Tot.<FormulaTip title="Stima Tot." formula={PIPELINE_FORMULAS.estimatedTotal} align="center" /></th>
              <th>Stima Pesata<FormulaTip title="Stima Pesata" formula={PIPELINE_FORMULAS.estimatedWeighted} note={PIPELINE_FORMULAS.weight} align="center" /></th>
              <th>% Chiusura<FormulaTip title="% Chiusura" formula="Chiuse anno / (Chiuse anno + Pipeline) × 100" align="right" /></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11}><div className="skeleton skeleton-row" /></td></tr>
            ) : (
              <>
                {agentPerf.map(p => (
                  <tr key={p.agent.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                        onClick={() => navigate(`/admin/agent/${p.agent.id}`)}>
                        <div className="avatar" style={{ backgroundColor: p.agent.color, width: 24, height: 24, fontSize: 9 }}>
                          {p.agent.initials}
                        </div>
                        <span className="clickable-cell">{p.agent.full_name}</span>
                      </div>
                    </td>
                    <td>{p.closed}</td><td>{p.pipeline}</td>
                    <td style={{ fontFamily: "'JetBrains Mono', monospace" }}>{formatEur(p.totalComm)}</td>
                    <td style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--teal)' }}>{formatEur(p.agentComm)}</td>
                    <td style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--amber)' }}>{formatEur(p.agencyComm)}</td>
                    <td style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--amber)' }}>{formatEur(p.pipelineGross)}</td>
                    <td style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--amber)' }}>{formatEur(p.pipelineWeighted)}</td>
                    <td style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--green)', fontWeight: 600 }}>{formatEur(p.estimatedTotal)}</td>
                    <td style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--teal)', fontWeight: 600 }}>{formatEur(p.estimatedWeighted)}</td>
                    <td>{p.closingRate.toFixed(0)}%</td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td>Totale</td>
                  <td>{perfTotals.closed}</td><td>{perfTotals.pipeline}</td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace" }}>{formatEur(perfTotals.totalComm)}</td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--teal)' }}>{formatEur(perfTotals.agentComm)}</td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--amber)' }}>{formatEur(perfTotals.agencyComm)}</td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--amber)' }}>{formatEur(perfTotals.pipelineGross)}</td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--amber)' }}>{formatEur(perfTotals.pipelineWeighted)}</td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--green)', fontWeight: 600 }}>{formatEur(perfTotals.estimatedTotal)}</td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--teal)', fontWeight: 600 }}>{formatEur(perfTotals.estimatedWeighted)}</td>
                  <td>—</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
        <p style={{ fontSize: 11, color: 'var(--g)', marginTop: 8 }}>
          Passa sopra le icone <i style={{ fontFamily: 'serif' }}>i</i> nelle intestazioni per vedere le formule usate.
        </p>
      </div>

      {/* Monthly Chart */}
      {!loading && <MonthlyChart operations={operations} />}

      {/* Year-over-Year Comparison */}
      {!loading && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div className="section-heading" style={{ margin: 0 }}>Confronto Anno su Anno</div>
            <select className="filter-select" value={referenceYear}
              onChange={e => setReferenceYear(Number(e.target.value))} style={{ width: 100 }}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <YearComparisonSummary operations={operations} selectedYear={selectedYear} referenceYear={referenceYear} />
          <div style={{ background: 'var(--s1)', borderRadius: 12, padding: 20, border: '1px solid var(--bd)' }}>
            <YearComparisonChart operations={operations} selectedYear={selectedYear} referenceYear={referenceYear} />
          </div>
        </div>
      )}

      {/* Forecast */}
      {!loading && (
        <div style={{ marginBottom: 24 }}>
          <div className="section-heading">Forecast Pipeline</div>
          <ForecastCard operations={operations} agents={agents} />
        </div>
      )}

      {/* Global Operations Table */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div className="section-heading" style={{ margin: 0 }}>Operazioni Globale</div>
        <button className="btn btn-secondary btn-sm" onClick={handleExport}>Export CSV</button>
      </div>

      <div className="filters-bar">
        <select className="filter-select" value={fAgent} onChange={e => setFAgent(e.target.value)}>
          <option value="">Tutti gli agenti</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
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
        <select className="filter-select" value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="">Tutti gli stati</option>
          <option value="pipeline">Pipeline</option>
          <option value="proposta_accettata">Proposta accettata</option>
              <option value="incassato">Incassato</option>
              <option value="terminato">Terminato</option>
        </select>
        <select className="filter-select" value={fPeriod} onChange={e => setFPeriod(e.target.value)}>
          <option value="">Tutto il periodo</option>
          <option value="month">Questo mese</option>
          <option value="quarter">Questo trimestre</option>
          <option value="year">Quest'anno</option>
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Immobile</th><th>Agente</th><th>Acquirente</th><th>Tipo</th><th>Origine</th>
              <th>Stato</th><th>Val. Finale</th><th>Comm. Agenzia</th><th>Quota Agente</th><th>Data</th>
            </tr>
          </thead>
          <tbody>
            {filteredOps.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--g)', padding: 24 }}>Nessuna operazione trovata</td></tr>
            ) : (
              filteredOps.map(op => (
                <tr key={op.id}>
                  <td>
                    <div>
                      <div className="clickable-cell" style={{ fontWeight: 600 }}
                        onClick={() => setDetailOp(op)}>{op.property_name}</div>
                      {op.address && (
                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(op.address)}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 11, color: 'var(--g)', textDecoration: 'none' }}
                          onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                          onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
                          {op.address}
                        </a>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="clickable-cell" onClick={() => navigate(`/admin/agent/${op.agent_id}`)}>{getAgentName(op.agent_id)}</span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--gl)' }}>{getBuyersDisplay(op) || '—'}</td>
                  <td><span className="clickable-cell" onClick={() => setFType(op.type)}><span className={`badge badge-${op.type}`}>{op.type}</span></span></td>
                  <td><span className="clickable-cell" onClick={() => setFOrigin(op.origin)}><span className={`badge badge-${op.origin}`}>{op.origin}</span></span></td>
                  <td><span className="clickable-cell" onClick={() => setFStatus(op.status)}><span className={`badge badge-${op.status}`}>{op.status}</span></span></td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {formatEur(op.final_value || op.property_value || 0)}
                  </td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {op.gross_commission ? formatEur(op.gross_commission) : '—'}
                  </td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--teal)' }}>
                    {op.agent_commission ? formatEur(op.agent_commission) : '—'}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--gl)' }}>
                    {op.sale_date ? formatDate(op.sale_date) : formatDate(op.date_added)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && (
        <OperationsTotalsFooter
          operations={filteredOps}
          resolveAgent={(op) => agents.find(a => a.id === op.agent_id) || null}
          yearLabel={selectedYear}
          completedYearFilter={selectedYear}
          completedLabel={`Tot. Completate ${selectedYear} (filtrato)`}
        />
      )}

      {/* Detail Modals */}
      <OperationDetailModal
        open={!!detailOp}
        operation={detailOp}
        onClose={() => setDetailOp(null)}
        onEdit={() => setDetailOp(null)}
        isAdmin
      />
      <AgentProfileModal
        open={!!detailAgent}
        agent={detailAgent}
        operations={operations}
        onClose={() => setDetailAgent(null)}
      />
    </div>
  )
}
