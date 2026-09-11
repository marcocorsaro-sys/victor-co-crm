import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/supabase'
import { useProfiles } from '../hooks/useProfiles'
import { createUser, updateAgentEmail, resetAgentPassword } from '../lib/adminApi'
import UserModal from '../components/UserModal'
import ToastContainer from '../components/ToastContainer'
import { useToast } from '../hooks/useToast'

type ActionModal = {
  type: 'email' | 'password'
  user: Profile
} | null

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghkmnpqrstuvwxyz23456789'
  let pw = ''
  for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)]
  return pw
}

export default function AdminUsers() {
  const { profiles, loading, refetch } = useProfiles()
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [actionModal, setActionModal] = useState<ActionModal>(null)
  const [actionValue, setActionValue] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const { toasts, addToast } = useToast()

  const admins = profiles.filter(p => p.role === 'admin')
  const agents = profiles.filter(p => p.role === 'agent')

  /* ─── Create user via Edge Function ─── */
  const handleCreate = async (data: {
    first_name: string
    last_name: string
    email?: string
    password?: string
    role?: 'admin' | 'agent'
    color: string
    comm_pct_agency: number
    comm_pct_agent: number
  }) => {
    if (!data.email || !data.password) return

    try {
      await createUser({
        email: data.email,
        password: data.password,
        first_name: data.first_name,
        last_name: data.last_name,
        role: data.role || 'agent',
        color: data.color,
        comm_pct_agency: data.comm_pct_agency,
        comm_pct_agent: data.comm_pct_agent,
      })
      const label = data.role === 'admin' ? 'Amministratore' : 'Agente'
      addToast(`${label} creato con successo`, 'success')
      setShowModal(false)
      refetch()
    } catch (err) {
      addToast((err as Error).message || 'Errore nella creazione', 'error')
    }
  }

  /* ─── Update profile (direct Supabase, no service key needed) ─── */
  const handleUpdate = async (data: {
    first_name: string
    last_name: string
    color: string
    comm_pct_agency: number
    comm_pct_agent: number
    phone?: string | null
    display_email?: string | null
    personal_address?: string | null
    codice_fiscale?: string | null
    iban?: string | null
    contract_start_date?: string | null
    contract_type?: string | null
    profile_notes?: string | null
  }) => {
    if (!editingUser) return

    const initials = ((data.first_name[0] || '') + (data.last_name[0] || '')).toUpperCase() || 'U'

    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: data.first_name,
        last_name: data.last_name,
        initials,
        color: data.color,
        comm_pct_agency: data.comm_pct_agency,
        comm_pct_agent: data.comm_pct_agent,
        phone: data.phone,
        display_email: data.display_email,
        personal_address: data.personal_address,
        codice_fiscale: data.codice_fiscale,
        iban: data.iban,
        contract_start_date: data.contract_start_date,
        contract_type: data.contract_type,
        profile_notes: data.profile_notes,
      })
      .eq('id', editingUser.id)

    if (error) {
      addToast('Errore nella modifica', 'error')
    } else {
      addToast('Utente modificato', 'success')
      setEditingUser(null)
      setShowModal(false)
      refetch()
    }
  }

  const handleToggleActive = async (profile: Profile) => {
    const { error } = await supabase
      .from('profiles')
      .update({ active: !profile.active })
      .eq('id', profile.id)

    if (error) {
      addToast('Errore', 'error')
    } else {
      addToast(profile.active ? 'Utente disattivato' : 'Utente riattivato', 'success')
      refetch()
    }
  }

  /* ─── Email / Password action handlers ─── */
  const handleActionSubmit = async () => {
    if (!actionModal || !actionValue.trim()) return
    setActionLoading(true)

    try {
      if (actionModal.type === 'email') {
        await updateAgentEmail(actionModal.user.id, actionValue.trim())
        addToast(`Email aggiornata per ${actionModal.user.full_name}`, 'success')
      } else {
        await resetAgentPassword(actionModal.user.id, actionValue.trim())
        addToast(`Nuova password per ${actionModal.user.full_name}: ${actionValue.trim()}`, 'success')
      }
      setActionModal(null)
      setActionValue('')
    } catch (err) {
      addToast((err as Error).message || 'Errore', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const openEmailAction = (user: Profile) => {
    setActionModal({ type: 'email', user })
    setActionValue('')
  }

  const openPasswordAction = (user: Profile) => {
    setActionModal({ type: 'password', user })
    setActionValue(generatePassword())
  }

  /* ─── Render a user row ─── */
  const renderUserRow = (user: Profile) => (
    <tr key={user.id} style={{ opacity: user.active ? 1 : 0.5 }}>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="avatar" style={{ backgroundColor: user.color }}>
            {user.initials}
          </div>
          <div>
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              {user.full_name}
              {user.role === 'agent' && (!user.codice_fiscale || !user.iban) && (
                <span title="Anagrafica incompleta" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--amber)', display: 'inline-block', flexShrink: 0 }} />
              )}
            </div>
          </div>
        </div>
      </td>
      <td>
        <span className={`role-badge ${user.role}`}>
          {user.role === 'admin' ? 'ADMIN' : 'AGENT'}
        </span>
      </td>
      <td>
        <span
          className={`badge ${user.active ? 'badge-completata' : ''}`}
          style={!user.active ? { background: 'rgba(192,57,43,0.15)', color: 'var(--red)' } : {}}
        >
          {user.active ? 'ATTIVO' : 'DISATTIVATO'}
        </span>
      </td>
      <td style={{ fontFamily: "'Montserrat', sans-serif" }}>
        {user.role === 'agent' ? `${user.comm_pct_agency}%` : '—'}
      </td>
      <td style={{ fontFamily: "'Montserrat', sans-serif" }}>
        {user.role === 'agent' ? `${user.comm_pct_agent}%` : '—'}
      </td>
      <td>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => { setEditingUser(user); setShowModal(true) }}>
            ✎ Profilo
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => openEmailAction(user)}>
            ✉ Email
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => openPasswordAction(user)}>
            🔑 Password
          </button>
          <button
            className={`btn btn-sm ${user.active ? 'btn-danger' : 'btn-success'}`}
            onClick={() => handleToggleActive(user)}
          >
            {user.active ? 'Disattiva' : 'Riattiva'}
          </button>
        </div>
      </td>
    </tr>
  )

  return (
    <div>
      <ToastContainer toasts={toasts} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="section-heading" style={{ margin: 0 }}>Gestione Utenti</div>
        <button className="btn btn-primary" onClick={() => { setEditingUser(null); setShowModal(true) }}>
          + Nuovo Utente
        </button>
      </div>

      {/* ─── Administrators ─── */}
      <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: 'var(--ld)', textTransform: 'uppercase', marginBottom: 10, letterSpacing: '0.5px' }}>
        // Amministratori ({admins.length})
      </div>
      <div className="table-wrap" style={{ marginBottom: 32 }}>
        <table>
          <thead>
            <tr>
              <th>Utente</th>
              <th>Ruolo</th>
              <th>Stato</th>
              <th>% Agenzia</th>
              <th>% Agente</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6}><div className="skeleton skeleton-row" /></td></tr>
            ) : admins.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--g)', padding: 24 }}>Nessun amministratore</td></tr>
            ) : (
              admins.map(renderUserRow)
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Agents ─── */}
      <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: 'var(--ld)', textTransform: 'uppercase', marginBottom: 10, letterSpacing: '0.5px' }}>
        // Agenti ({agents.length})
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Utente</th>
              <th>Ruolo</th>
              <th>Stato</th>
              <th>% Agenzia</th>
              <th>% Agente</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}><td colSpan={6}><div className="skeleton skeleton-row" /></td></tr>
              ))
            ) : agents.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--g)', padding: 24 }}>Nessun agente</td></tr>
            ) : (
              agents.map(renderUserRow)
            )}
          </tbody>
        </table>
      </div>

      {/* ─── User create/edit modal ─── */}
      <UserModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditingUser(null) }}
        onSave={editingUser ? handleUpdate : handleCreate}
        initial={editingUser}
      />

      {/* ─── Email / Password action modal ─── */}
      {actionModal && (
        <div className="modal-overlay" onClick={() => { setActionModal(null); setActionValue('') }}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              {actionModal.type === 'email'
                ? `Cambia email — ${actionModal.user.full_name}`
                : `Reset password — ${actionModal.user.full_name}`
              }
            </div>

            <div className="form-group">
              <label className="form-label">
                {actionModal.type === 'email' ? 'Nuova email *' : 'Nuova password *'}
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  type={actionModal.type === 'email' ? 'email' : 'text'}
                  value={actionValue}
                  onChange={e => setActionValue(e.target.value)}
                  placeholder={actionModal.type === 'email' ? 'nuova@victorco.it' : 'Min. 6 caratteri'}
                  autoFocus
                />
                {actionModal.type === 'password' && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setActionValue(generatePassword())}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    Genera
                  </button>
                )}
              </div>
            </div>

            {actionModal.type === 'password' && actionValue && (
              <div style={{
                background: 'var(--s1)',
                borderRadius: 8,
                padding: '10px 14px',
                fontFamily: "'Montserrat', sans-serif",
                fontSize: 14,
                color: 'var(--ld)',
                marginBottom: 16,
                letterSpacing: '1px',
              }}>
                {actionValue}
              </div>
            )}

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setActionModal(null); setActionValue('') }}
              >
                Annulla
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={actionLoading || !actionValue.trim() || (actionModal.type === 'password' && actionValue.trim().length < 6)}
                onClick={handleActionSubmit}
              >
                {actionLoading ? 'Salvando...' : 'Conferma'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
