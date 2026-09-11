import { useState, useMemo, useEffect, Fragment } from 'react'
import { useOperations } from '../hooks/useOperations'
import { useProfiles } from '../hooks/useProfiles'
import { supabase } from '../lib/supabase'
import { formatEur, formatDate, getBuyersDisplay, getSellersDisplay } from '../lib/calculations'
import KpiCard from '../components/KpiCard'
import type { OperationWithAgent, Profile } from '../lib/supabase'

/** ─── ISO Week helpers ──────────────────────────────────────────────── */
function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return { year: d.getUTCFullYear(), week }
}

/** Number of ISO weeks in a year (52 or 53) */
function getISOWeeksInYear(year: number): number {
  // A year has 53 weeks if Jan 1 is Thursday OR (leap year AND Jan 1 is Wednesday)
  const jan1 = new Date(year, 0, 1).getDay() || 7
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0)
  if (jan1 === 4 || (jan1 === 3 && isLeap)) return 53
  return 52
}

/** Returns Monday and Sunday of an ISO week */
function getWeekRange(year: number, week: number): { start: Date; end: Date } {
  // Jan 4 is always in week 1
  const jan4 = new Date(year, 0, 4)
  const dayOfWeek = jan4.getDay() || 7
  const week1Monday = new Date(jan4)
  week1Monday.setDate(jan4.getDate() - dayOfWeek + 1)
  const start = new Date(week1Monday)
  start.setDate(week1Monday.getDate() + (week - 1) * 7)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

const ACTION_LABELS: Record<string, string> = {
  operation_created: 'Inserito immobile',
  operation_edited: 'Modifica immobile',
  operation_closed: 'Chiusa operazione',
  operation_deleted: 'Cancellata operazione',
  login: 'Accesso',
  client_created: 'Nuovo cliente',
  valuation_created: 'Valutazione creata',
}

const ACTION_COLORS: Record<string, string> = {
  operation_created: 'var(--lime)',
  operation_edited: 'var(--teal)',
  operation_closed: 'var(--green)',
  operation_deleted: 'var(--red)',
  login: 'var(--g)',
  client_created: 'var(--amber)',
  valuation_created: 'var(--ld)',
}

type ActivityLog = {
  id: string
  agent_id: string
  action_type: string
  details: Record<string, unknown> | null
  created_at: string
}

export default function AdminWeekly() {
  const { operations, loading: opsLoading } = useOperations()
  const { profiles, loading: profLoading } = useProfiles()
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [filterType, setFilterType] = useState<'all' | 'vendita' | 'locazione'>('vendita')
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null)
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [logsLoading, setLogsLoading] = useState(true)

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 3 + i)
  const totalWeeks = getISOWeeksInYear(selectedYear)

  // Fetch activity logs for the selected year
  useEffect(() => {
    setLogsLoading(true)
    const yearStart = new Date(selectedYear, 0, 1).toISOString()
    const yearEnd = new Date(selectedYear + 1, 0, 1).toISOString()
    supabase
      .from('agent_activity_logs')
      .select('*')
      .gte('created_at', yearStart)
      .lt('created_at', yearEnd)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setActivityLogs((data || []) as ActivityLog[])
        setLogsLoading(false)
      })
  }, [selectedYear])

  const loading = opsLoading || profLoading || logsLoading

  // Filter operations by type
  const filteredOps = useMemo(() =>
    filterType === 'all' ? operations : operations.filter(o => o.type === filterType),
    [operations, filterType]
  )

  const profileMap = useMemo(() => {
    const m = new Map<string, Profile>()
    profiles.forEach(p => m.set(p.id, p))
    return m
  }, [profiles])

  // ── Aggregate by week ──
  type WeekData = {
    week: number
    range: { start: Date; end: Date }
    pipelineAdded: OperationWithAgent[]
    closed: OperationWithAgent[]
    grossCommission: number
    agentCommission: number
    agencyCommission: number
    collected: number
    actions: ActivityLog[]
    actionsByType: Record<string, number>
    actionsByAgent: Map<string, ActivityLog[]>
  }

  const weeksData = useMemo<WeekData[]>(() => {
    const result: WeekData[] = []
    for (let w = 1; w <= totalWeeks; w++) {
      const range = getWeekRange(selectedYear, w)
      const start = range.start.getTime()
      const end = range.end.getTime()

      // Pipeline added in this week (all ops created in week, with status pipeline now)
      const pipelineAdded = filteredOps.filter(o => {
        const t = new Date(o.date_added).getTime()
        return t >= start && t <= end
      })

      // Operations closed in this week (sale_date in week)
      const closed = filteredOps.filter(o => {
        if (!o.sale_date) return false
        const t = new Date(o.sale_date).getTime()
        return t >= start && t <= end
      })

      const grossCommission = closed.reduce((s, o) => s + (o.gross_commission || 0), 0)
      const agentCommission = closed.reduce((s, o) => s + (o.agent_commission || 0), 0)
      const agencyCommission = grossCommission - agentCommission

      // Commissions collected in this week
      let collected = 0
      filteredOps.forEach(o => {
        const ds = o.collection_date_seller ? new Date(o.collection_date_seller).getTime() : null
        const db = o.collection_date_buyer ? new Date(o.collection_date_buyer).getTime() : null
        if (ds !== null && ds >= start && ds <= end) {
          collected += o.commission_collected_seller || 0
        }
        if (db !== null && db >= start && db <= end) {
          collected += o.commission_collected_buyer || 0
        }
        // Legacy fallback if split fields not set
        if (ds === null && db === null && o.collection_date) {
          const dl = new Date(o.collection_date).getTime()
          if (dl >= start && dl <= end) collected += o.commission_collected || 0
        }
      })

      // Activity logs in this week
      const actions = activityLogs.filter(a => {
        const t = new Date(a.created_at).getTime()
        return t >= start && t <= end
      })
      const actionsByType: Record<string, number> = {}
      const actionsByAgent = new Map<string, ActivityLog[]>()
      actions.forEach(a => {
        actionsByType[a.action_type] = (actionsByType[a.action_type] || 0) + 1
        const list = actionsByAgent.get(a.agent_id) || []
        list.push(a)
        actionsByAgent.set(a.agent_id, list)
      })

      result.push({
        week: w,
        range,
        pipelineAdded,
        closed,
        grossCommission,
        agentCommission,
        agencyCommission,
        collected,
        actions,
        actionsByType,
        actionsByAgent,
      })
    }
    return result
  }, [selectedYear, totalWeeks, filteredOps, activityLogs])

  // Year totals
  const yearTotals = useMemo(() => {
    const allClosed = filteredOps.filter(o => o.sale_date && new Date(o.sale_date).getFullYear() === selectedYear)
    const totalGross = allClosed.reduce((s, o) => s + (o.gross_commission || 0), 0)
    const totalAgent = allClosed.reduce((s, o) => s + (o.agent_commission || 0), 0)
    const allAdded = filteredOps.filter(o => new Date(o.date_added).getFullYear() === selectedYear)
    const totalActions = activityLogs.length
    const totalCollected = weeksData.reduce((s, w) => s + w.collected, 0)
    return {
      addedOps: allAdded.length,
      closedOps: allClosed.length,
      totalGross,
      totalAgent,
      agencyMargin: totalGross - totalAgent,
      totalActions,
      totalCollected,
    }
  }, [filteredOps, selectedYear, activityLogs, weeksData])

  // Find current week (only highlight if year matches)
  const today = new Date()
  const todayWeek = today.getFullYear() === selectedYear ? getISOWeek(today).week : -1

  const mono = { fontFamily: "'Montserrat', sans-serif" } as const

  const formatRange = (r: { start: Date; end: Date }) =>
    `${formatDate(r.start.toISOString())} — ${formatDate(r.end.toISOString())}`

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div className="section-heading" style={{ margin: 0 }}>Andamento Settimanale</div>
          <div style={{ fontSize: 12, color: 'var(--g)', marginTop: 4 }}>
            52 settimane ISO — pipeline, commissioni, attività agenti
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="filter-select" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={{ width: 100 }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="filter-select" value={filterType} onChange={e => setFilterType(e.target.value as 'all' | 'vendita' | 'locazione')}>
            <option value="vendita">Solo Vendite</option>
            <option value="locazione">Solo Locazioni</option>
            <option value="all">Tutti i tipi</option>
          </select>
        </div>
      </div>

      {/* KPI overview */}
      <div className="kpi-grid" style={{ marginBottom: 16 }}>
        <KpiCard value={yearTotals.addedOps.toString()} label={`Inseriti ${selectedYear}`} loading={loading} />
        <KpiCard value={yearTotals.closedOps.toString()} label={`Chiusi ${selectedYear}`} loading={loading} color="green" />
        <KpiCard value={formatEur(yearTotals.totalGross)} label="Comm. Lorde" loading={loading} color="amber" />
        <KpiCard value={formatEur(yearTotals.totalCollected)} label="Incassato" loading={loading} color="teal" />
        <KpiCard value={yearTotals.totalActions.toString()} label="Azioni totali" loading={loading} />
      </div>

      {/* Weekly table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 50 }}>Sett.</th>
              <th>Periodo</th>
              <th style={{ textAlign: 'right' }}>Inseriti</th>
              <th style={{ textAlign: 'right' }}>Chiuse</th>
              <th style={{ textAlign: 'right' }}>Comm. Agenzia</th>
              <th style={{ textAlign: 'right' }}>Comm. Agenti</th>
              <th style={{ textAlign: 'right' }}>Incassato</th>
              <th style={{ textAlign: 'right' }}>Azioni</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}><td colSpan={9}><div className="skeleton skeleton-row" /></td></tr>
              ))
            ) : (
              weeksData.map(w => {
                const isCurrent = w.week === todayWeek
                const isFuture = w.range.start > today
                const isExpanded = expandedWeek === w.week
                const hasActivity = w.pipelineAdded.length > 0 || w.closed.length > 0 || w.actions.length > 0
                return (
                  <Fragment key={w.week}>
                    <tr
                      onClick={() => setExpandedWeek(isExpanded ? null : w.week)}
                      style={{
                        cursor: 'pointer',
                        opacity: isFuture ? 0.4 : 1,
                        background: isCurrent ? 'rgba(13,52,71,0.08)' : isExpanded ? 'rgba(31,111,139,0.05)' : undefined,
                        borderLeft: isCurrent ? '3px solid var(--lime)' : '3px solid transparent',
                      }}
                    >
                      <td style={{ ...mono, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? 'var(--lime)' : 'var(--w)' }}>W{w.week}</td>
                      <td style={{ fontSize: 12, color: 'var(--gl)' }}>{formatRange(w.range)}</td>
                      <td style={{ ...mono, textAlign: 'right' }}>{w.pipelineAdded.length || '—'}</td>
                      <td style={{ ...mono, textAlign: 'right', color: w.closed.length > 0 ? 'var(--green)' : 'var(--g)' }}>
                        {w.closed.length || '—'}
                      </td>
                      <td style={{ ...mono, textAlign: 'right', color: w.agencyCommission > 0 ? 'var(--w)' : 'var(--g)' }}>
                        {w.agencyCommission > 0 ? formatEur(w.agencyCommission) : '—'}
                      </td>
                      <td style={{ ...mono, textAlign: 'right', color: w.agentCommission > 0 ? 'var(--teal)' : 'var(--g)' }}>
                        {w.agentCommission > 0 ? formatEur(w.agentCommission) : '—'}
                      </td>
                      <td style={{ ...mono, textAlign: 'right', color: w.collected > 0 ? 'var(--green)' : 'var(--g)' }}>
                        {w.collected > 0 ? formatEur(w.collected) : '—'}
                      </td>
                      <td style={{ ...mono, textAlign: 'right' }}>{w.actions.length || '—'}</td>
                      <td style={{ textAlign: 'center', color: 'var(--g)' }}>
                        {hasActivity ? (isExpanded ? '▼' : '▶') : ''}
                      </td>
                    </tr>
                    {isExpanded && hasActivity && (
                      <tr>
                        <td colSpan={9} style={{ background: 'var(--s1)', padding: 16 }}>
                          <WeekDetail week={w} profileMap={profileMap} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** ─── Expanded week detail ──────────────────────────────────────────── */
function WeekDetail({
  week,
  profileMap,
}: {
  week: {
    week: number
    pipelineAdded: OperationWithAgent[]
    closed: OperationWithAgent[]
    actions: ActivityLog[]
    actionsByType: Record<string, number>
    actionsByAgent: Map<string, ActivityLog[]>
  }
  profileMap: Map<string, Profile>
}) {
  const mono = { fontFamily: "'Montserrat', sans-serif" } as const

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {/* Operations added */}
      <div>
        <div style={{ ...mono, fontSize: 11, color: 'var(--ld)', textTransform: 'uppercase', marginBottom: 8 }}>
          // Operazioni inserite ({week.pipelineAdded.length})
        </div>
        {week.pipelineAdded.length === 0 ? (
          <div style={{ color: 'var(--g)', fontSize: 12 }}>Nessuna operazione inserita</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {week.pipelineAdded.map(op => {
              const agent = profileMap.get(op.agent_id)
              return (
                <div key={op.id} style={{ background: 'var(--bg2)', padding: 10, borderRadius: 8, border: '1px solid var(--bd)', fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: 'var(--w)' }}>{op.property_name}</span>
                    <span className={`badge badge-${op.status}`} style={{ fontSize: 10 }}>{op.status}</span>
                  </div>
                  <div style={{ color: 'var(--g)', fontSize: 11 }}>
                    {op.address || 'Indirizzo non specificato'}
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 11, color: 'var(--gl)' }}>
                    {agent && (
                      <span>
                        <span style={{ color: 'var(--g)' }}>Agente:</span> {agent.full_name}
                      </span>
                    )}
                    {op.property_value && (
                      <span style={{ ...mono }}>
                        {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(op.property_value)}
                      </span>
                    )}
                  </div>
                  {(getSellersDisplay(op) || getBuyersDisplay(op)) && (
                    <div style={{ fontSize: 11, color: 'var(--g)', marginTop: 4 }}>
                      {getSellersDisplay(op) && <>Vend.: <span style={{ color: 'var(--gl)' }}>{getSellersDisplay(op)}</span> </>}
                      {getBuyersDisplay(op) && <>Acq.: <span style={{ color: 'var(--gl)' }}>{getBuyersDisplay(op)}</span></>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Operations closed */}
        {week.closed.length > 0 && (
          <>
            <div style={{ ...mono, fontSize: 11, color: 'var(--ld)', textTransform: 'uppercase', marginTop: 12, marginBottom: 8 }}>
              // Operazioni chiuse ({week.closed.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {week.closed.map(op => {
                const agent = profileMap.get(op.agent_id)
                return (
                  <div key={op.id} style={{ background: 'rgba(29,143,95,0.06)', padding: 10, borderRadius: 8, border: '1px solid rgba(29,143,95,0.2)', fontSize: 12 }}>
                    <div style={{ fontWeight: 600, color: 'var(--w)' }}>{op.property_name}</div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 11 }}>
                      {agent && <span style={{ color: 'var(--gl)' }}>{agent.full_name}</span>}
                      {op.gross_commission && (
                        <span style={{ ...mono, color: 'var(--green)' }}>
                          {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(op.gross_commission)}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Actions by agent */}
      <div>
        <div style={{ ...mono, fontSize: 11, color: 'var(--ld)', textTransform: 'uppercase', marginBottom: 8 }}>
          // Azioni agenti ({week.actions.length})
        </div>
        {week.actions.length === 0 ? (
          <div style={{ color: 'var(--g)', fontSize: 12 }}>Nessuna azione registrata</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from(week.actionsByAgent.entries())
              .sort((a, b) => b[1].length - a[1].length)
              .map(([agentId, logs]) => {
                const agent = profileMap.get(agentId)
                const counts: Record<string, number> = {}
                logs.forEach(l => { counts[l.action_type] = (counts[l.action_type] || 0) + 1 })
                return (
                  <div key={agentId} style={{ background: 'var(--bg2)', padding: 10, borderRadius: 8, border: '1px solid var(--bd)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {agent && (
                          <div className="avatar" style={{ backgroundColor: agent.color, width: 22, height: 22, fontSize: 9 }}>
                            {agent.initials}
                          </div>
                        )}
                        <span style={{ fontWeight: 600, color: 'var(--w)', fontSize: 12 }}>
                          {agent?.full_name || 'Agente sconosciuto'}
                        </span>
                      </div>
                      <span style={{ ...mono, fontSize: 11, color: 'var(--g)' }}>{logs.length} azioni</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {Object.entries(counts).map(([type, n]) => (
                        <span key={type} style={{
                          fontSize: 10, padding: '2px 6px', borderRadius: 4,
                          background: 'var(--s1)',
                          color: ACTION_COLORS[type] || 'var(--g)',
                          border: `1px solid ${ACTION_COLORS[type] || 'var(--bd)'}33`,
                        }}>
                          {ACTION_LABELS[type] || type}: {n}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </div>
    </div>
  )
}
