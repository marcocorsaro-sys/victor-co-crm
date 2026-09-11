import { useState, useEffect } from 'react'
import type { Profile, OperationWithAgent } from '../lib/supabase'
import { useBudgets } from '../hooks/useBudgets'
import { formatEur } from '../lib/calculations'

/** Format number to Italian string for input display: 1.250.000,00 → "1.250.000,00" */
function toEurStr(n: number): string {
  if (!n && n !== 0) return ''
  return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Parse Italian-formatted string back to number: "1.250.000,00" → 1250000 */
function parseEurStr(s: string): number {
  const cleaned = s.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

type Props = {
  agents: Profile[]
  operations: OperationWithAgent[]
}

export default function BudgetSection({ agents, operations }: Props) {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const { budget, allocations, setBudget, setAllocation } = useBudgets(year)

  const [editingTarget, setEditingTarget] = useState(false)
  const [targetInput, setTargetInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (budget) {
      setTargetInput(toEurStr(budget.total_target))
    } else {
      setTargetInput('')
    }
  }, [budget])

  const activeAgents = agents.filter(a => a.active && a.role === 'agent')

  // YTD completed commissions per agent for selected year
  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year + 1, 0, 1)
  const completedYTD = operations.filter(o =>
    o.status === 'incassato' && o.sale_date &&
    new Date(o.sale_date) >= yearStart && new Date(o.sale_date) < yearEnd
  )

  const totalActual = completedYTD.reduce((s, o) => s + (o.gross_commission || 0), 0)
  const totalTarget = budget?.total_target || 0

  const getAgentActual = (agentId: string) =>
    completedYTD.filter(o => o.agent_id === agentId).reduce((s, o) => s + (o.gross_commission || 0), 0)

  const getAgentTarget = (agentId: string) => {
    const alloc = allocations.find(a => a.agent_id === agentId)
    return alloc?.allocated_target || 0
  }

  const handleSaveTarget = async () => {
    const val = parseEurStr(targetInput)
    if (val < 0) return
    setSaving(true)
    await setBudget(val)
    setEditingTarget(false)
    setSaving(false)
  }

  const handleSaveAllocation = async (agentId: string, rawValue: string) => {
    const val = parseEurStr(rawValue)
    if (val < 0) return
    await setAllocation(agentId, val)
  }

  const pct = (actual: number, target: number) => target > 0 ? Math.min((actual / target) * 100, 100) : 0
  const pctLabel = (actual: number, target: number) => target > 0 ? `${((actual / target) * 100).toFixed(0)}%` : '—'

  const years = Array.from({ length: 3 }, (_, i) => currentYear - 1 + i)

  return (
    <div className="budget-section">
      <div className="budget-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="forecast-label" style={{ background: 'rgba(29,143,95,0.15)', color: 'var(--green)' }}>BUDGET</span>
          <span className="section-heading" style={{ margin: 0 }}>Obiettivo Annuale</span>
        </div>
        <select
          className="filter-select"
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          style={{ width: 100 }}
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* No budget yet */}
      {!budget && !editingTarget ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <p style={{ color: 'var(--g)', marginBottom: 12 }}>Nessun obiettivo impostato per il {year}</p>
          <button className="btn btn-primary" onClick={() => setEditingTarget(true)}>
            Imposta obiettivo {year}
          </button>
        </div>
      ) : (
        <>
          {/* Agency total progress */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--g)' }}>Obiettivo agenzia</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {editingTarget ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--g)' }}>EUR</span>
                    <input
                      className="form-input"
                      type="text"
                      value={targetInput}
                      onChange={e => setTargetInput(e.target.value)}
                      onFocus={e => {
                        const val = parseEurStr(e.target.value)
                        if (val > 0) e.target.value = val.toString()
                        setTargetInput(val > 0 ? val.toString() : '')
                      }}
                      onBlur={e => {
                        const val = parseEurStr(e.target.value)
                        setTargetInput(toEurStr(val))
                      }}
                      style={{ width: 160, padding: '4px 8px', fontSize: 13, fontFamily: "'Montserrat', sans-serif", textAlign: 'right' }}
                      autoFocus
                      onKeyDown={e => e.key === 'Enter' && handleSaveTarget()}
                      placeholder="0,00"
                    />
                    <button className="btn btn-primary btn-sm" onClick={handleSaveTarget} disabled={saving}>
                      {saving ? '...' : 'Salva'}
                    </button>
                    {budget && (
                      <button className="btn btn-secondary btn-sm" onClick={() => { setEditingTarget(false); setTargetInput(toEurStr(budget.total_target)) }}>
                        Annulla
                      </button>
                    )}
                  </div>
                ) : (
                  <span
                    style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, cursor: 'pointer', color: 'var(--lime)' }}
                    onClick={() => setEditingTarget(true)}
                    title="Clicca per modificare"
                  >
                    {formatEur(totalActual)} / {formatEur(totalTarget)}
                  </span>
                )}
                {!editingTarget && (
                  <span style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontSize: 12,
                    fontWeight: 600,
                    color: totalActual >= totalTarget && totalTarget > 0 ? 'var(--green)' : 'var(--w)',
                  }}>
                    {pctLabel(totalActual, totalTarget)}
                  </span>
                )}
              </div>
            </div>
            <div className="progress-bar" style={{ height: 8 }}>
              <div
                className="progress-bar-fill"
                style={{
                  width: `${pct(totalActual, totalTarget)}%`,
                  backgroundColor: totalActual >= totalTarget && totalTarget > 0 ? 'var(--green)' : 'var(--lime)',
                }}
              />
            </div>
          </div>

          {/* Per-agent breakdown — allocation as % of total */}
          {budget && activeAgents.map(agent => {
            const actual = getAgentActual(agent.id)
            const target = getAgentTarget(agent.id)
            const exceeded = actual >= target && target > 0
            const allocPct = totalTarget > 0 ? (target / totalTarget) * 100 : 0

            return (
              <div key={agent.id} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="avatar" style={{ backgroundColor: agent.color, width: 22, height: 22, fontSize: 8 }}>
                      {agent.initials}
                    </div>
                    <span style={{ fontSize: 13 }}>{agent.full_name}</span>
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: 'var(--gl)' }}>
                      {formatEur(actual)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      className="form-input"
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      defaultValue={allocPct > 0 ? parseFloat(allocPct.toFixed(1)) : ''}
                      onBlur={e => {
                        const pctVal = parseFloat(e.target.value) || 0
                        const eurVal = Math.round(totalTarget * pctVal / 100 * 100) / 100
                        handleSaveAllocation(agent.id, toEurStr(eurVal))
                      }}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                      style={{ width: 70, padding: '2px 6px', fontSize: 12, fontFamily: "'Montserrat', sans-serif", textAlign: 'right' }}
                      placeholder="0"
                    />
                    <span style={{ fontSize: 11, color: 'var(--g)' }}>%</span>
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: 'var(--gl)', minWidth: 80, textAlign: 'right' }}>
                      {target > 0 ? formatEur(target) : '—'}
                    </span>
                    <span style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontSize: 11, fontWeight: 600, minWidth: 36, textAlign: 'right',
                      color: exceeded ? 'var(--green)' : 'var(--g)',
                    }}>
                      {exceeded && '✓ '}{pctLabel(actual, target)}
                    </span>
                  </div>
                </div>
                <div className="progress-bar" style={{ height: 5 }}>
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${pct(actual, target)}%`,
                      backgroundColor: exceeded ? 'var(--green)' : agent.color,
                    }}
                  />
                </div>
              </div>
            )
          })}

          {/* Allocation total check */}
          {budget && allocations.length > 0 && (() => {
            const allocTotal = allocations.reduce((s, a) => s + a.allocated_target, 0)
            const allocPctTotal = totalTarget > 0 ? ((allocTotal / totalTarget) * 100).toFixed(0) : '0'
            const diff = totalTarget - allocTotal
            return diff !== 0 ? (
              <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 8, fontFamily: "'Montserrat', sans-serif" }}>
                Allocato: {allocPctTotal}% ({formatEur(allocTotal)} / {formatEur(totalTarget)}) — {diff > 0 ? `mancano ${formatEur(diff)}` : `eccedenza ${formatEur(-diff)}`}
              </div>
            ) : null
          })()}
        </>
      )}
    </div>
  )
}
