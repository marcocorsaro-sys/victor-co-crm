import { useState } from 'react'
import { useActivityStats } from '../hooks/useActivityStats'
import type { ActivityLog } from '../hooks/useActivityStats'
import { useProfiles } from '../hooks/useProfiles'
import { formatDateTime } from '../lib/calculations'

const ACTION_LABELS: Record<string, string> = {
  login: 'Login',
  page_view: 'Visualizzazione pagina',
  operation_created: 'Operazione creata',
  operation_edited: 'Operazione modificata',
  operation_closed: 'Operazione chiusa',
  operation_deleted: 'Operazione eliminata',
  client_created: 'Cliente creato',
  client_edited: 'Cliente modificato',
  client_deleted: 'Cliente eliminato',
}

const ACTION_COLORS: Record<string, string> = {
  login: 'var(--green)',
  page_view: 'var(--g)',
  operation_created: 'var(--lime)',
  operation_edited: 'var(--teal)',
  operation_closed: 'var(--amber)',
  operation_deleted: 'var(--red)',
  client_created: 'var(--lime)',
  client_edited: 'var(--teal)',
  client_deleted: 'var(--red)',
}

export default function AdminActivity() {
  const { logs, stats, loading } = useActivityStats()
  const { profiles } = useProfiles()
  const [fAgent, setFAgent] = useState('')
  const [fAction, setFAction] = useState('')

  const agents = profiles.filter(p => p.role === 'agent')
  const getAgentName = (id: string) => profiles.find(p => p.id === id)?.full_name || 'Sconosciuto'
  const getAgentColor = (id: string) => profiles.find(p => p.id === id)?.color || 'var(--g)'
  const getAgentInitials = (id: string) => profiles.find(p => p.id === id)?.initials || '??'

  const filteredLogs = logs.filter((l: ActivityLog) => {
    if (fAgent && l.agent_id !== fAgent) return false
    if (fAction && l.action_type !== fAction) return false
    return true
  })

  // Summary cards
  const today = new Date().toISOString().split('T')[0]
  const actionsToday = logs.filter(l => l.created_at.startsWith(today)).length
  const activeAgentsToday = new Set(logs.filter(l => l.created_at.startsWith(today)).map(l => l.agent_id)).size

  return (
    <div>
      <div className="section-heading" style={{ marginBottom: 20 }}>Attivita Agenti</div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div className="kpi-card">
          <div className="kpi-value">{actionsToday}</div>
          <div className="kpi-label">Azioni oggi</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{activeAgentsToday}</div>
          <div className="kpi-label">Agenti attivi oggi</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{stats.reduce((s, a) => s + a.actions_7d, 0)}</div>
          <div className="kpi-label">Azioni ultimi 7gg</div>
        </div>
      </div>

      {/* Agent overview table */}
      <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: 'var(--ld)', textTransform: 'uppercase', marginBottom: 10, letterSpacing: '0.5px' }}>
        // Riepilogo Agenti
      </div>
      <div className="table-wrap" style={{ marginBottom: 32 }}>
        <table>
          <thead>
            <tr>
              <th>Agente</th>
              <th>Ultimo login</th>
              <th>Azioni 7gg</th>
              <th>Azioni 30gg</th>
              <th>Ultima azione</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5}><div className="skeleton skeleton-row" /></td></tr>
            ) : agents.map(agent => {
              const s = stats.find(st => st.agent_id === agent.id)
              return (
                <tr key={agent.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="avatar" style={{ backgroundColor: agent.color, width: 28, height: 28, fontSize: 10 }}>
                        {agent.initials}
                      </div>
                      {agent.full_name}
                    </div>
                  </td>
                  <td style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12 }}>
                    {s?.last_login ? formatDateTime(s.last_login) : '—'}
                  </td>
                  <td style={{ fontFamily: "'Montserrat', sans-serif" }}>{s?.actions_7d || 0}</td>
                  <td style={{ fontFamily: "'Montserrat', sans-serif" }}>{s?.actions_30d || 0}</td>
                  <td style={{ fontSize: 12 }}>
                    {s?.last_action_type ? (
                      <span style={{ color: ACTION_COLORS[s.last_action_type] || 'var(--g)' }}>
                        {ACTION_LABELS[s.last_action_type] || s.last_action_type}
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Recent activity log */}
      <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: 'var(--ld)', textTransform: 'uppercase', marginBottom: 10, letterSpacing: '0.5px' }}>
        // Log Attivita Recenti
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <select className="filter-input" value={fAgent} onChange={e => setFAgent(e.target.value)}>
          <option value="">Tutti gli agenti</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
        </select>
        <select className="filter-input" value={fAction} onChange={e => setFAction(e.target.value)}>
          <option value="">Tutte le azioni</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Data/Ora</th>
              <th>Agente</th>
              <th>Azione</th>
              <th>Dettagli</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={4}><div className="skeleton skeleton-row" /></td></tr>
              ))
            ) : filteredLogs.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--g)', padding: 24 }}>Nessuna attivita registrata</td></tr>
            ) : filteredLogs.map((log: ActivityLog) => (
              <tr key={log.id}>
                <td style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, whiteSpace: 'nowrap' }}>
                  {formatDateTime(log.created_at)}
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div className="avatar" style={{ backgroundColor: getAgentColor(log.agent_id), width: 24, height: 24, fontSize: 9 }}>
                      {getAgentInitials(log.agent_id)}
                    </div>
                    {getAgentName(log.agent_id)}
                  </div>
                </td>
                <td>
                  <span style={{ color: ACTION_COLORS[log.action_type] || 'var(--g)', fontWeight: 500 }}>
                    {ACTION_LABELS[log.action_type] || log.action_type}
                  </span>
                </td>
                <td style={{ color: 'var(--g)', fontSize: 12 }}>
                  {log.details && Object.keys(log.details).length > 0
                    ? Object.entries(log.details).map(([k, v]) => `${k}: ${v}`).join(', ')
                    : '—'
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
