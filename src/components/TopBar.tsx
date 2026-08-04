import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import type { Profile } from '../lib/supabase'
import PasswordChangeModal from './PasswordChangeModal'

type Props = {
  profile: Profile
  onLogout: () => void
  viewAsAgent?: Profile | null
  onSwitchView?: (agent: Profile | null) => void
  onExitAgentView?: () => void
  agents?: Profile[]
}

export default function TopBar({ profile, onLogout, viewAsAgent, onSwitchView, onExitAgentView, agents }: Props) {
  const isAdmin = profile.role === 'admin'
  const isImpersonating = !!viewAsAgent
  const [showPwModal, setShowPwModal] = useState(false)

  return (
    <div className="topbar" style={isImpersonating ? { borderBottom: '2px solid var(--amber)' } : undefined}>
      <span className="topbar-logo">// VICTOR&CO · CRM</span>

      <nav className="topbar-nav">
        {isAdmin ? (
          <>
            <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>
              Dashboard
            </NavLink>
            <NavLink to="/admin/operations" className={({ isActive }) => isActive ? 'active' : ''}>
              Operazioni
            </NavLink>
            <NavLink to="/admin/agents" className={({ isActive }) => isActive ? 'active' : ''}>
              Agenti
            </NavLink>
            <NavLink to="/admin/clients" className={({ isActive }) => isActive ? 'active' : ''}>
              Clienti
            </NavLink>
            <NavLink to="/admin/valutazioni" className={({ isActive }) => isActive ? 'active' : ''}>
              Valutazioni
            </NavLink>
            <NavLink to="/admin/intelligence" className={({ isActive }) => isActive ? 'active' : ''}>
              Intelligence
            </NavLink>
            <NavLink to="/admin/weekly" className={({ isActive }) => isActive ? 'active' : ''}>
              Settimane
            </NavLink>
            <NavLink to="/admin/mercato" className={({ isActive }) => isActive ? 'active' : ''}>
              Mercato
            </NavLink>
            <NavLink to="/admin/ai" className={({ isActive }) => isActive ? 'active' : ''} style={{ color: 'var(--lime)' }}>
              AI
            </NavLink>
            <span style={{ color: 'var(--bd)', margin: '0 2px', userSelect: 'none' }}>·</span>
            <NavLink to="/calendar" className={({ isActive }) => isActive ? 'active' : ''}>
              Calendario
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => isActive ? 'active' : ''}>
              Impostazioni
            </NavLink>
          </>
        ) : (
          <>
            <NavLink to="/agent" className={({ isActive }) => isActive ? 'active' : ''}>
              Le mie operazioni
            </NavLink>
            <NavLink to="/agent/valutazioni" className={({ isActive }) => isActive ? 'active' : ''}>
              Valutazioni
            </NavLink>
            <NavLink to="/agent/clients" className={({ isActive }) => isActive ? 'active' : ''}>
              Clienti
            </NavLink>
            <NavLink to="/calendar" className={({ isActive }) => isActive ? 'active' : ''}>
              Calendario
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => isActive ? 'active' : ''}>
              Impostazioni
            </NavLink>
          </>
        )}
      </nav>

      <div className="topbar-right">
        {/* Admin → Agent switch */}
        {onSwitchView && agents && !isImpersonating && (
          <select
            className="filter-select"
            value=""
            onChange={e => {
              const agent = agents.find(a => a.id === e.target.value)
              if (agent) onSwitchView(agent)
            }}
            style={{ width: 'auto', minWidth: 130, fontSize: 11, padding: '4px 8px', background: 'var(--s1)', border: '1px solid var(--bd)', color: 'var(--g)' }}
            title="Visualizza come agente"
          >
            <option value="">Vedi come agente...</option>
            {agents.filter(a => a.active).map(a => (
              <option key={a.id} value={a.id}>{a.full_name}</option>
            ))}
          </select>
        )}

        {/* Exit agent view button */}
        {isImpersonating && onExitAgentView && (
          <button
            className="btn btn-sm"
            onClick={onExitAgentView}
            style={{ fontSize: 11, background: 'var(--amber)', color: '#000', fontWeight: 600, borderRadius: 6, padding: '4px 10px' }}
          >
            ← Admin
          </button>
        )}

        <div className="user-info">
          <div className="avatar" style={{ backgroundColor: profile.color }}>
            {profile.initials}
          </div>
          <span className="name">{profile.full_name}</span>
          <span className={`role-badge ${profile.role}`}>{profile.role}</span>
        </div>
        <button className="btn-logout" onClick={onLogout}>Esci</button>
      </div>

      <PasswordChangeModal
        open={showPwModal}
        onClose={() => setShowPwModal(false)}
      />
    </div>
  )
}
