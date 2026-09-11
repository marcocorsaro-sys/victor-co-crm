import { useState, useEffect } from 'react'
import type { Operation, Profile } from '../lib/supabase'
import { calculateCommissions, toEurInput, parseEurInput } from '../lib/calculations'
import CommissionSummary from './CommissionSummary'

type Props = {
  open: boolean
  onClose: () => void
  onConfirm: (data: Partial<Operation>) => void
  operation: Operation | null
  agentProfile: Profile | null
}

export default function CloseModal({ open, onClose, onConfirm, operation, agentProfile }: Props) {
  const [saleDate, setSaleDate] = useState('')
  const [finalValue, setFinalValue] = useState('')
  const [commPctSeller, setCommPctSeller] = useState('3')
  const [commPctBuyer, setCommPctBuyer] = useState('3')
  const [commModeSeller, setCommModeSeller] = useState<'pct' | 'fixed'>('pct')
  const [commModeBuyer, setCommModeBuyer] = useState<'pct' | 'fixed'>('pct')
  const [commFixedSeller, setCommFixedSeller] = useState('')
  const [commFixedBuyer, setCommFixedBuyer] = useState('')
  const [buyerFirstName, setBuyerFirstName] = useState('')
  const [buyerLastName, setBuyerLastName] = useState('')
  const [commissionCollectedSeller, setCommissionCollectedSeller] = useState('')
  const [commissionCollectedBuyer, setCommissionCollectedBuyer] = useState('')
  const [collectionDateSeller, setCollectionDateSeller] = useState('')
  const [collectionDateBuyer, setCollectionDateBuyer] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (operation) {
      setSaleDate(new Date().toISOString().split('T')[0])
      setFinalValue(operation.property_value ? toEurInput(operation.property_value) : '')
      setCommPctSeller(operation.comm_pct_seller.toString())
      setCommPctBuyer(operation.comm_pct_buyer.toString())
      setCommModeSeller(operation.comm_mode_seller || 'pct')
      setCommModeBuyer(operation.comm_mode_buyer || 'pct')
      setCommFixedSeller(operation.comm_fixed_seller ? toEurInput(operation.comm_fixed_seller) : '')
      setCommFixedBuyer(operation.comm_fixed_buyer ? toEurInput(operation.comm_fixed_buyer) : '')
      setBuyerFirstName(operation.buyer_first_name || '')
      setBuyerLastName(operation.buyer_last_name || '')
      setCommissionCollectedSeller('')
      setCommissionCollectedBuyer('')
      setCollectionDateSeller('')
      setCollectionDateBuyer('')
    }
    setErrors({})
  }, [operation, open])

  if (!open || !operation || !agentProfile) return null

  const fv = parseEurInput(finalValue)
  const cs = parseFloat(commPctSeller) || 0
  const cb = parseFloat(commPctBuyer) || 0

  const commOpts = {
    commModeSeller,
    commModeBuyer,
    commFixedSeller: parseEurInput(commFixedSeller),
    commFixedBuyer: parseEurInput(commFixedBuyer),
    collaboratorCommPct: operation.collaborator_comm_pct || 0,
  }

  const result = calculateCommissions(
    fv, cs, cb, operation.origin,
    agentProfile.comm_pct_agency, agentProfile.comm_pct_agent,
    commOpts
  )

  const collabLabel = operation.collaborator_id
    ? undefined // Name resolved by parent
    : operation.collaborator_name || undefined

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!saleDate) errs.saleDate = 'Campo obbligatorio'
    if (!finalValue || parseEurInput(finalValue) <= 0) errs.finalValue = 'Campo obbligatorio'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    const ccSeller = commissionCollectedSeller ? parseEurInput(commissionCollectedSeller) : null
    const ccBuyer = commissionCollectedBuyer ? parseEurInput(commissionCollectedBuyer) : null

    onConfirm({
      status: 'incassato',
      sale_date: saleDate,
      final_value: fv,
      comm_pct_seller: cs,
      comm_pct_buyer: cb,
      comm_mode_seller: commModeSeller,
      comm_mode_buyer: commModeBuyer,
      comm_fixed_seller: parseEurInput(commFixedSeller),
      comm_fixed_buyer: parseEurInput(commFixedBuyer),
      gross_commission: result.grossCommission,
      agent_commission: result.agentCommission,
      collaborator_commission: result.collaboratorCommission,
      buyer_first_name: buyerFirstName.trim() || null,
      buyer_last_name: buyerLastName.trim() || null,
      commission_collected_seller: ccSeller,
      commission_collected_buyer: ccBuyer,
      collection_date_seller: collectionDateSeller || null,
      collection_date_buyer: collectionDateBuyer || null,
      commission_collected: ccSeller != null || ccBuyer != null ? (ccSeller || 0) + (ccBuyer || 0) : null,
      collection_date: collectionDateSeller || collectionDateBuyer || null,
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-title">Chiudi Operazione</div>
        <p style={{ color: 'var(--gl)', fontSize: 13, marginBottom: 16 }}>
          {operation.property_name}
          {operation.address && ` — ${operation.address}`}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nome acquirente</label>
              <input className="form-input" value={buyerFirstName}
                onChange={e => setBuyerFirstName(e.target.value)} placeholder="Nome" />
            </div>
            <div className="form-group">
              <label className="form-label">Cognome acquirente</label>
              <input className="form-input" value={buyerLastName}
                onChange={e => setBuyerLastName(e.target.value)} placeholder="Cognome" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Data chiusura *</label>
            <input
              className={`form-input ${errors.saleDate ? 'error' : ''}`}
              type="date" value={saleDate}
              onChange={e => { setSaleDate(e.target.value); setErrors(p => ({ ...p, saleDate: '' })) }}
            />
            {errors.saleDate && <div className="form-error">{errors.saleDate}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Valore finale (EUR) *</label>
            <input
              className={`form-input ${errors.finalValue ? 'error' : ''}`}
              type="text" inputMode="decimal" value={finalValue}
              onChange={e => { setFinalValue(e.target.value); setErrors(p => ({ ...p, finalValue: '' })) }}
              onFocus={e => { const n = parseEurInput(e.target.value); if (n) e.target.value = String(n) }}
              onBlur={e => { const n = parseEurInput(e.target.value); setFinalValue(n ? toEurInput(n) : '') }}
              placeholder="0,00"
            />
            {errors.finalValue && <div className="form-error">{errors.finalValue}</div>}
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Comm. venditore</label>
              <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                <button type="button" onClick={() => setCommModeSeller('pct')}
                  style={{ flex: 1, padding: '6px 8px', fontSize: 11, fontWeight: 600, borderRadius: 6,
                    border: '1px solid var(--bd)', cursor: 'pointer',
                    background: commModeSeller === 'pct' ? 'var(--lime)' : 'var(--s3)',
                    color: commModeSeller === 'pct' ? 'var(--bg)' : 'var(--gl)' }}>
                  Percentuale (%)
                </button>
                <button type="button" onClick={() => setCommModeSeller('fixed')}
                  style={{ flex: 1, padding: '6px 8px', fontSize: 11, fontWeight: 600, borderRadius: 6,
                    border: '1px solid var(--bd)', cursor: 'pointer',
                    background: commModeSeller === 'fixed' ? 'var(--lime)' : 'var(--s3)',
                    color: commModeSeller === 'fixed' ? 'var(--bg)' : 'var(--gl)' }}>
                  Fisso (€)
                </button>
              </div>
              {commModeSeller === 'pct' ? (
                <input className="form-input" type="number" step="0.01" min="0" max="100"
                  value={commPctSeller} onChange={e => setCommPctSeller(e.target.value)} placeholder="es. 3" />
              ) : (
                <input className="form-input" type="text" inputMode="decimal"
                  value={commFixedSeller} onChange={e => setCommFixedSeller(e.target.value)}
                  onFocus={e => { const n = parseEurInput(e.target.value); if (n) e.target.value = String(n) }}
                  onBlur={e => { const n = parseEurInput(e.target.value); setCommFixedSeller(n ? toEurInput(n) : '') }}
                  placeholder="es. 8.000,00" />
              )}
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Comm. acquirente</label>
              <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                <button type="button" onClick={() => setCommModeBuyer('pct')}
                  style={{ flex: 1, padding: '6px 8px', fontSize: 11, fontWeight: 600, borderRadius: 6,
                    border: '1px solid var(--bd)', cursor: 'pointer',
                    background: commModeBuyer === 'pct' ? 'var(--lime)' : 'var(--s3)',
                    color: commModeBuyer === 'pct' ? 'var(--bg)' : 'var(--gl)' }}>
                  Percentuale (%)
                </button>
                <button type="button" onClick={() => setCommModeBuyer('fixed')}
                  style={{ flex: 1, padding: '6px 8px', fontSize: 11, fontWeight: 600, borderRadius: 6,
                    border: '1px solid var(--bd)', cursor: 'pointer',
                    background: commModeBuyer === 'fixed' ? 'var(--lime)' : 'var(--s3)',
                    color: commModeBuyer === 'fixed' ? 'var(--bg)' : 'var(--gl)' }}>
                  Fisso (€)
                </button>
              </div>
              {commModeBuyer === 'pct' ? (
                <input className="form-input" type="number" step="0.01" min="0" max="100"
                  value={commPctBuyer} onChange={e => setCommPctBuyer(e.target.value)} placeholder="es. 3" />
              ) : (
                <input className="form-input" type="text" inputMode="decimal"
                  value={commFixedBuyer} onChange={e => setCommFixedBuyer(e.target.value)}
                  onFocus={e => { const n = parseEurInput(e.target.value); if (n) e.target.value = String(n) }}
                  onBlur={e => { const n = parseEurInput(e.target.value); setCommFixedBuyer(n ? toEurInput(n) : '') }}
                  placeholder="es. 8.000,00" />
              )}
            </div>
          </div>

          <CommissionSummary
            finalValue={fv}
            commPctSeller={cs}
            commPctBuyer={cb}
            origin={operation.origin}
            agentCommPctAgency={agentProfile.comm_pct_agency}
            agentCommPctAgent={agentProfile.comm_pct_agent}
            opts={commOpts}
            collaboratorLabel={collabLabel}
          />

          {/* Provvigioni incassate */}
          <div style={{ borderTop: '1px solid var(--bd)', margin: '16px 0', paddingTop: 16 }}>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: 'var(--ld)', textTransform: 'uppercase', marginBottom: 12, letterSpacing: '0.5px' }}>
              // Provvigioni Incassate
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Importo incassato vend. (EUR)</label>
              <input className="form-input" type="text" inputMode="decimal"
                value={commissionCollectedSeller}
                onChange={e => setCommissionCollectedSeller(e.target.value)}
                onFocus={e => { const n = parseEurInput(e.target.value); if (n) e.target.value = String(n) }}
                onBlur={e => { const n = parseEurInput(e.target.value); setCommissionCollectedSeller(n ? toEurInput(n) : '') }}
                placeholder="0,00" />
            </div>
            <div className="form-group">
              <label className="form-label">Data incasso vend.</label>
              <input className="form-input" type="date" value={collectionDateSeller}
                onChange={e => setCollectionDateSeller(e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Importo incassato acq. (EUR)</label>
              <input className="form-input" type="text" inputMode="decimal"
                value={commissionCollectedBuyer}
                onChange={e => setCommissionCollectedBuyer(e.target.value)}
                onFocus={e => { const n = parseEurInput(e.target.value); if (n) e.target.value = String(n) }}
                onBlur={e => { const n = parseEurInput(e.target.value); setCommissionCollectedBuyer(n ? toEurInput(n) : '') }}
                placeholder="0,00" />
            </div>
            <div className="form-group">
              <label className="form-label">Data incasso acq.</label>
              <input className="form-input" type="date" value={collectionDateBuyer}
                onChange={e => setCollectionDateBuyer(e.target.value)} />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Annulla</button>
            <button type="submit" className="btn btn-primary">Conferma chiusura</button>
          </div>
        </form>
      </div>
    </div>
  )
}
