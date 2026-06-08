import { useState, useEffect } from 'react'
import type { Client, Profile } from '../lib/supabase'
import { CLIENT_SEGMENT_LABELS, CLIENT_CHANNEL_LABELS } from '../lib/supabase'
import { formatDate } from '../lib/calculations'
import { birthDateFromCodiceFiscale } from '../lib/codiceFiscale'

type Props = {
  open: boolean
  onClose: () => void
  onSave: (data: Partial<Client>) => void
  initial?: Client | null
  agents?: Profile[]
}

const TYPE_LABELS: Record<Client['type'], string> = {
  acquirente: 'Acquirente',
  venditore: 'Venditore',
  entrambi: 'Entrambi',
}

const SOURCE_OPTIONS = [
  { value: '', label: 'Seleziona...' },
  { value: 'passaparola', label: 'Passaparola' },
  { value: 'web', label: 'Sito web' },
  { value: 'social', label: 'Social media' },
  { value: 'portale', label: 'Portale immobiliare' },
  { value: 'walk-in', label: 'Walk-in agenzia' },
  { value: 'evento', label: 'Evento / Open House' },
  { value: 'altro', label: 'Altro' },
]

export default function ClientModal({ open, onClose, onSave, initial, agents }: Props) {
  const emptyForm = {
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    type: 'acquirente' as Client['type'],
    address: '',
    notes: '',
    birth_date: '',
    company: '',
    source: '',
    linked_agent_id: '',
    codice_fiscale: '',
    // Relazione & dialogo periodico
    segment: '' as Client['segment'] | '',
    tier: '' as Client['tier'] | '',
    preferred_channel: '' as Client['preferred_channel'] | '',
    rogito_date: '',
    contact_cadence_months: '12',
    last_contact_at: '',
    snooze_until: '',
    do_not_contact: false,
  }
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const isEditing = !!initial

  useEffect(() => {
    if (initial) {
      setForm({
        first_name: initial.first_name || '',
        last_name: initial.last_name || '',
        phone: initial.phone || '',
        email: initial.email || '',
        type: initial.type,
        address: initial.address || '',
        notes: initial.notes || '',
        birth_date: initial.birth_date || '',
        company: initial.company || '',
        source: initial.source || '',
        linked_agent_id: initial.linked_agent_id || '',
        codice_fiscale: initial.codice_fiscale || '',
        segment: initial.segment || '',
        tier: initial.tier || '',
        preferred_channel: initial.preferred_channel || '',
        rogito_date: initial.rogito_date || '',
        contact_cadence_months: String(initial.contact_cadence_months ?? 12),
        last_contact_at: initial.last_contact_at ? initial.last_contact_at.slice(0, 10) : '',
        snooze_until: initial.snooze_until || '',
        do_not_contact: !!initial.do_not_contact,
      })
    } else {
      setForm(emptyForm)
    }
    setErrors({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, open])

  if (!open) return null

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.first_name.trim()) errs.first_name = 'Campo obbligatorio'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    onSave({
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      type: form.type,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
      birth_date: form.birth_date || null,
      company: form.company.trim() || null,
      source: form.source || null,
      linked_agent_id: form.linked_agent_id || null,
      codice_fiscale: form.codice_fiscale.trim().toUpperCase() || null,
      segment: form.segment || null,
      tier: form.tier || null,
      preferred_channel: form.preferred_channel || null,
      rogito_date: form.rogito_date || null,
      contact_cadence_months: parseInt(form.contact_cadence_months, 10) || 12,
      last_contact_at: form.last_contact_at || null,
      snooze_until: form.snooze_until || null,
      do_not_contact: form.do_not_contact,
    })
  }

  const set = (key: string, val: string | boolean) => {
    setForm(prev => ({ ...prev, [key]: val }))
    if (typeof val === 'string' && errors[key]) setErrors(prev => ({ ...prev, [key]: '' }))
  }

  const deriveBirthDate = () => {
    const d = birthDateFromCodiceFiscale(form.codice_fiscale)
    if (d) set('birth_date', d)
    else setErrors(prev => ({ ...prev, codice_fiscale: 'Codice fiscale non valido' }))
  }

  const mono = { fontFamily: "'JetBrains Mono', monospace" }
  const sectionLabel = (text: string) => (
    <div style={{ ...mono, fontSize: 11, color: 'var(--ld)', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 12, marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--bd)' }}>
      // {text}
    </div>
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-title">
          {isEditing ? 'Modifica Cliente' : 'Nuovo Cliente'}
        </div>

        {/* ─── Existing data summary when editing ─── */}
        {isEditing && initial && (
          <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: 14, marginBottom: 16, border: '1px solid var(--bd)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 700, color: 'var(--w)', fontSize: 15 }}>{initial.name}</div>
              <span className={`badge badge-${initial.type === 'acquirente' ? 'pipeline' : initial.type === 'venditore' ? 'vendita' : 'completata'}`}>
                {TYPE_LABELS[initial.type]}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 12 }}>
              {initial.phone && <div style={{ color: 'var(--g)' }}>Tel: <span style={{ color: 'var(--gl)' }}>{initial.phone}</span></div>}
              {initial.email && <div style={{ color: 'var(--g)' }}>Email: <span style={{ color: 'var(--gl)' }}>{initial.email}</span></div>}
              {initial.birth_date && <div style={{ color: 'var(--g)' }}>Nato: <span style={{ color: 'var(--gl)' }}>{formatDate(initial.birth_date)}</span></div>}
              {initial.company && <div style={{ color: 'var(--g)' }}>Azienda: <span style={{ color: 'var(--gl)' }}>{initial.company}</span></div>}
            </div>
            <div style={{ fontSize: 10, color: 'var(--g)', marginTop: 6 }}>Inserito il {formatDate(initial.date_added)}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {sectionLabel('Anagrafica')}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nome *</label>
              <input className={`form-input ${errors.first_name ? 'error' : ''}`}
                value={form.first_name} onChange={e => set('first_name', e.target.value)}
                placeholder="Nome" autoFocus />
              {errors.first_name && <div className="form-error">{errors.first_name}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Cognome</label>
              <input className="form-input" value={form.last_name}
                onChange={e => set('last_name', e.target.value)} placeholder="Cognome o ragione sociale" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Data di nascita</label>
              <input className="form-input" type="date" value={form.birth_date}
                onChange={e => set('birth_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Azienda</label>
              <input className="form-input" value={form.company}
                onChange={e => set('company', e.target.value)} placeholder="Ragione sociale" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Codice fiscale</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className={`form-input ${errors.codice_fiscale ? 'error' : ''}`}
                value={form.codice_fiscale}
                onChange={e => set('codice_fiscale', e.target.value.toUpperCase())}
                placeholder="RSSMRA85M01H501Z" maxLength={16}
                style={{ flex: 1, fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase' }} />
              <button type="button" className="btn btn-secondary btn-sm"
                onClick={deriveBirthDate} disabled={form.codice_fiscale.trim().length !== 16}
                title="Compila la data di nascita dal codice fiscale"
                style={{ whiteSpace: 'nowrap' }}>
                ↓ Compleanno
              </button>
            </div>
            {errors.codice_fiscale && <div className="form-error">{errors.codice_fiscale}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Tipo *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['acquirente', 'venditore', 'entrambi'] as const).map(t => (
                <button key={t} type="button" onClick={() => set('type', t)} style={{
                  flex: 1, padding: '8px 0', borderRadius: 8,
                  border: `2px solid ${form.type === t ? 'var(--lime)' : 'var(--bd)'}`,
                  background: form.type === t ? 'rgba(190,227,39,0.1)' : 'var(--bg2)',
                  color: form.type === t ? 'var(--lime)' : 'var(--g)',
                  cursor: 'pointer', fontWeight: form.type === t ? 700 : 400, fontSize: 13, transition: 'all 0.15s',
                }}>{TYPE_LABELS[t]}</button>
              ))}
            </div>
          </div>

          {sectionLabel('Contatti')}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Telefono</label>
              <input className="form-input" value={form.phone} onChange={e => set('phone', e.target.value)}
                placeholder="+39 ..." type="tel" />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={form.email}
                onChange={e => set('email', e.target.value)} placeholder="email@esempio.it" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Indirizzo</label>
            <input className="form-input" value={form.address}
              onChange={e => set('address', e.target.value)} placeholder="Via, CAP, Citta'" />
          </div>

          {sectionLabel('Provenienza')}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Come ci ha conosciuto</label>
              <select className="form-select" value={form.source} onChange={e => set('source', e.target.value)}>
                {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {agents && (
              <div className="form-group">
                <label className="form-label">Agente referente</label>
                <select className="form-select" value={form.linked_agent_id}
                  onChange={e => set('linked_agent_id', e.target.value)}>
                  <option value="">Nessuno</option>
                  {agents.filter(a => a.active).map(a => (
                    <option key={a.id} value={a.id}>{a.full_name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {sectionLabel('Relazione & Contatto periodico')}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Segmento</label>
              <select className="form-select" value={form.segment || ''}
                onChange={e => set('segment', e.target.value)}>
                <option value="">Non assegnato</option>
                {(Object.keys(CLIENT_SEGMENT_LABELS) as Array<keyof typeof CLIENT_SEGMENT_LABELS>).map(s => (
                  <option key={s} value={s}>{CLIENT_SEGMENT_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Priorità (tier)</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['A', 'B', 'C'] as const).map(t => (
                  <button key={t} type="button" onClick={() => set('tier', form.tier === t ? '' : t)} style={{
                    flex: 1, padding: '8px 0', borderRadius: 8,
                    border: `2px solid ${form.tier === t ? 'var(--lime)' : 'var(--bd)'}`,
                    background: form.tier === t ? 'rgba(190,227,39,0.1)' : 'var(--bg2)',
                    color: form.tier === t ? 'var(--lime)' : 'var(--g)',
                    cursor: 'pointer', fontWeight: form.tier === t ? 700 : 400, fontSize: 13, transition: 'all 0.15s',
                  }}>{t}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Canale preferito</label>
              <select className="form-select" value={form.preferred_channel || ''}
                onChange={e => set('preferred_channel', e.target.value)}>
                <option value="">Nessuna preferenza</option>
                {(Object.keys(CLIENT_CHANNEL_LABELS) as Array<keyof typeof CLIENT_CHANNEL_LABELS>).map(c => (
                  <option key={c} value={c}>{CLIENT_CHANNEL_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Cadenza contatto (mesi)</label>
              <input className="form-input" type="number" min={1} max={60}
                value={form.contact_cadence_months}
                onChange={e => set('contact_cadence_months', e.target.value)}
                style={{ fontFamily: "'JetBrains Mono', monospace" }} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Ultimo contatto</label>
              <input className="form-input" type="date" value={form.last_contact_at}
                onChange={e => set('last_contact_at', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Data rogito</label>
              <input className="form-input" type="date" value={form.rogito_date}
                onChange={e => set('rogito_date', e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Posticipa fino al</label>
              <input className="form-input" type="date" value={form.snooze_until}
                onChange={e => set('snooze_until', e.target.value)} />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--gl)', paddingBottom: 10 }}>
                <input type="checkbox" checked={form.do_not_contact}
                  onChange={e => set('do_not_contact', e.target.checked)} />
                Escludi dal dialogo periodico
              </label>
            </div>
          </div>

          {sectionLabel('Note')}
          <div className="form-group">
            <textarea className="form-textarea" rows={3} value={form.notes}
              onChange={e => set('notes', e.target.value)} placeholder="Note interne sul cliente..."
              style={{ resize: 'vertical' }} />
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Annulla</button>
            <button type="submit" className="btn btn-primary">
              {isEditing ? 'Salva modifiche' : 'Crea cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
