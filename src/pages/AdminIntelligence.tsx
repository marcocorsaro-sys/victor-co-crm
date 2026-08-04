import { useState, useMemo } from 'react'
import { useOperations } from '../hooks/useOperations'
import { useProfiles } from '../hooks/useProfiles'
import { useValuations } from '../hooks/useValuations'
import { formatEur, PIPELINE_FORMULAS } from '../lib/calculations'
import FormulaTip from '../components/FormulaTip'
import { calculateProjectedTrajectory } from '../lib/projections'
import KpiCard from '../components/KpiCard'
import PriceDistributionChart from '../components/PriceDistributionChart'
import MonthlyAvgPriceChart from '../components/MonthlyAvgPriceChart'
import type { OperationWithAgent } from '../lib/supabase'

function extractZona(address: string | null): string {
  if (!address) return 'N/D'
  const parts = address.split(',').map(p => p.trim()).filter(Boolean)
  return parts[parts.length - 1] || 'N/D'
}

export default function AdminIntelligence() {
  const { operations, loading: opsLoading } = useOperations()
  const { agents, activeAgents, loading: profLoading } = useProfiles()
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const { valutazioni, loading: valLoading } = useValuations()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 3 + i)

  // Filters
  const [fAgent, setFAgent] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortCol, setSortCol] = useState('gross')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const loading = opsLoading || profLoading || valLoading

  const resetFilters = () => { setFAgent(''); setDateFrom(''); setDateTo('') }
  const hasFilters = !!(fAgent || dateFrom || dateTo)

  // ── Filtered operations ──
  const yearStart = new Date(selectedYear, 0, 1)
  const yearEnd = new Date(selectedYear + 1, 0, 1)
  const prevYearStart = new Date(selectedYear - 1, 0, 1)
  const prevYearEnd = new Date(selectedYear, 0, 1)

  const filterByPeriodAndAgent = (ops: OperationWithAgent[], start: Date, end: Date) => {
    return ops.filter(o => {
      if (fAgent && o.agent_id !== fAgent) return false
      if (o.status === 'incassato' && o.sale_date) {
        const d = new Date(o.sale_date)
        if (dateFrom && dateTo) {
          return d >= new Date(dateFrom) && d <= new Date(dateTo)
        }
        return d >= start && d < end
      }
      return false
    })
  }

  const completed = useMemo(() => filterByPeriodAndAgent(operations, yearStart, yearEnd), [operations, selectedYear, fAgent, dateFrom, dateTo])
  const prevCompleted = useMemo(() => filterByPeriodAndAgent(operations, prevYearStart, prevYearEnd), [operations, selectedYear, fAgent, dateFrom, dateTo])

  // Pipeline: only meaningful for current year (past years are closed, no pipeline)
  const isCurrentYear = selectedYear === currentYear
  const pipeline = useMemo(() => {
    if (!isCurrentYear) return [] // Anno chiuso, nessuna pipeline
    return operations.filter(o => {
      if (o.status !== 'pipeline') return false
      if (fAgent && o.agent_id !== fAgent) return false
      return true
    })
  }, [operations, fAgent, isCurrentYear])

  // ── 1. KPI Overview ──
  const totalValue = completed.reduce((s, o) => s + (o.final_value || o.property_value || 0), 0)
  const totalGross = completed.reduce((s, o) => s + (o.gross_commission || 0), 0)
  const totalAgent = completed.reduce((s, o) => s + (o.agent_commission || 0), 0)
  const agencyMargin = totalGross - totalAgent
  const avgPrice = completed.length > 0 ? totalValue / completed.length : 0
  const avgComm = completed.length > 0 ? totalGross / completed.length : 0
  const avgMargin = completed.length > 0 ? agencyMargin / completed.length : 0

  // Tempo medio mandato→chiusura
  const mandateDays = completed.filter(o => o.mandate_start_date && o.sale_date).map(o => {
    const start = new Date(o.mandate_start_date!)
    const end = new Date(o.sale_date!)
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000))
  })
  const avgDays = mandateDays.length > 0 ? Math.round(mandateDays.reduce((a, b) => a + b, 0) / mandateDays.length) : 0

  // ── 2. Proiezione + YoY ──
  const prevGross = prevCompleted.reduce((s, o) => s + (o.gross_commission || 0), 0)
  const prevAgent = prevCompleted.reduce((s, o) => s + (o.agent_commission || 0), 0)
  const prevMargin = prevGross - prevAgent
  const prevValue = prevCompleted.reduce((s, o) => s + (o.final_value || o.property_value || 0), 0)

  // Projection only for current year
  const projResult = useMemo(() => {
    if (!isCurrentYear) return null
    const filteredCompleted = operations.filter(o => o.status === 'incassato' && (!fAgent || o.agent_id === fAgent))
    // Include proposta_accettata: pesa 90% nel modello (pipeline pesata)
    const filteredOpen = operations.filter(o =>
      (o.status === 'pipeline' || o.status === 'proposta_accettata') && (!fAgent || o.agent_id === fAgent))
    return calculateProjectedTrajectory(filteredCompleted, filteredOpen, agents, selectedYear)
  }, [operations, agents, selectedYear, fAgent, isCurrentYear])

  const bd = projResult?.breakdown || null
  const [showFormula, setShowFormula] = useState(false)

  // Proiezioni dal modello pipeline pesata (solo anno corrente)
  const projectedGross = isCurrentYear ? (bd?.projectedTotal || 0) : totalGross
  const projAgent = isCurrentYear ? (bd?.projectedAgent || 0) : totalAgent
  const projMargin = isCurrentYear ? (bd?.projectedMargin || 0) : agencyMargin
  const projValue = isCurrentYear ? (bd?.projectedValue || 0) : totalValue
  const projOps = isCurrentYear ? Math.round(bd?.projectedOps || 0) : completed.length

  const delta = (curr: number, prev: number) => prev > 0 ? ((curr - prev) / prev * 100) : curr > 0 ? 100 : 0

  // ── 3. Distribuzione Geografica ──
  const zoneData = useMemo(() => {
    const map = new Map<string, { count: number; totalValue: number; totalComm: number }>()
    completed.forEach(op => {
      const zona = extractZona(op.address)
      const cur = map.get(zona) || { count: 0, totalValue: 0, totalComm: 0 }
      cur.count++
      cur.totalValue += op.final_value || op.property_value || 0
      cur.totalComm += op.gross_commission || 0
      map.set(zona, cur)
    })
    return Array.from(map.entries())
      .map(([zona, d]) => ({ zona, ...d, avgValue: d.totalValue / d.count, avgComm: d.totalComm / d.count }))
      .sort((a, b) => b.count - a.count)
  }, [completed])

  // ── 4. Tipo & Origine ──
  const byType = useMemo(() => {
    const vendita = completed.filter(o => o.type === 'vendita')
    const locazione = completed.filter(o => o.type === 'locazione')
    const calc = (ops: OperationWithAgent[]) => ({
      count: ops.length,
      avgValue: ops.length > 0 ? ops.reduce((s, o) => s + (o.final_value || o.property_value || 0), 0) / ops.length : 0,
      avgComm: ops.length > 0 ? ops.reduce((s, o) => s + (o.gross_commission || 0), 0) / ops.length : 0,
    })
    return { vendita: calc(vendita), locazione: calc(locazione) }
  }, [completed])

  const byOrigin = useMemo(() => {
    const calc = (ops: OperationWithAgent[]) => ({
      count: ops.length,
      avgValue: ops.length > 0 ? ops.reduce((s, o) => s + (o.final_value || o.property_value || 0), 0) / ops.length : 0,
      avgComm: ops.length > 0 ? ops.reduce((s, o) => s + (o.gross_commission || 0), 0) / ops.length : 0,
      margin: ops.length > 0 ? ops.reduce((s, o) => s + ((o.gross_commission || 0) - (o.agent_commission || 0)), 0) / ops.length : 0,
    })
    return {
      agente: calc(completed.filter(o => o.origin === 'agente')),
      agenzia: calc(completed.filter(o => o.origin === 'agenzia')),
      valutazione: calc(completed.filter(o => o.origin === 'valutazione')),
    }
  }, [completed])

  // ── 7. Performance Agenti ──
  const agentStats = useMemo(() => {
    const stats = activeAgents.map(agent => {
      const ops = completed.filter(o => o.agent_id === agent.id)
      const pip = pipeline.filter(o => o.agent_id === agent.id)
      const gross = ops.reduce((s, o) => s + (o.gross_commission || 0), 0)
      const agentComm = ops.reduce((s, o) => s + (o.agent_commission || 0), 0)
      const value = ops.reduce((s, o) => s + (o.final_value || o.property_value || 0), 0)
      // Closing rate: year-based (closed in year / (closed in year + current pipeline))
      const closingRate = (ops.length + pip.length) > 0 ? (ops.length / (ops.length + pip.length) * 100) : 0
      return {
        agent,
        count: ops.length,
        pipeline: pip.length,
        value,
        gross,
        agentComm,
        margin: gross - agentComm,
        avgComm: ops.length > 0 ? gross / ops.length : 0,
        ticket: ops.length > 0 ? value / ops.length : 0,
        closingRate,
      }
    })

    stats.sort((a, b) => {
      const aVal = (a as any)[sortCol] ?? 0
      const bVal = (b as any)[sortCol] ?? 0
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal
    })
    return stats
  }, [completed, pipeline, activeAgents, operations, sortCol, sortDir])

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortCol(col); setSortDir('desc') }
  }
  const sortIcon = (col: string) => sortCol === col ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''

  // ── 8. Pipeline Analysis ──
  const pipelineByProb = useMemo(() => {
    const groups = { '30': [] as OperationWithAgent[], '60': [] as OperationWithAgent[], '90': [] as OperationWithAgent[], none: [] as OperationWithAgent[] }
    pipeline.forEach(op => {
      const key = op.sale_probability ? String(op.sale_probability) : 'none'
      ;(groups as any)[key]?.push(op)
    })
    const calc = (ops: OperationWithAgent[]) => ({
      count: ops.length,
      value: ops.reduce((s, o) => s + (o.property_value || 0), 0),
    })
    return {
      p30: calc(groups['30']),
      p60: calc(groups['60']),
      p90: calc(groups['90']),
      none: calc(groups.none),
    }
  }, [pipeline])

  // Null probability → 50% (PIPELINE_WEIGHT_FALLBACK), consistent with rest of app
  const pipelineWeightedValue =
    pipelineByProb.p30.value * 0.3 +
    pipelineByProb.p60.value * 0.6 +
    pipelineByProb.p90.value * 0.9 +
    pipelineByProb.none.value * 0.5

  // Tempo medio in pipeline
  const pipelineDays = pipeline.filter(o => o.date_added).map(o => {
    const added = new Date(o.date_added)
    return Math.round((Date.now() - added.getTime()) / 86400000)
  })
  const avgPipelineDays = pipelineDays.length > 0 ? Math.round(pipelineDays.reduce((a, b) => a + b, 0) / pipelineDays.length) : 0

  // ── 9. Efficienza ──
  const valTotal = valutazioni.length
  const valIncarichi = valutazioni.filter(v => v.incarico_preso).length
  const valConversione = valTotal > 0 ? (valIncarichi / valTotal * 100) : 0

  const totalCollected = completed.reduce((s, o) => s + (o.commission_collected || 0), 0)
  const collectionRate = totalGross > 0 ? (totalCollected / totalGross * 100) : 0

  const withCollab = completed.filter(o => o.collaborator_id || o.collaborator_name)
  const withoutCollab = completed.filter(o => !o.collaborator_id && !o.collaborator_name)
  const marginWithCollab = withCollab.length > 0 ? withCollab.reduce((s, o) => s + ((o.gross_commission || 0) - (o.agent_commission || 0)), 0) / withCollab.length : 0
  const marginWithoutCollab = withoutCollab.length > 0 ? withoutCollab.reduce((s, o) => s + ((o.gross_commission || 0) - (o.agent_commission || 0)), 0) / withoutCollab.length : 0

  const mono = { fontFamily: "'JetBrains Mono', monospace" } as const

  const sectionLabel = (text: string) => (
    <div style={{ ...mono, fontSize: 11, color: 'var(--ld)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12, marginTop: 24 }}>
      // {text}
    </div>
  )

  const DeltaValue = ({ value, suffix = '%' }: { value: number; suffix?: string }) => (
    <span style={{ ...mono, fontSize: 12, fontWeight: 600, color: value > 0 ? 'var(--green)' : value < 0 ? 'var(--red)' : 'var(--g)' }}>
      {value > 0 ? '+' : ''}{value.toFixed(1)}{suffix}
    </span>
  )

  return (
    <div>
      {/* ── Global Filters ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="section-heading" style={{ margin: 0 }}>Intelligence</div>
      </div>
      <div className="filters-bar" style={{ marginBottom: 20, position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg)', paddingBottom: 8 }}>
        <select className="filter-select" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={{ width: 100 }}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className="filter-select" value={fAgent} onChange={e => setFAgent(e.target.value)}>
          <option value="">Tutti gli agenti</option>
          {activeAgents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
        </select>
        <input type="date" className="filter-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: 150 }} placeholder="Da" />
        <input type="date" className="filter-input" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: 150 }} placeholder="A" />
        {hasFilters && (
          <button className="btn btn-secondary btn-sm" onClick={resetFilters} style={{ color: 'var(--red)' }}>✕ Reset</button>
        )}
      </div>

      {/* ── 1. KPI Overview ── */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <KpiCard value={completed.length.toString()} label="Ops chiuse" loading={loading} />
        <KpiCard value={formatEur(avgPrice)} label="Prezzo medio" loading={loading} />
        <KpiCard value={formatEur(avgComm)} label="Comm. media lorda" loading={loading} color="amber" />
        <KpiCard value={formatEur(avgMargin)} label="Margine medio" loading={loading} color="green" />
        <KpiCard value={avgDays > 0 ? `${avgDays} gg` : '—'} label="Tempo medio chiusura" loading={loading} color="teal" />
        <KpiCard value={formatEur(totalValue)} label="Valore venduto" loading={loading} />
      </div>

      {/* ── 2. Proiezione + YoY ── */}
      {!loading && (
        <>
          {sectionLabel(isCurrentYear ? `Proiezione al 31/12/${selectedYear} e confronto ${selectedYear - 1}` : `Consuntivo ${selectedYear} vs ${selectedYear - 1}`)}
          <div style={{ background: 'var(--s1)', borderRadius: 12, padding: 16, border: '1px solid var(--bd)', marginBottom: 20, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--g)', borderBottom: '1px solid var(--bd)' }}>Metrica</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 12, color: 'var(--lime)', borderBottom: '1px solid var(--bd)' }}>Consuntivo {selectedYear}</th>
                  {isCurrentYear && <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 12, color: 'var(--amber)', borderBottom: '1px solid var(--bd)' }}>Proiezione 31/12</th>}
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 12, color: 'var(--g)', borderBottom: '1px solid var(--bd)' }}>{selectedYear - 1}</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 12, color: 'var(--g)', borderBottom: '1px solid var(--bd)' }}>Δ YoY</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Commissioni lorde', actual: totalGross, proj: projectedGross, prev: prevGross },
                  { label: 'Quota agenti', actual: totalAgent, proj: projAgent, prev: prevAgent },
                  { label: 'Margine agenzia', actual: agencyMargin, proj: projMargin, prev: prevMargin },
                  { label: 'Valore venduto', actual: totalValue, proj: projValue, prev: prevValue },
                  { label: 'Operazioni chiuse', actual: completed.length, proj: projOps, prev: prevCompleted.length },
                ].map(row => (
                  <tr key={row.label}>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--w)', borderBottom: '1px solid var(--bd)' }}>{row.label}</td>
                    <td style={{ ...mono, padding: '10px 12px', textAlign: 'right', fontSize: 13, color: 'var(--lime)', borderBottom: '1px solid var(--bd)' }}>
                      {typeof row.actual === 'number' && row.label !== 'Operazioni chiuse' ? formatEur(row.actual) : row.actual}
                    </td>
                    {isCurrentYear && (
                      <td style={{ ...mono, padding: '10px 12px', textAlign: 'right', fontSize: 13, color: 'var(--amber)', fontStyle: 'italic', borderBottom: '1px solid var(--bd)' }}>
                        {typeof row.proj === 'number' && row.label !== 'Operazioni chiuse' ? `~${formatEur(row.proj)}` : `~${Math.round(row.proj as number)}`}
                      </td>
                    )}
                    <td style={{ ...mono, padding: '10px 12px', textAlign: 'right', fontSize: 13, color: 'var(--g)', borderBottom: '1px solid var(--bd)' }}>
                      {typeof row.prev === 'number' && row.label !== 'Operazioni chiuse' ? formatEur(row.prev) : row.prev}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '1px solid var(--bd)' }}>
                      <DeltaValue value={delta(row.actual as number, row.prev as number)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {isCurrentYear && bd && (
            <div style={{ marginTop: 12 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowFormula(!showFormula)}
                style={{ fontSize: 11 }}
              >
                {showFormula ? '▲ Nascondi formula' : '▼ Come calcoliamo la proiezione?'}
              </button>
              {showFormula && (
                <div style={{ marginTop: 12, padding: 14, background: 'var(--bg2)', borderRadius: 8, border: '1px solid var(--bd)', fontSize: 12, lineHeight: 1.8 }}>
                  <div style={{ ...mono, fontSize: 11, color: 'var(--lime)', marginBottom: 8, textTransform: 'uppercase' }}>// Metodologia: pipeline pesata (nessun trend storico)</div>
                  <div style={{ color: 'var(--gl)' }}>
                    <strong style={{ color: 'var(--w)' }}>1. Consuntivo YTD:</strong> commissioni lorde già incassate nell'anno = <span style={{ ...mono, color: 'var(--lime)' }}>{formatEur(bd.ytdActual)}</span>
                  </div>
                  <div style={{ color: 'var(--gl)' }}>
                    <strong style={{ color: 'var(--w)' }}>2. Proposte accettate × 90%:</strong> la trattativa è chiusa, resta solo il rischio rogito.
                    <br />Lordo: <span style={{ ...mono, color: 'var(--g)' }}>{formatEur(bd.acceptedGross)}</span> → Pesato: <span style={{ ...mono, color: 'var(--amber)' }}>{formatEur(bd.acceptedWeighted)}</span>
                  </div>
                  <div style={{ color: 'var(--gl)' }}>
                    <strong style={{ color: 'var(--w)' }}>3. Pipeline pesata per probabilità:</strong> ogni operazione pesa per la sua probabilità di vendita (30% / 60% / 90%, 50% se non indicata) e per la probabilità di chiudere entro il 31/12 (lead mediano storico: {bd.medianLeadDays.toFixed(0)} gg{bd.discountedOpsCount > 0 ? `; ${bd.discountedOpsCount} operazioni scontate perché troppo recenti` : ''}).
                    <br />Pipeline lorda totale: <span style={{ ...mono, color: 'var(--g)' }}>{formatEur(bd.pipelineGrossTotal)}</span> → Pesata: <span style={{ ...mono, color: 'var(--amber)' }}>{formatEur(bd.pipelineWeightedByProb)}</span>
                  </div>
                  <div style={{ ...mono, color: 'var(--lime)', padding: '6px 12px', background: 'var(--s1)', borderRadius: 6, margin: '8px 0', fontSize: 11 }}>
                    stima_31/12 = YTD + proposte_accettate × 90% + Σ (pipeline × probabilità × fattore_tempo)
                  </div>
                  <div style={{ color: 'var(--gl)' }}>
                    <strong style={{ color: 'var(--w)' }}>4. Totale proiettato 31/12:</strong> {formatEur(bd.ytdActual)} + {formatEur(bd.acceptedWeighted)} + {formatEur(bd.pipelineWeightedByProb)} = <span style={{ ...mono, color: 'var(--amber)', fontWeight: 700 }}>{formatEur(bd.projectedTotal)}</span>
                  </div>
                  <div style={{ color: 'var(--gl)', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--bd)' }}>
                    <strong style={{ color: 'var(--w)' }}>Scenari:</strong>{' '}
                    Prudente (solo prob. ≥ 60%): <span style={{ ...mono, color: 'var(--teal)' }}>{formatEur(bd.projectedPrudente)}</span>
                    {' · '}Realistico: <span style={{ ...mono, color: 'var(--amber)' }}>{formatEur(bd.projectedTotal)}</span>
                    {' · '}Ottimistico (tutto al lordo): <span style={{ ...mono, color: 'var(--g)' }}>{formatEur(bd.projectedOttimista)}</span>
                  </div>
                </div>
              )}
            </div>
            )}
          </div>
        </>
      )}

      {/* ── 3. Distribuzione Geografica ── */}
      {!loading && zoneData.length > 0 && (
        <>
          {sectionLabel('Distribuzione Geografica')}
          <div style={{ background: 'var(--s1)', borderRadius: 12, padding: 16, border: '1px solid var(--bd)', marginBottom: 20 }}>
            {zoneData.map(z => {
              const pct = completed.length > 0 ? (z.count / completed.length * 100) : 0
              return (
                <div key={z.zona} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--bd)' }}>
                  <div style={{ width: 140, fontWeight: 600, color: 'var(--w)', fontSize: 13 }}>{z.zona}</div>
                  <div style={{ flex: 1 }}>
                    <div className="progress-bar" style={{ height: 6 }}>
                      <div className="progress-bar-fill" style={{ width: `${pct}%`, backgroundColor: 'var(--lime)' }} />
                    </div>
                  </div>
                  <div style={{ ...mono, width: 40, textAlign: 'right', fontSize: 12, color: 'var(--w)' }}>{z.count}</div>
                  <div style={{ ...mono, width: 50, textAlign: 'right', fontSize: 11, color: 'var(--g)' }}>{pct.toFixed(0)}%</div>
                  <div style={{ ...mono, width: 110, textAlign: 'right', fontSize: 12, color: 'var(--gl)' }}>{formatEur(z.avgValue)}</div>
                  <div style={{ ...mono, width: 90, textAlign: 'right', fontSize: 12, color: 'var(--teal)' }}>{formatEur(z.avgComm)}</div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── 4. Tipo & Origine ── */}
      {!loading && (
        <>
          {sectionLabel('Analisi per Tipo e Origine')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div style={{ background: 'var(--s1)', borderRadius: 12, padding: 16, border: '1px solid var(--bd)' }}>
              <div style={{ ...mono, fontSize: 11, color: 'var(--ld)', marginBottom: 10 }}>// TIPO OPERAZIONE</div>
              {[
                { label: 'Vendita', d: byType.vendita, badge: 'badge-vendita' },
                { label: 'Locazione', d: byType.locazione, badge: 'badge-locazione' },
              ].map(({ label, d, badge }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--bd)', alignItems: 'center' }}>
                  <span className={`badge ${badge}`}>{label}</span>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                    <span style={{ color: 'var(--g)' }}>{d.count} ops</span>
                    <span style={{ ...mono, color: 'var(--gl)' }}>Media: {formatEur(d.avgValue)}</span>
                    <span style={{ ...mono, color: 'var(--teal)' }}>Comm: {formatEur(d.avgComm)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ background: 'var(--s1)', borderRadius: 12, padding: 16, border: '1px solid var(--bd)' }}>
              <div style={{ ...mono, fontSize: 11, color: 'var(--ld)', marginBottom: 10 }}>// ORIGINE</div>
              {[
                { label: 'Agente', d: byOrigin.agente, badge: 'badge-agente' },
                { label: 'Agenzia', d: byOrigin.agenzia, badge: 'badge-agenzia' },
                { label: 'Valutazione', d: byOrigin.valutazione, badge: 'badge-pipeline' },
              ].map(({ label, d, badge }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--bd)', alignItems: 'center' }}>
                  <span className={`badge ${badge}`}>{label}</span>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                    <span style={{ color: 'var(--g)' }}>{d.count} ops</span>
                    <span style={{ ...mono, color: 'var(--gl)' }}>Media: {formatEur(d.avgValue)}</span>
                    <span style={{ ...mono, color: 'var(--teal)' }}>Margine: {formatEur(d.margin)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── 5. Distribuzione Fasce di Prezzo ── */}
      {!loading && completed.length > 0 && (
        <>
          {sectionLabel('Distribuzione Fasce di Prezzo')}
          <div className="chart-wrap" style={{ marginBottom: 20 }}>
            <PriceDistributionChart operations={completed} />
          </div>
        </>
      )}

      {/* ── 6. Andamento Mensile ── */}
      {!loading && completed.length > 0 && (
        <>
          {sectionLabel(`Prezzo Medio e Commissione Media Mensile — ${selectedYear}`)}
          <div className="chart-wrap" style={{ marginBottom: 20 }}>
            <MonthlyAvgPriceChart operations={operations.filter(o => !fAgent || o.agent_id === fAgent)} year={selectedYear} />
          </div>
        </>
      )}

      {/* ── 7. Performance Agenti ── */}
      {!loading && !fAgent && (
        <>
          {sectionLabel('Ranking Agenti')}
          <div className="table-wrap" style={{ marginBottom: 20 }}>
            <table>
              <thead>
                <tr>
                  <th>Agente</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('count')}>Ops{sortIcon('count')}</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('value')}>Valore Tot.{sortIcon('value')}</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('gross')}>Comm. Lorde{sortIcon('gross')}</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('avgComm')}>Comm. Media{sortIcon('avgComm')}</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('margin')}>Margine{sortIcon('margin')}</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('ticket')}>Ticket Medio{sortIcon('ticket')}</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('closingRate')}>% Chiusura{sortIcon('closingRate')}</th>
                </tr>
              </thead>
              <tbody>
                {agentStats.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--g)', padding: 24 }}>Nessun dato</td></tr>
                ) : (
                  agentStats.map((s, i) => {
                    const isTop = i === 0 && agentStats.length > 1
                    return (
                      <tr key={s.agent.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="avatar" style={{ backgroundColor: s.agent.color, width: 28, height: 28, fontSize: 10 }}>{s.agent.initials}</div>
                            <span style={{ fontWeight: isTop ? 700 : 400, color: isTop ? 'var(--lime)' : 'var(--w)' }}>{s.agent.full_name}</span>
                          </div>
                        </td>
                        <td style={mono}>{s.count}</td>
                        <td style={mono}>{formatEur(s.value)}</td>
                        <td style={{ ...mono, color: 'var(--amber)' }}>{formatEur(s.gross)}</td>
                        <td style={mono}>{formatEur(s.avgComm)}</td>
                        <td style={{ ...mono, color: 'var(--green)' }}>{formatEur(s.margin)}</td>
                        <td style={mono}>{formatEur(s.ticket)}</td>
                        <td style={{ ...mono, color: s.closingRate >= 50 ? 'var(--green)' : 'var(--g)' }}>{s.closingRate.toFixed(0)}%</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── 8. Analisi Pipeline (solo anno corrente) ── */}
      {!loading && isCurrentYear && pipeline.length > 0 && (
        <>
          {sectionLabel('Analisi Pipeline')}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Prob. 30%', ...pipelineByProb.p30, color: 'var(--red)', weight: 0.3 },
              { label: 'Prob. 60%', ...pipelineByProb.p60, color: 'var(--amber)', weight: 0.6 },
              { label: 'Prob. 90%', ...pipelineByProb.p90, color: 'var(--green)', weight: 0.9 },
              { label: 'Non definita', ...pipelineByProb.none, color: 'var(--g)', weight: 0.5 },
            ].map(g => (
              <div key={g.label} style={{ background: 'var(--s1)', borderRadius: 12, padding: 16, border: '1px solid var(--bd)' }}>
                <div style={{ fontSize: 12, color: g.color, fontWeight: 600, marginBottom: 8 }}>{g.label}</div>
                <div style={{ ...mono, fontSize: 18, fontWeight: 700, color: 'var(--w)' }}>{g.count}</div>
                <div style={{ ...mono, fontSize: 12, color: 'var(--gl)', marginTop: 4 }}>Valore: {formatEur(g.value)}</div>
                <div style={{ ...mono, fontSize: 11, color: 'var(--g)', marginTop: 2 }}>Pesato: {formatEur(g.value * g.weight)}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div style={{ background: 'var(--s1)', borderRadius: 12, padding: 16, border: '1px solid var(--bd)', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--g)', textTransform: 'uppercase', marginBottom: 4 }}>Pipeline totale</div>
              <div style={{ ...mono, fontSize: 18, fontWeight: 700, color: 'var(--w)' }}>{pipeline.length} ops</div>
            </div>
            <div style={{ background: 'var(--s1)', borderRadius: 12, padding: 16, border: '1px solid var(--bd)', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--g)', textTransform: 'uppercase', marginBottom: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <span>Valore pesato prob.</span>
                <FormulaTip title="Valore pesato per probabilità"
                  formula="Σ (valore_immobile × peso) sulle operazioni in pipeline"
                  note={PIPELINE_FORMULAS.weight} />
              </div>
              <div style={{ ...mono, fontSize: 18, fontWeight: 700, color: 'var(--amber)' }}>{formatEur(pipelineWeightedValue)}</div>
            </div>
            <div style={{ background: 'var(--s1)', borderRadius: 12, padding: 16, border: '1px solid var(--bd)', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--g)', textTransform: 'uppercase', marginBottom: 4 }}>Giorni medi in pipeline</div>
              <div style={{ ...mono, fontSize: 18, fontWeight: 700, color: 'var(--teal)' }}>{avgPipelineDays} gg</div>
            </div>
          </div>
        </>
      )}

      {/* ── 9. Indicatori di Efficienza ── */}
      {!loading && (
        <>
          {sectionLabel('Indicatori di Efficienza')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 40 }}>
            <div style={{ background: 'var(--s1)', borderRadius: 12, padding: 16, border: '1px solid var(--bd)' }}>
              <div style={{ fontSize: 11, color: 'var(--g)', textTransform: 'uppercase', marginBottom: 8 }}>Valutazioni → Incarichi</div>
              <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: valConversione > 30 ? 'var(--green)' : 'var(--amber)' }}>
                {valConversione.toFixed(0)}%
              </div>
              <div style={{ fontSize: 11, color: 'var(--g)', marginTop: 4 }}>{valIncarichi} su {valTotal} valutazioni</div>
            </div>
            <div style={{ background: 'var(--s1)', borderRadius: 12, padding: 16, border: '1px solid var(--bd)' }}>
              <div style={{ fontSize: 11, color: 'var(--g)', textTransform: 'uppercase', marginBottom: 8 }}>Collection Rate</div>
              <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: collectionRate > 80 ? 'var(--green)' : 'var(--amber)' }}>
                {collectionRate.toFixed(0)}%
              </div>
              <div style={{ fontSize: 11, color: 'var(--g)', marginTop: 4 }}>{formatEur(totalCollected)} su {formatEur(totalGross)}</div>
            </div>
            <div style={{ background: 'var(--s1)', borderRadius: 12, padding: 16, border: '1px solid var(--bd)' }}>
              <div style={{ fontSize: 11, color: 'var(--g)', textTransform: 'uppercase', marginBottom: 8 }}>Margine con/senza collaboratore</div>
              <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--g)' }}>Con ({withCollab.length})</div>
                  <div style={{ ...mono, fontSize: 14, fontWeight: 600, color: 'var(--teal)' }}>{formatEur(marginWithCollab)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--g)' }}>Senza ({withoutCollab.length})</div>
                  <div style={{ ...mono, fontSize: 14, fontWeight: 600, color: 'var(--green)' }}>{formatEur(marginWithoutCollab)}</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
