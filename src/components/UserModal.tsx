import { useState, useEffect } from 'react'
import type { Profile } from '../lib/supabase'

const COLOR_PRESETS = ['#3b82f6', '#8b5cf6', '#f97316', '#ef4444', '#10b981', 'var(--amber)']

type SaveData = {
  first_name: string
  last_name: string
  email?: string
  password?: string
  role?: 'admin' | 'agent'
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
}

type Props = {
  open: boolean
  onClose: () => void
  onSave: (data: SaveData) => void
  initial?: Profile | null
}

export default function UserModal({ open, onClose, onSave, initial }: Props) {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    role: 'agent' as 'admin' | 'agent',
    color: COLOR_PRESETS[0],
    comm_pct_agency: '20',
    comm_pct_agent: '50',
    phone: '',
    display_email: '',
    personal_address: '',
    codice_fiscale: '',
    iban: '',
    contract_start_date: '',
    contract_type: '',
    profile_notes: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (initial) {
      setForm({
        first_name: initial.first_name || '',
        last_name: initial.last_name || '',
        email: '',
        password: '',
        role: initial.role,
        color: initial.color,
        comm_pct_agency: initial.comm_pct_agency.toString(),
        comm_pct_agent: initial.comm_pct_agent.toString(),
        phone: initial.phone || '',
        display_email: initial.display_email || '',
        personal_address: initial.personal_address || '',
        codice_fiscale: initial.codice_fiscale || '',
        iban: initial.iban || '',
        contract_start_date: initial.contract_start_date || '',
        contract_type: initial.contract_type || '',
        profile_notes: initial.profile_notes || '',
      })
    } else {
      setForm({
        first_name: '', last_name: '', email: '', password: '',
        role: 'agent', color: COLOR_PRESETS[0],
        comm_pct_agency: '20', comm_pct_agent: '50',
        phone: '', display_email: '', personal_address: '',
        codice_fiscale: '', iban: '', contract_start_date: '', contract_type: '', profile_notes: '',
      })
    }
    setErrors({})
  }, [initial, open])

  if (!open) return null

  const isAgent = form.role === 'agent'
  const isEditing = !!initial

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.first_name.trim()) errs.first_name = 'Campo obbligatorio'
    if (!form.last_name.trim()) errs.last_name = 'Campo obbligatorio'
    if (!isEditing) {
      if (!form.email.trim()) errs.email = 'Campo obbligatorio'
      if (!form.password || form.password.length < 6) errs.password = 'Min. 6 caratteri'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    const data: SaveData = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      ...(!isEditing ? { email: form.email.trim(), password: form.password, role: form.role } : {}),
      color: form.color,
      comm_pct_agency: isAgent ? (parseFloat(form.comm_pct_agency) || 20) : 0,
      comm_pct_agent: isAgent ? (parseFloat(form.comm_pct_agent) || 50) : 0,
    }

    if (isEditing) {
      data.phone = form.phone.trim() || null
      data.display_email = form.display_email.trim() || null
      data.personal_address = form.personal_address.trim() || null
      data.codice_fiscale = form.codice_fiscale.trim() || null
      data.iban = form.iban.trim() || null
      data.contract_start_date = form.contract_start_date || null
      data.contract_type = form.contract_type.trim() || null
      data.profile_notes = form.profile_notes.trim() || null
    }

    onSave(data)
  }

  const set = (key: string, val: string) => {
    setForm(prev => ({ ...prev, [key]: val }))
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: '' }))
  }

  const mono = { fontFamily: "'Montserrat', sans-serif" }
  const roleLabel = isAgent ? 'Agente' : 'Amministratore'

  const sectionLabel = (text: string) => (
    <div style={{
      ...mono, fontSize: 11, color: 'var(--ld)',
      textTransform: 'uppercase' as const, letterSpacing: '0.5px',
      margin: '16px 0 12px', paddingTop: 12, borderTop: '1px solid var(--bd)',
    }}>
      // {text}
    </div>
  )

  const infoItem = (label: string, value: string | null | undefined) => (
    value ? (
      <div style={{ fontSize: 12, color: 'var(--g)' }}>
        {label}: <span style={{ color: 'var(--gl)' }}>{value}</span>
      </div>
    ) : null
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">
          {isEditing ? `Modifica ${roleLabel}` : 'Nuovo Utente'}
        </div>

        {/* ─── Existing data summary when editing ─── */}
        {isEditing && initial && (
          <div style={{
            background: 'var(--bg2)',
            borderRadius: 10,
            padding: 14,
            marginBottom: 16,
            border: '1px solid var(--bd)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div className="avatar" style={{ backgroundColor: initial.color, width: 36, height: 36, fontSize: 13 }}>
                {initial.initials}
              </div>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--w)', fontSize: 15 }}>{initial.full_name}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                  <span className={`role-badge ${initial.role}`}>{initial.role === 'admin' ? 'ADMIN' : 'AGENT'}</span>
                  <span className={`badge ${initial.active ? 'badge-completata' : ''}`}
                    style={!initial.active ? { background: 'rgba(192,57,43,0.15)', color: 'var(--red)' } : {}}>
                    {initial.active ? 'ATTIVO' : 'DISATTIVATO'}
                  </span>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              {infoItem('Tel', initial.phone)}
              {infoItem('Email', initial.display_email)}
              {infoItem('Indirizzo', initial.personal_address)}
              {infoItem('CF', initial.codice_fiscale)}
              {infoItem('IBAN', initial.iban)}
              {infoItem('Contratto', initial.contract_type)}
              {initial.role === 'agent' && (
                <div style={{ fontSize: 12, color: 'var(--g)' }}>
                  Provvigioni: <span style={{ ...mono, color: 'var(--lime)' }}>{initial.comm_pct_agency}% / {initial.comm_pct_agent}%</span>
                </div>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Role selector — only on creation */}
          {!isEditing && (
            <div className="form-group">
              <label className="form-label">Ruolo *</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['agent', 'admin'] as const).map(r => (
                  <button key={r} type="button" onClick={() => set('role', r)} style={{
                    flex: 1, padding: '8px 0', borderRadius: 8,
                    border: `2px solid ${form.role === r ? 'var(--lime)' : 'var(--bd)'}`,
                    background: form.role === r ? 'rgba(13,52,71,0.1)' : 'var(--bg2)',
                    color: form.role === r ? 'var(--lime)' : 'var(--g)',
                    cursor: 'pointer', fontWeight: form.role === r ? 700 : 400, fontSize: 13, transition: 'all 0.15s',
                  }}>
                    {r === 'agent' ? 'Agente' : 'Amministratore'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {sectionLabel('Identità')}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nome *</label>
              <input className={`form-input ${errors.first_name ? 'error' : ''}`}
                value={form.first_name} onChange={e => set('first_name', e.target.value)}
                placeholder="Nome" autoFocus />
              {errors.first_name && <div className="form-error">{errors.first_name}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Cognome *</label>
              <input className={`form-input ${errors.last_name ? 'error' : ''}`}
                value={form.last_name} onChange={e => set('last_name', e.target.value)}
                placeholder="Cognome" />
              {errors.last_name && <div className="form-error">{errors.last_name}</div>}
            </div>
          </div>

          {!isEditing && (
            <>
              <div className="form-group">
                <label className="form-label">Email login *</label>
                <input className={`form-input ${errors.email ? 'error' : ''}`} type="email"
                  value={form.email} onChange={e => set('email', e.target.value)}
                  placeholder="email@victorco.it" />
                {errors.email && <div className="form-error">{errors.email}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Password temporanea *</label>
                <input className={`form-input ${errors.password ? 'error' : ''}`} type="password"
                  value={form.password} onChange={e => set('password', e.target.value)}
                  placeholder="Min. 6 caratteri" />
                {errors.password && <div className="form-error">{errors.password}</div>}
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">Colore avatar</label>
            <div className="color-picker-row">
              {COLOR_PRESETS.map(c => (
                <div key={c} className={`color-swatch ${form.color === c ? 'active' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setForm(prev => ({ ...prev, color: c }))} />
              ))}
            </div>
          </div>

          {/* Commission fields — only for agents */}
          {isAgent && (
            <>
              {sectionLabel('Provvigioni')}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">% su ops agenzia</label>
                  <div style={{ position: 'relative' }}>
                    <input className="form-input" type="number" step="0.01" min="0" max="100"
                      value={form.comm_pct_agency} onChange={e => set('comm_pct_agency', e.target.value)}
                      style={{ ...mono, paddingRight: 30 }} />
                    <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--g)', fontSize: 13 }}>%</span>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">% su ops agente</label>
                  <div style={{ position: 'relative' }}>
                    <input className="form-input" type="number" step="0.01" min="0" max="100"
                      value={form.comm_pct_agent} onChange={e => set('comm_pct_agent', e.target.value)}
                      style={{ ...mono, paddingRight: 30 }} />
                    <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--g)', fontSize: 13 }}>%</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ─── Anagrafica section — only when editing ─── */}
          {isEditing && (
            <>
              {sectionLabel('Contatti')}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Telefono</label>
                  <input className="form-input" value={form.phone} onChange={e => set('phone', e.target.value)}
                    placeholder="+39 ..." type="tel" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email di contatto</label>
                  <input className="form-input" type="email" value={form.display_email}
                    onChange={e => set('display_email', e.target.value)}
                    placeholder="contatto@email.it" />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Indirizzo</label>
                <input className="form-input" value={form.personal_address}
                  onChange={e => set('personal_address', e.target.value)}
                  placeholder="Via, CAP, Citta'" />
              </div>

              {sectionLabel('Dati Fiscali')}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Codice Fiscale</label>
                  <input className="form-input" value={form.codice_fiscale}
                    onChange={e => set('codice_fiscale', e.target.value.toUpperCase())}
                    placeholder="RSSMRA85..." maxLength={16}
                    style={{ ...mono, textTransform: 'uppercase' }} />
                </div>
                <div className="form-group">
                  <label className="form-label">IBAN</label>
                  <input className="form-input" value={form.iban}
                    onChange={e => set('iban', e.target.value.toUpperCase())}
                    placeholder="IT60X..." maxLength={34}
                    style={{ ...mono, textTransform: 'uppercase' }} />
                </div>
              </div>

              {sectionLabel('Contratto')}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Data inizio</label>
                  <input className="form-input" type="date" value={form.contract_start_date}
                    onChange={e => set('contract_start_date', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Tipo contratto</label>
                  <input className="form-input" value={form.contract_type}
                    onChange={e => set('contract_type', e.target.value)}
                    placeholder="Partita IVA, Dipendente..." />
                </div>
              </div>

              {sectionLabel('Note')}
              <div className="form-group">
                <textarea className="form-textarea" rows={2}
                  value={form.profile_notes} onChange={e => set('profile_notes', e.target.value)}
                  placeholder="Note interne..." style={{ resize: 'vertical' }} />
              </div>
            </>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Annulla</button>
            <button type="submit" className="btn btn-primary">
              {isEditing ? 'Salva modifiche' : `Crea ${roleLabel.toLowerCase()}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
