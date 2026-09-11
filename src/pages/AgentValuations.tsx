import { useState } from 'react'
import type { Profile, Valutazione } from '../lib/supabase'
import { useValuations } from '../hooks/useValuations'
import { formatEur, formatDate, toEurInput, parseEurInput } from '../lib/calculations'
import KpiCard from '../components/KpiCard'
import ToastContainer from '../components/ToastContainer'
import { useToast } from '../hooks/useToast'

const PROB_LABELS: Record<string, string> = {
  '15_giorni': 'Entro 15 giorni',
  '3_mesi': 'Entro 3 mesi',
  '6_mesi': 'Entro 6 mesi',
}

const PROB_COLORS: Record<string, { color: string; bg: string }> = {
  '15_giorni': { color: 'var(--lime)', bg: 'rgba(13,52,71,0.15)' },
  '3_mesi': { color: 'var(--teal)', bg: 'rgba(31,111,139,0.15)' },
  '6_mesi': { color: 'var(--g)', bg: 'rgba(128,128,128,0.2)' },
}

type Props = { profile: Profile }

export default function AgentValuations({ profile }: Props) {
  const {
    valutazioni, loading, year, setYear,
    createValutazione, updateValutazione, deleteValutazione, setIncaricoPreso,
  } = useValuations(profile.id)
  const { toasts, addToast } = useToast()

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 3 + i)

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Valutazione | null>(null)
  const [fProb, setFProb] = useState('')
  const [fStato, setFStato] = useState('')
  const [search, setSearch] = useState('')

  // KPIs
  const totalYear = valutazioni.length
  const incarichiPresi = valutazioni.filter(v => v.incarico_preso).length
  const tassoConversione = totalYear > 0 ? (incarichiPresi / totalYear * 100) : 0
  const last30 = valutazioni.filter(v => {
    const d = new Date(v.created_at)
    return d >= new Date(Date.now() - 30 * 86400000)
  }).length

  // Filters
  const filtered = valutazioni.filter(v => {
    if (fProb && v.acquisition_probability !== fProb) return false
    if (fStato === 'attive' && v.incarico_preso) return false
    if (fStato === 'incarico' && !v.incarico_preso) return false
    if (search) {
      const q = search.toLowerCase()
      if (!v.owner_name.toLowerCase().includes(q) && !v.address.toLowerCase().includes(q)) return false
    }
    return true
  })

  const handleCreate = async (data: Partial<Valutazione>) => {
    const { error } = await createValutazione(data)
    if (error) addToast('Errore nella creazione', 'error')
    else { addToast('Valutazione creata', 'success'); setShowModal(false) }
  }

  const handleEdit = async (data: Partial<Valutazione>) => {
    if (!editing) return
    const { error } = await updateValutazione(editing.id, data)
    if (error) addToast('Errore nella modifica', 'error')
    else { addToast('Valutazione modificata', 'success'); setEditing(null); setShowModal(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminare questa valutazione?')) return
    const { error } = await deleteValutazione(id)
    if (error) addToast("Errore nell'eliminazione", 'error')
    else addToast('Valutazione eliminata', 'success')
  }

  const handleIncarico = async (v: Valutazione) => {
    if (!confirm(`Confermi di aver acquisito l'incarico per ${v.owner_name}? Verrà creata automaticamente un'operazione in Pipeline.`)) return
    try {
      await setIncaricoPreso(v.id)
      addToast('Incarico creato in Pipeline ✓', 'success')
    } catch {
      addToast("Errore nella conversione", 'error')
    }
  }

  const mono = { fontFamily: "'Montserrat', sans-serif" } as const

  return (
    <div>
      <ToastContainer toasts={toasts} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="section-heading" style={{ margin: 0 }}>Le mie valutazioni</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="filter-select" value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 100 }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => { setEditing(null); setShowModal(true) }}>
            + Nuova Valutazione
          </button>
        </div>
      </div>

      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <KpiCard value={totalYear.toString()} label={`Valutazioni ${year}`} loading={loading} />
        <KpiCard value={incarichiPresi.toString()} label="Incarichi presi" loading={loading} color="green" />
        <KpiCard value={`${tassoConversione.toFixed(0)}%`} label="Tasso conversione" loading={loading} color="teal" />
        <KpiCard value={last30.toString()} label="Ultimi 30 giorni" loading={loading} color="amber" />
      </div>

      {/* Filters */}
      <div className="filters-bar" style={{ marginBottom: 16 }}>
        <input className="filter-input" placeholder="Cerca proprietario, indirizzo..."
          value={search} onChange={e => setSearch(e.target.value)} style={{ minWidth: 240 }} />
        <select className="filter-select" value={fProb} onChange={e => setFProb(e.target.value)}>
          <option value="">Tutte le probabilità</option>
          <option value="15_giorni">Entro 15 giorni</option>
          <option value="3_mesi">Entro 3 mesi</option>
          <option value="6_mesi">Entro 6 mesi</option>
        </select>
        <select className="filter-select" value={fStato} onChange={e => setFStato(e.target.value)}>
          <option value="">Tutti gli stati</option>
          <option value="attive">Solo attive</option>
          <option value="incarico">Solo con incarico</option>
        </select>
      </div>

      {/* Cards grid */}
      {loading ? (
        <div className="op-grid">
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 180, borderRadius: 10 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <p>Nessuna valutazione {search || fProb || fStato ? 'trovata' : 'ancora inserita'}</p>
        </div>
      ) : (
        <div className="op-grid">
          {filtered.map(v => (
            <div key={v.id} className="op-card">
              <div className="op-card-header">
                <div>
                  <div className="op-card-name">{v.owner_name}</div>
                  <div className="op-card-address">{v.address}</div>
                </div>
              </div>

              <div className="op-card-badges">
                <span className={`badge badge-${v.origin || 'agente'}`}>{v.origin || 'agente'}</span>
                {v.acquisition_probability && (
                  <span style={{
                    display: 'inline-block', fontSize: 11, fontWeight: 600,
                    padding: '2px 8px', borderRadius: 6,
                    color: PROB_COLORS[v.acquisition_probability]?.color || 'var(--g)',
                    background: PROB_COLORS[v.acquisition_probability]?.bg || 'rgba(128,128,128,0.15)',
                  }}>
                    {PROB_LABELS[v.acquisition_probability]}
                  </span>
                )}
                {v.valuation_delivered && (
                  <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 6, color: 'var(--teal)', background: 'rgba(31,111,139,0.15)' }}>
                    Consegnata ✓
                  </span>
                )}
                {v.incarico_preso && (
                  <span style={{
                    display: 'inline-block', fontSize: 11, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 6,
                    color: 'var(--green)', background: 'rgba(29,143,95,0.15)',
                  }}>
                    INCARICO ✓
                  </span>
                )}
              </div>

              <div className="op-card-value">
                {v.estimated_price != null ? formatEur(v.estimated_price) : '—'}
              </div>

              <div className="op-card-date">
                Valutazione del {formatDate(v.valuation_date)}
              </div>

              {v.notes && (
                <div style={{ fontSize: 11, color: 'var(--g)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                  {v.notes.length > 80 ? v.notes.substring(0, 80) + '…' : v.notes}
                </div>
              )}

              <div className="op-card-actions" style={{ flexWrap: 'wrap' }}>
                {!v.incarico_preso && (
                  <button className="btn btn-success btn-sm" onClick={() => handleIncarico(v)}>
                    ✓ Incarico
                  </button>
                )}
                {!v.valuation_delivered && !v.incarico_preso && (
                  <button className="btn btn-secondary btn-sm" style={{ fontSize: 10 }}
                    onClick={async () => { await updateValutazione(v.id, { valuation_delivered: true }); }}>
                    Consegnata
                  </button>
                )}
                {!v.incarico_preso && (
                  <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(v); setShowModal(true) }}>
                    Modifica
                  </button>
                )}
                {v.incarico_preso && (
                  <span style={{ ...mono, fontSize: 11, color: 'var(--g)' }}>
                    Convertita il {v.incarico_date ? formatDate(v.incarico_date) : '—'}
                  </span>
                )}
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(v.id)}>
                  Elimina
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <ValuationModal
          initial={editing}
          agentId={profile.id}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSave={editing ? handleEdit : handleCreate}
        />
      )}
    </div>
  )
}

/* ─── Valuation Modal ─── */
function ValuationModal({ initial, agentId, onClose, onSave }: {
  initial: Valutazione | null
  agentId: string
  onClose: () => void
  onSave: (data: Partial<Valutazione>) => void
}) {
  const [form, setForm] = useState({
    owner_name: initial?.owner_name || '',
    address: initial?.address || '',
    valuation_date: initial?.valuation_date || new Date().toISOString().split('T')[0],
    estimated_price: initial?.estimated_price ? toEurInput(initial.estimated_price) : '',
    acquisition_probability: initial?.acquisition_probability || '',
    origin: initial?.origin || 'agente',
    valuation_delivered: initial?.valuation_delivered || false,
    notes: initial?.notes || '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const mono = { fontFamily: "'Montserrat', sans-serif" }

  const set = (key: string, val: string) => {
    setForm(prev => ({ ...prev, [key]: val }))
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: '' }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.owner_name.trim()) errs.owner_name = 'Campo obbligatorio'
    if (!form.address.trim()) errs.address = 'Campo obbligatorio'
    if (!form.valuation_date) errs.valuation_date = 'Campo obbligatorio'
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    onSave({
      agent_id: agentId,
      owner_name: form.owner_name.trim(),
      address: form.address.trim(),
      valuation_date: form.valuation_date,
      estimated_price: form.estimated_price ? parseEurInput(form.estimated_price) : null,
      acquisition_probability: form.acquisition_probability as Valutazione['acquisition_probability'] || null,
      origin: form.origin as 'agente' | 'agenzia',
      valuation_delivered: form.valuation_delivered,
      notes: form.notes.trim() || null,
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <div className="modal-title">{initial ? 'Modifica Valutazione' : 'Nuova Valutazione'}</div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Nome e cognome proprietario *</label>
            <input className={`form-input ${errors.owner_name ? 'error' : ''}`}
              value={form.owner_name} onChange={e => set('owner_name', e.target.value)}
              placeholder="Mario Rossi" autoFocus />
            {errors.owner_name && <div className="form-error">{errors.owner_name}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Indirizzo immobile *</label>
            <input className={`form-input ${errors.address ? 'error' : ''}`}
              value={form.address} onChange={e => set('address', e.target.value)}
              placeholder="Via Roma 15, Milano" />
            {errors.address && <div className="form-error">{errors.address}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Provenienza</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['agente', 'agenzia'] as const).map(o => (
                <button key={o} type="button" onClick={() => setForm(prev => ({ ...prev, origin: o }))}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8,
                    border: `2px solid ${form.origin === o ? 'var(--lime)' : 'var(--bd)'}`,
                    background: form.origin === o ? 'rgba(13,52,71,0.1)' : 'var(--bg2)',
                    color: form.origin === o ? 'var(--lime)' : 'var(--g)',
                    cursor: 'pointer', fontWeight: form.origin === o ? 700 : 400, fontSize: 13, transition: 'all 0.15s',
                  }}>
                  {o.charAt(0).toUpperCase() + o.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Data valutazione *</label>
              <input className={`form-input ${errors.valuation_date ? 'error' : ''}`}
                type="date" value={form.valuation_date}
                onChange={e => set('valuation_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Stima prezzo incarico (EUR)</label>
              <input className="form-input" type="text" inputMode="decimal"
                value={form.estimated_price}
                onChange={e => set('estimated_price', e.target.value)}
                onFocus={e => { const n = parseEurInput(e.target.value); if (n) e.target.value = String(n) }}
                onBlur={e => { const n = parseEurInput(e.target.value); set('estimated_price', n ? toEurInput(n) : '') }}
                placeholder="0,00" style={mono} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Probabilità acquisizione</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { value: '15_giorni', label: '15 giorni', color: 'var(--lime)', bg: 'rgba(13,52,71,0.15)' },
                { value: '3_mesi', label: '3 mesi', color: 'var(--teal)', bg: 'rgba(31,111,139,0.15)' },
                { value: '6_mesi', label: '6 mesi', color: 'var(--g)', bg: 'rgba(128,128,128,0.2)' },
              ].map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => set('acquisition_probability', form.acquisition_probability === opt.value ? '' : opt.value)}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8,
                    border: `2px solid ${form.acquisition_probability === opt.value ? opt.color : 'var(--bd)'}`,
                    background: form.acquisition_probability === opt.value ? opt.bg : 'var(--bg2)',
                    color: form.acquisition_probability === opt.value ? opt.color : 'var(--g)',
                    cursor: 'pointer', fontWeight: form.acquisition_probability === opt.value ? 700 : 400,
                    fontSize: 13, transition: 'all 0.15s',
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
            <input type="checkbox" id="valuation_delivered" checked={form.valuation_delivered}
              onChange={e => setForm(prev => ({ ...prev, valuation_delivered: e.target.checked }))}
              style={{ width: 18, height: 18, accentColor: 'var(--teal)' }} />
            <label htmlFor="valuation_delivered" style={{ cursor: 'pointer', fontSize: 14, fontWeight: 500, color: form.valuation_delivered ? 'var(--teal)' : 'var(--g)' }}>
              Valutazione consegnata
            </label>
          </div>

          <div className="form-group">
            <label className="form-label">Note</label>
            <textarea className="form-textarea" rows={3}
              value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Note sulla valutazione..." style={{ resize: 'vertical' }} />
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Annulla</button>
            <button type="submit" className="btn btn-primary">
              {initial ? 'Salva modifiche' : 'Crea valutazione'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
