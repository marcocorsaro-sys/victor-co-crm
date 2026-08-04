import { useState, useEffect, useMemo } from 'react'
import type { Operation, Profile } from '../lib/supabase'
import { calculateCommissions, toEurInput, parseEurInput } from '../lib/calculations'
import CommissionSummary from './CommissionSummary'

type Props = {
  open: boolean
  onClose: () => void
  onSave: (data: Partial<Operation>) => void
  initial?: Operation | null
  agentId?: string
  agentProfile?: Profile | null
  agents?: Profile[]
}

export default function OpModal({ open, onClose, onSave, initial, agentId, agentProfile, agents }: Props) {
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [form, setForm] = useState({
    property_name: '',
    address: '',
    type: 'vendita' as 'vendita' | 'locazione',
    origin: 'agente' as 'agente' | 'agenzia' | 'valutazione',
    status: 'pipeline' as 'pipeline' | 'proposta_accettata' | 'incassato' | 'terminato',
    property_value: '',
    comm_pct_seller: '3',
    comm_pct_buyer: '3',
    comm_mode_seller: 'pct' as 'pct' | 'fixed',
    comm_mode_buyer: 'pct' as 'pct' | 'fixed',
    comm_fixed_seller: '',
    comm_fixed_buyer: '',
    sale_date: '',
    final_value: '',
    notes: '',
    buyers: [{ first_name: '', last_name: '' }] as Array<{ first_name: string; last_name: string }>,
    sellers: [{ first_name: '', last_name: '' }] as Array<{ first_name: string; last_name: string }>,
    collaborator_type: 'none' as 'none' | 'internal' | 'external',
    collaborator_id: '',
    collaborator_first_name: '',
    collaborator_last_name: '',
    collaborator_comm_pct: '',
    mandate_start_date: '',
    mandate_end_date: '',
    commission_collected_seller: '',
    commission_collected_buyer: '',
    collection_date_seller: '',
    collection_date_buyer: '',
    sale_probability: '' as '' | '30' | '60' | '90',
    publish_to_website: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const isCompleted = form.status === 'incassato'
  const isEditing = !!initial

  const effectiveAgentProfile = useMemo(() => {
    if (agentProfile) return agentProfile
    if (agents && selectedAgentId) return agents.find(a => a.id === selectedAgentId) || null
    return null
  }, [agentProfile, agents, selectedAgentId])

  const effectiveAgentId = agentId || selectedAgentId

  useEffect(() => {
    if (initial) {
      setSelectedAgentId(initial.agent_id)
      const hasCollab = !!(initial.collaborator_id || initial.collaborator_name)
      setForm({
        property_name: initial.property_name,
        address: initial.address || '',
        type: initial.type,
        origin: initial.origin,
        status: initial.status,
        property_value: initial.property_value ? toEurInput(initial.property_value) : '',
        comm_pct_seller: initial.comm_pct_seller.toString(),
        comm_pct_buyer: initial.comm_pct_buyer.toString(),
        comm_mode_seller: initial.comm_mode_seller || 'pct',
        comm_mode_buyer: initial.comm_mode_buyer || 'pct',
        comm_fixed_seller: initial.comm_fixed_seller ? toEurInput(initial.comm_fixed_seller) : '',
        comm_fixed_buyer: initial.comm_fixed_buyer ? toEurInput(initial.comm_fixed_buyer) : '',
        sale_date: initial.sale_date || '',
        final_value: initial.final_value ? toEurInput(initial.final_value) : '',
        notes: initial.notes || '',
        buyers: (initial.buyers && initial.buyers.length > 0)
          ? initial.buyers
          : (initial.buyer_first_name || initial.buyer_last_name)
            ? [{ first_name: initial.buyer_first_name || '', last_name: initial.buyer_last_name || '' }]
            : [{ first_name: '', last_name: '' }],
        sellers: (initial.sellers && initial.sellers.length > 0)
          ? initial.sellers
          : [{ first_name: '', last_name: '' }],
        collaborator_type: hasCollab ? (initial.collaborator_id ? 'internal' : 'external') : 'none',
        collaborator_id: initial.collaborator_id || '',
        collaborator_first_name: initial.collaborator_first_name || '',
        collaborator_last_name: initial.collaborator_last_name || '',
        collaborator_comm_pct: initial.collaborator_comm_pct ? initial.collaborator_comm_pct.toString() : '',
        mandate_start_date: initial.mandate_start_date || '',
        mandate_end_date: initial.mandate_end_date || '',
        // Fallback: operazioni legacy hanno solo commission_collected → mostrala come quota venditore
        commission_collected_seller: initial.commission_collected_seller != null
          ? toEurInput(initial.commission_collected_seller)
          : (initial.commission_collected_buyer == null && initial.commission_collected != null
              ? toEurInput(initial.commission_collected) : ''),
        commission_collected_buyer: initial.commission_collected_buyer != null
          ? toEurInput(initial.commission_collected_buyer) : '',
        collection_date_seller: initial.collection_date_seller || initial.collection_date || '',
        collection_date_buyer: initial.collection_date_buyer || '',
        sale_probability: initial.sale_probability ? initial.sale_probability.toString() as '30' | '60' | '90' : '',
        publish_to_website: (initial as Record<string, unknown>).publish_to_website as boolean || false,
      })
    } else {
      setSelectedAgentId(agentId || '')
      setForm({
        property_name: '',
        address: '',
        type: 'vendita',
        origin: 'agente',
        status: 'pipeline',
        property_value: '',
        comm_pct_seller: '3',
        comm_pct_buyer: '3',
        comm_mode_seller: 'pct',
        comm_mode_buyer: 'pct',
        comm_fixed_seller: '',
        comm_fixed_buyer: '',
        sale_date: '',
        final_value: '',
        notes: '',
        buyers: [{ first_name: '', last_name: '' }],
        sellers: [{ first_name: '', last_name: '' }],
        collaborator_type: 'none',
        collaborator_id: '',
        collaborator_first_name: '',
        collaborator_last_name: '',
        collaborator_comm_pct: '',
        mandate_start_date: '',
        mandate_end_date: '',
        commission_collected_seller: '',
        commission_collected_buyer: '',
        collection_date_seller: '',
        collection_date_buyer: '',
        sale_probability: '',
        publish_to_website: false,
      })
    }
    setErrors({})
  }, [initial, open, agentId])

  if (!open) return null

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.property_name.trim()) errs.property_name = 'Campo obbligatorio'
    if (agents && !effectiveAgentId) errs.agent = 'Seleziona un agente'
    if (isCompleted) {
      if (!form.sale_date) errs.sale_date = 'Campo obbligatorio'
      if (!form.final_value || parseEurInput(form.final_value) <= 0) errs.final_value = 'Campo obbligatorio'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const fv = parseEurInput(form.final_value)
  const cs = parseFloat(form.comm_pct_seller) || 0
  const cb = parseFloat(form.comm_pct_buyer) || 0
  const collabPct = parseFloat(form.collaborator_comm_pct) || 0

  const commOpts = {
    commModeSeller: form.comm_mode_seller,
    commModeBuyer: form.comm_mode_buyer,
    commFixedSeller: parseEurInput(form.comm_fixed_seller),
    commFixedBuyer: parseEurInput(form.comm_fixed_buyer),
    collaboratorCommPct: collabPct,
  }

  const commResult = isCompleted && effectiveAgentProfile
    ? calculateCommissions(fv, cs, cb, form.origin, effectiveAgentProfile.comm_pct_agency, effectiveAgentProfile.comm_pct_agent, commOpts)
    : null

  const collabLabel = form.collaborator_type === 'internal'
    ? agents?.find(a => a.id === form.collaborator_id)?.full_name
    : (form.collaborator_first_name || form.collaborator_last_name ? `${form.collaborator_first_name} ${form.collaborator_last_name}`.trim() : undefined)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    const data: Partial<Operation> = {
      agent_id: effectiveAgentId,
      property_name: form.property_name.trim(),
      address: form.address.trim() || null,
      type: form.type,
      origin: form.origin,
      status: form.status,
      property_value: form.property_value ? parseEurInput(form.property_value) : null,
      comm_pct_seller: parseFloat(form.comm_pct_seller) || 3,
      comm_pct_buyer: parseFloat(form.comm_pct_buyer) || 3,
      comm_mode_seller: form.comm_mode_seller,
      comm_mode_buyer: form.comm_mode_buyer,
      comm_fixed_seller: parseEurInput(form.comm_fixed_seller),
      comm_fixed_buyer: parseEurInput(form.comm_fixed_buyer),
      notes: form.notes.trim() || null,
      // Multi-acquirenti / multi-venditori (filtra entry vuote)
      buyers: form.buyers
        .map(b => ({ first_name: b.first_name.trim(), last_name: b.last_name.trim() }))
        .filter(b => b.first_name || b.last_name),
      sellers: form.sellers
        .map(s => ({ first_name: s.first_name.trim(), last_name: s.last_name.trim() }))
        .filter(s => s.first_name || s.last_name),
      // Legacy single buyer (per retrocompatibilità: primo della lista)
      buyer_first_name: form.buyers[0]?.first_name.trim() || null,
      buyer_last_name: form.buyers[0]?.last_name.trim() || null,
      collaborator_id: form.collaborator_type === 'internal' && form.collaborator_id ? form.collaborator_id : null,
      collaborator_first_name: form.collaborator_type === 'external' && form.collaborator_first_name.trim() ? form.collaborator_first_name.trim() : null,
      collaborator_last_name: form.collaborator_type === 'external' && form.collaborator_last_name.trim() ? form.collaborator_last_name.trim() : null,
      collaborator_comm_pct: collabPct,
      mandate_start_date: form.mandate_start_date || null,
      mandate_end_date: form.mandate_end_date || null,
      sale_probability: form.sale_probability ? parseInt(form.sale_probability) as 30 | 60 | 90 : null,
      publish_to_website: form.publish_to_website,
    }

    if (isCompleted) {
      data.sale_date = form.sale_date
      data.final_value = fv
      if (commResult) {
        data.gross_commission = commResult.grossCommission
        data.agent_commission = commResult.agentCommission
        data.collaborator_commission = commResult.collaboratorCommission
      }
      const ccSeller = form.commission_collected_seller ? parseEurInput(form.commission_collected_seller) : null
      const ccBuyer = form.commission_collected_buyer ? parseEurInput(form.commission_collected_buyer) : null
      data.commission_collected_seller = ccSeller
      data.commission_collected_buyer = ccBuyer
      data.collection_date_seller = form.collection_date_seller || null
      data.collection_date_buyer = form.collection_date_buyer || null
      data.commission_collected = ccSeller != null || ccBuyer != null ? (ccSeller || 0) + (ccBuyer || 0) : null
      data.collection_date = form.collection_date_seller || form.collection_date_buyer || null
    } else {
      data.sale_date = null
      data.final_value = null
      data.gross_commission = null
      data.agent_commission = null
      data.collaborator_commission = null
      data.commission_collected_seller = null
      data.commission_collected_buyer = null
      data.collection_date_seller = null
      data.collection_date_buyer = null
      data.commission_collected = null
      data.collection_date = null
      data.commission_collected_seller = null
      data.commission_collected_buyer = null
      data.collection_date_seller = null
      data.collection_date_buyer = null
    }

    onSave(data)
  }

  const set = (key: string, val: string) => {
    setForm(prev => ({ ...prev, [key]: val }))
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: '' }))
  }

  const sectionStyle = { borderTop: '1px solid var(--bd)', margin: '16px 0', paddingTop: 16 }
  const sectionLabel = (text: string) => (
    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--ld)', textTransform: 'uppercase' as const, marginBottom: 12, letterSpacing: '0.5px' }}>
      // {text}
    </div>
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-title">{isEditing ? 'Modifica Operazione' : 'Nuova Operazione'}</div>
        <form onSubmit={handleSubmit}>

          {/* ─── Agent selector (admin mode only) ─── */}
          {agents && (
            <div className="form-group">
              <label className="form-label">Agente *</label>
              <select
                className={`form-select ${errors.agent ? 'error' : ''}`}
                value={selectedAgentId}
                onChange={e => {
                  setSelectedAgentId(e.target.value)
                  if (errors.agent) setErrors(prev => ({ ...prev, agent: '' }))
                }}
              >
                <option value="">Seleziona agente...</option>
                {agents.filter(a => a.active).map(a => (
                  <option key={a.id} value={a.id}>{a.full_name}</option>
                ))}
              </select>
              {errors.agent && <div className="form-error">{errors.agent}</div>}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Immobile *</label>
            <input
              className={`form-input ${errors.property_name ? 'error' : ''}`}
              value={form.property_name}
              onChange={e => set('property_name', e.target.value)}
              placeholder="Nome immobile"
            />
            {errors.property_name && <div className="form-error">{errors.property_name}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Indirizzo</label>
            <input
              className="form-input"
              value={form.address}
              onChange={e => set('address', e.target.value)}
              placeholder="Via, numero, città"
            />
          </div>

          {/* ─── Venditori (multi) ─── */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="form-label" style={{ margin: 0 }}>Venditori</label>
              <button type="button" className="btn btn-secondary btn-sm"
                onClick={() => setForm(prev => ({ ...prev, sellers: [...prev.sellers, { first_name: '', last_name: '' }] }))}
                style={{ fontSize: 11 }}>
                + Aggiungi venditore
              </button>
            </div>
            {form.sellers.map((s, idx) => (
              <div key={idx} className="form-row" style={{ marginBottom: 6, alignItems: 'flex-end' }}>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <input className="form-input" value={s.first_name}
                    onChange={e => setForm(prev => ({
                      ...prev,
                      sellers: prev.sellers.map((it, i) => i === idx ? { ...it, first_name: e.target.value } : it)
                    }))}
                    placeholder="Nome" />
                </div>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <input className="form-input" value={s.last_name}
                    onChange={e => setForm(prev => ({
                      ...prev,
                      sellers: prev.sellers.map((it, i) => i === idx ? { ...it, last_name: e.target.value } : it)
                    }))}
                    placeholder="Cognome" />
                </div>
                {form.sellers.length > 1 && (
                  <button type="button" className="btn btn-danger btn-sm"
                    onClick={() => setForm(prev => ({ ...prev, sellers: prev.sellers.filter((_, i) => i !== idx) }))}
                    style={{ fontSize: 11, padding: '6px 10px' }}>
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* ─── Acquirenti (multi) ─── */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="form-label" style={{ margin: 0 }}>Acquirenti</label>
              <button type="button" className="btn btn-secondary btn-sm"
                onClick={() => setForm(prev => ({ ...prev, buyers: [...prev.buyers, { first_name: '', last_name: '' }] }))}
                style={{ fontSize: 11 }}>
                + Aggiungi acquirente
              </button>
            </div>
            {form.buyers.map((b, idx) => (
              <div key={idx} className="form-row" style={{ marginBottom: 6, alignItems: 'flex-end' }}>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <input className="form-input" value={b.first_name}
                    onChange={e => setForm(prev => ({
                      ...prev,
                      buyers: prev.buyers.map((it, i) => i === idx ? { ...it, first_name: e.target.value } : it)
                    }))}
                    placeholder="Nome" />
                </div>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <input className="form-input" value={b.last_name}
                    onChange={e => setForm(prev => ({
                      ...prev,
                      buyers: prev.buyers.map((it, i) => i === idx ? { ...it, last_name: e.target.value } : it)
                    }))}
                    placeholder="Cognome" />
                </div>
                {form.buyers.length > 1 && (
                  <button type="button" className="btn btn-danger btn-sm"
                    onClick={() => setForm(prev => ({ ...prev, buyers: prev.buyers.filter((_, i) => i !== idx) }))}
                    style={{ fontSize: 11, padding: '6px 10px' }}>
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select className="form-select" value={form.type} onChange={e => set('type', e.target.value)}>
                <option value="vendita">Vendita</option>
                <option value="locazione">Locazione</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Origine</label>
              <select className="form-select" value={form.origin} onChange={e => set('origin', e.target.value)}>
                <option value="agente">Agente</option>
                <option value="agenzia">Agenzia</option>
              </select>
            </div>
          </div>

          {isEditing && (
            <div className="form-group">
              <label className="form-label">Stato</label>
              <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="pipeline">Pipeline</option>
                <option value="proposta_accettata">Proposta accettata</option>
              <option value="incassato">Incassato</option>
              <option value="terminato">Terminato</option>
              </select>
            </div>
          )}

          {/* ─── Probabilità vendita (solo pipeline) ─── */}
          {!isCompleted && (
            <div className="form-group">
              <label className="form-label">Probabilità di vendita</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['30', '60', '90'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => set('sale_probability', form.sale_probability === p ? '' : p)}
                    style={{
                      flex: 1,
                      padding: '8px 0',
                      borderRadius: 8,
                      border: `2px solid ${form.sale_probability === p
                        ? p === '30' ? 'var(--red)' : p === '60' ? 'var(--amber)' : 'var(--green)'
                        : 'var(--bd)'}`,
                      background: form.sale_probability === p
                        ? p === '30' ? 'rgba(239,68,68,0.15)' : p === '60' ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)'
                        : 'var(--bg2)',
                      color: form.sale_probability === p
                        ? p === '30' ? 'var(--red)' : p === '60' ? 'var(--amber)' : 'var(--green)'
                        : 'var(--g)',
                      cursor: 'pointer',
                      fontWeight: form.sale_probability === p ? 700 : 400,
                      fontSize: 14,
                      transition: 'all 0.15s',
                    }}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Valore stimato (EUR)</label>
            <input
              className="form-input"
              type="text"
              inputMode="decimal"
              value={form.property_value}
              onChange={e => set('property_value', e.target.value)}
              onFocus={e => { const n = parseEurInput(e.target.value); if (n) e.target.value = String(n) }}
              onBlur={e => { const n = parseEurInput(e.target.value); set('property_value', n ? toEurInput(n) : '') }}
              placeholder="0,00"
            />
          </div>

          {/* ─── Commissioni venditore ─── */}
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Comm. venditore</label>
              <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                <button type="button"
                  onClick={() => set('comm_mode_seller', 'pct')}
                  style={{ flex: 1, padding: '6px 8px', fontSize: 11, fontWeight: 600, borderRadius: 6,
                    border: '1px solid var(--bd)', cursor: 'pointer',
                    background: form.comm_mode_seller === 'pct' ? 'var(--lime)' : 'var(--s3)',
                    color: form.comm_mode_seller === 'pct' ? 'var(--bg)' : 'var(--gl)' }}>
                  Percentuale (%)
                </button>
                <button type="button"
                  onClick={() => set('comm_mode_seller', 'fixed')}
                  style={{ flex: 1, padding: '6px 8px', fontSize: 11, fontWeight: 600, borderRadius: 6,
                    border: '1px solid var(--bd)', cursor: 'pointer',
                    background: form.comm_mode_seller === 'fixed' ? 'var(--lime)' : 'var(--s3)',
                    color: form.comm_mode_seller === 'fixed' ? 'var(--bg)' : 'var(--gl)' }}>
                  Fisso (€)
                </button>
              </div>
              {form.comm_mode_seller === 'pct' ? (
                <input className="form-input" type="number" step="0.01" min="0" max="100"
                  value={form.comm_pct_seller} onChange={e => set('comm_pct_seller', e.target.value)}
                  placeholder="es. 3" />
              ) : (
                <input className="form-input" type="text" inputMode="decimal"
                  value={form.comm_fixed_seller} onChange={e => set('comm_fixed_seller', e.target.value)}
                  onFocus={e => { const n = parseEurInput(e.target.value); if (n) e.target.value = String(n) }}
                  onBlur={e => { const n = parseEurInput(e.target.value); set('comm_fixed_seller', n ? toEurInput(n) : '') }}
                  placeholder="es. 8.000,00" />
              )}
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Comm. acquirente</label>
              <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                <button type="button"
                  onClick={() => set('comm_mode_buyer', 'pct')}
                  style={{ flex: 1, padding: '6px 8px', fontSize: 11, fontWeight: 600, borderRadius: 6,
                    border: '1px solid var(--bd)', cursor: 'pointer',
                    background: form.comm_mode_buyer === 'pct' ? 'var(--lime)' : 'var(--s3)',
                    color: form.comm_mode_buyer === 'pct' ? 'var(--bg)' : 'var(--gl)' }}>
                  Percentuale (%)
                </button>
                <button type="button"
                  onClick={() => set('comm_mode_buyer', 'fixed')}
                  style={{ flex: 1, padding: '6px 8px', fontSize: 11, fontWeight: 600, borderRadius: 6,
                    border: '1px solid var(--bd)', cursor: 'pointer',
                    background: form.comm_mode_buyer === 'fixed' ? 'var(--lime)' : 'var(--s3)',
                    color: form.comm_mode_buyer === 'fixed' ? 'var(--bg)' : 'var(--gl)' }}>
                  Fisso (€)
                </button>
              </div>
              {form.comm_mode_buyer === 'pct' ? (
                <input className="form-input" type="number" step="0.01" min="0" max="100"
                  value={form.comm_pct_buyer} onChange={e => set('comm_pct_buyer', e.target.value)}
                  placeholder="es. 3" />
              ) : (
                <input className="form-input" type="text" inputMode="decimal"
                  value={form.comm_fixed_buyer} onChange={e => set('comm_fixed_buyer', e.target.value)}
                  onFocus={e => { const n = parseEurInput(e.target.value); if (n) e.target.value = String(n) }}
                  onBlur={e => { const n = parseEurInput(e.target.value); set('comm_fixed_buyer', n ? toEurInput(n) : '') }}
                  placeholder="es. 8.000,00" />
              )}
            </div>
          </div>

          {/* ─── Date incarico ─── */}
          <div style={sectionStyle}>
            {sectionLabel('Incarico')}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Data inizio incarico</label>
              <input className="form-input" type="date" value={form.mandate_start_date}
                onChange={e => set('mandate_start_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Data fine incarico</label>
              <input className="form-input" type="date" value={form.mandate_end_date}
                onChange={e => set('mandate_end_date', e.target.value)} />
            </div>
          </div>

          {/* ─── Collaboratore ─── */}
          <div style={sectionStyle}>
            {sectionLabel('Collaboratore')}
          </div>
          <div className="form-group">
            <label className="form-label">Tipo collaboratore</label>
            <select className="form-select" value={form.collaborator_type}
              onChange={e => set('collaborator_type', e.target.value)}>
              <option value="none">Nessuno</option>
              <option value="internal">Agente interno</option>
              <option value="external">Agente esterno</option>
            </select>
          </div>

          {form.collaborator_type === 'internal' && (
            <div className="form-group">
              <label className="form-label">Agente collaboratore</label>
              <select className="form-select" value={form.collaborator_id}
                onChange={e => set('collaborator_id', e.target.value)}>
                <option value="">Seleziona...</option>
                {(agents || []).filter(a => a.active && a.id !== effectiveAgentId).map(a => (
                  <option key={a.id} value={a.id}>{a.full_name}</option>
                ))}
              </select>
            </div>
          )}

          {form.collaborator_type === 'external' && (
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nome collaboratore</label>
                <input className="form-input" value={form.collaborator_first_name}
                  onChange={e => set('collaborator_first_name', e.target.value)}
                  placeholder="Nome" />
              </div>
              <div className="form-group">
                <label className="form-label">Cognome collaboratore</label>
                <input className="form-input" value={form.collaborator_last_name}
                  onChange={e => set('collaborator_last_name', e.target.value)}
                  placeholder="Cognome" />
              </div>
            </div>
          )}

          {form.collaborator_type !== 'none' && (
            <div className="form-group">
              <label className="form-label">% provvigione collaboratore (su lordo)</label>
              <input className="form-input" type="number" step="0.1" min="0" max="100"
                value={form.collaborator_comm_pct}
                onChange={e => set('collaborator_comm_pct', e.target.value)}
                placeholder="es. 20" />
            </div>
          )}

          {/* ─── Dati chiusura ─── */}
          {isCompleted && (
            <>
              <div style={sectionStyle}>
                {sectionLabel('Dati Chiusura')}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Data chiusura *</label>
                  <input
                    className={`form-input ${errors.sale_date ? 'error' : ''}`}
                    type="date"
                    value={form.sale_date}
                    onChange={e => set('sale_date', e.target.value)}
                  />
                  {errors.sale_date && <div className="form-error">{errors.sale_date}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Valore finale (EUR) *</label>
                  <input
                    className={`form-input ${errors.final_value ? 'error' : ''}`}
                    type="text"
                    inputMode="decimal"
                    value={form.final_value}
                    onChange={e => set('final_value', e.target.value)}
                    onFocus={e => { const n = parseEurInput(e.target.value); if (n) e.target.value = String(n) }}
                    onBlur={e => { const n = parseEurInput(e.target.value); set('final_value', n ? toEurInput(n) : '') }}
                    placeholder="0,00"
                  />
                  {errors.final_value && <div className="form-error">{errors.final_value}</div>}
                </div>
              </div>

              {effectiveAgentProfile && (
                <CommissionSummary
                  finalValue={fv}
                  commPctSeller={cs}
                  commPctBuyer={cb}
                  origin={form.origin}
                  agentCommPctAgency={effectiveAgentProfile.comm_pct_agency}
                  agentCommPctAgent={effectiveAgentProfile.comm_pct_agent}
                  opts={commOpts}
                  collaboratorLabel={collabLabel}
                />
              )}

              {/* Provvigioni incassate split */}
              <div style={{ ...sectionStyle, marginTop: 12 }}>
                {sectionLabel('Provvigioni Incassate')}
              </div>
              <div style={{ fontSize: 11, color: 'var(--g)', marginBottom: 8 }}>
                Inserisci separatamente venditore e acquirente — possono avere date di incasso diverse.
              </div>

              {/* Venditore */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Importo incassato vend. (EUR)</label>
                  <input className="form-input" type="text" inputMode="decimal"
                    value={form.commission_collected_seller}
                    onChange={e => set('commission_collected_seller', e.target.value)}
                    onFocus={e => { const n = parseEurInput(e.target.value); if (n) e.target.value = String(n) }}
                    onBlur={e => { const n = parseEurInput(e.target.value); set('commission_collected_seller', n ? toEurInput(n) : '') }}
                    placeholder="0,00" />
                </div>
                <div className="form-group">
                  <label className="form-label">Data incasso vend.</label>
                  <input className="form-input" type="date" value={form.collection_date_seller}
                    onChange={e => set('collection_date_seller', e.target.value)} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Importo incassato acq. (EUR)</label>
                  <input className="form-input" type="text" inputMode="decimal"
                    value={form.commission_collected_buyer}
                    onChange={e => set('commission_collected_buyer', e.target.value)}
                    onFocus={e => { const n = parseEurInput(e.target.value); if (n) e.target.value = String(n) }}
                    onBlur={e => { const n = parseEurInput(e.target.value); set('commission_collected_buyer', n ? toEurInput(n) : '') }}
                    placeholder="0,00" />
                </div>
                <div className="form-group">
                  <label className="form-label">Data incasso acq.</label>
                  <input className="form-input" type="date" value={form.collection_date_buyer}
                    onChange={e => set('collection_date_buyer', e.target.value)} />
                </div>
              </div>

              {/* Acquirente */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Incasso da acquirente (EUR)</label>
                  <input className="form-input" type="text" inputMode="decimal"
                    value={form.commission_collected_buyer}
                    onChange={e => set('commission_collected_buyer', e.target.value)}
                    onFocus={e => { const n = parseEurInput(e.target.value); if (n) e.target.value = String(n) }}
                    onBlur={e => { const n = parseEurInput(e.target.value); set('commission_collected_buyer', n ? toEurInput(n) : '') }}
                    placeholder="0,00" />
                </div>
                <div className="form-group">
                  <label className="form-label">Data incasso acquirente</label>
                  <input className="form-input" type="date" value={form.collection_date_buyer}
                    onChange={e => set('collection_date_buyer', e.target.value)} />
                </div>
              </div>

              {/* Totale calcolato */}
              {(form.commission_collected_seller || form.commission_collected_buyer) && (
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--gl)', textAlign: 'right', marginTop: 4 }}>
                  Totale incassato: <span style={{ color: 'var(--green)', fontWeight: 600 }}>
                    {toEurInput((parseEurInput(form.commission_collected_seller) || 0) + (parseEurInput(form.commission_collected_buyer) || 0))} EUR
                  </span>
                </div>
              )}
            </>
          )}

          <div className="form-group">
            <label className="form-label">Note</label>
            <textarea
              className="form-textarea"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Note opzionali..."
            />
          </div>

          {/* Publish to website toggle */}
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderTop: '1px solid var(--s2)' }}>
            <input
              type="checkbox"
              id="publish_to_website"
              checked={form.publish_to_website}
              onChange={e => setForm(prev => ({ ...prev, publish_to_website: e.target.checked }))}
              style={{ width: 18, height: 18, accentColor: 'var(--lime)' }}
            />
            <label htmlFor="publish_to_website" style={{ cursor: 'pointer', fontSize: 14, fontWeight: 500, color: form.publish_to_website ? 'var(--lime)' : 'var(--g)' }}>
              Pubblica sul sito web
            </label>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Annulla</button>
            <button type="submit" className="btn btn-primary">
              {isEditing ? 'Salva modifiche' : 'Aggiungi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
