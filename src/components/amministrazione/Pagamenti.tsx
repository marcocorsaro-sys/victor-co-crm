import { useMemo, useState } from 'react'
import type { OperationWithAgent } from '../../lib/supabase'
import { supabase } from '../../lib/supabase'
import { useAdmTable } from '../../hooks/useAdm'
import {
  PAYMENT_CATEGORY_LABELS, PAYMENT_STATUS_LABELS, dueLabel, fmtDate,
  type AdmPayment, type PaymentCategory, type PaymentRecurrence, type PaymentStatus, eur } from '../../lib/amministrazione'
import { Empty, Field, FileCell, Head, Kpi, Modal, Pill, SetupNotice, type Tone } from './ui'

type Props = { operations: OperationWithAgent[]; toast: (m: string, t?: 'success' | 'error' | 'info') => void }

const TONE: Record<PaymentStatus, Tone> = { da_approvare: 'amber', approvato: 'teal', disposto: 'teal', pagato: 'green', annullato: 'g' }
const NEXT: Partial<Record<PaymentStatus, { to: PaymentStatus; label: string }>> = {
  da_approvare: { to: 'approvato', label: 'Approva' },
  approvato: { to: 'disposto', label: 'Segna disposto' },
  disposto: { to: 'pagato', label: 'Segna pagato' },
}

export default function Pagamenti({ operations, toast }: Props) {
  const { rows, loading, error, add, update, remove } = useAdmTable<AdmPayment>('adm_payments', { orderBy: 'due_date', ascending: true })
  const [filter, setFilter] = useState<'coda' | 'pagati' | 'tutti'>('coda')
  const [editing, setEditing] = useState<Partial<AdmPayment> | null>(null)
  const opById = useMemo(() => new Map(operations.map(o => [o.id, o])), [operations])

  const open = rows.filter(r => r.status !== 'pagato' && r.status !== 'annullato')
  const toApprove = open.filter(r => r.status === 'da_approvare')
  const sum = (l: AdmPayment[]) => l.reduce((s, r) => s + Number(r.amount), 0)
  const visible = rows.filter(r => filter === 'tutti' ? true : filter === 'pagati' ? r.status === 'pagato' : r.status !== 'pagato' && r.status !== 'annullato')

  const advance = async (r: AdmPayment) => {
    const n = NEXT[r.status]
    if (!n) return
    const patch: Partial<AdmPayment> = { status: n.to }
    if (n.to === 'approvato') {
      const { data: { user } } = await supabase.auth.getUser()
      patch.approved_by = user?.id ?? null
      patch.approved_at = new Date().toISOString()
    }
    if (n.to === 'pagato') patch.paid_at = new Date().toISOString()
    const res = await update(r.id, patch)
    if (res.error) toast(res.error, 'error')
  }

  const save = async () => {
    if (!editing?.payee?.trim()) { toast('Inserisci il beneficiario', 'error'); return }
    if (editing.amount === undefined || editing.amount === null || Number.isNaN(Number(editing.amount))) { toast('Inserisci l\'importo', 'error'); return }
    const { id, ...values } = editing
    const res = id ? await update(id, values) : await add(values)
    if (res.error) toast(res.error, 'error')
    else { toast('Pagamento salvato'); setEditing(null) }
  }

  return (
    <div>
      <Head
        title="Pagamenti"
        hint="Coda unica di tutto cio' che va pagato: fornitori, agenti, locazioni, spese d'ufficio. Chi prepara inserisce, un admin approva, poi si segna la disposizione in banca. Il crm non muove denaro: traccia e fa da promemoria."
        action={<button className="btn btn-primary" onClick={() => setEditing({ category: 'fornitore', status: 'da_approvare', recurrence: 'nessuna' })}>+ Nuovo pagamento</button>}
      />
      <SetupNotice error={error} />
      <div className="kpi-grid" style={{ marginBottom: 16 }}>
        <Kpi label="Da approvare" value={toApprove.length} tone={toApprove.length ? 'amber' : undefined} />
        <Kpi label="Importo da approvare" value={eur(sum(toApprove))} />
        <Kpi label="In coda (totale)" value={eur(sum(open))} tone="teal" />
        <Kpi label="Scaduti" value={open.filter(r => (dueLabel(r.due_date).tone === 'red') && r.due_date).length} tone="red" />
      </div>
      <div className="tabs">
        {(['coda', 'pagati', 'tutti'] as const).map(f => (
          <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'coda' ? 'In coda' : f === 'pagati' ? 'Pagati' : 'Tutti'}
          </button>
        ))}
      </div>

      {loading ? <div className="skeleton" style={{ height: 200, borderRadius: 10 }} /> : visible.length === 0 ? (
        <Empty text="Nessun pagamento in questa vista." />
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Beneficiario</th><th>Categoria</th><th>Pratica</th><th>Importo</th><th>Scadenza</th><th>Stato</th><th>Allegato</th><th></th>
            </tr></thead>
            <tbody>
              {visible.map(r => {
                const d = r.status === 'pagato' || r.status === 'annullato' ? null : dueLabel(r.due_date)
                const n = NEXT[r.status]
                return (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'normal', minWidth: 200 }}>
                      <div style={{ fontWeight: 600 }}>{r.payee}</div>
                      <div style={{ fontSize: 11, color: 'var(--g)' }}>{r.description ?? ''}{r.recurrence !== 'nessuna' ? ` · ${r.recurrence}` : ''}</div>
                    </td>
                    <td>{PAYMENT_CATEGORY_LABELS[r.category]}</td>
                    <td>{r.operation_id ? (opById.get(r.operation_id)?.property_name ?? '-') : '-'}</td>
                    <td className="mono">{eur(Number(r.amount))}</td>
                    <td>{fmtDate(r.due_date)} {d && r.due_date && <Pill tone={d.tone === 'g' ? 'g' : d.tone}>{d.text}</Pill>}</td>
                    <td><Pill tone={TONE[r.status]}>{PAYMENT_STATUS_LABELS[r.status]}</Pill></td>
                    <td><FileCell path={r.attachment_path} prefix={`admin/pagamenti/${r.id}`} label="Fattura/ricevuta"
                      onUploaded={async p => { await update(r.id, { attachment_path: p }) }} /></td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      {n && <button className="btn btn-success btn-sm" onClick={() => advance(r)}>{n.label}</button>}
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditing(r)}>Modifica</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Modal title={editing.id ? 'Modifica pagamento' : 'Nuovo pagamento'} onClose={() => setEditing(null)}>
          <div className="form-row">
            <Field label="Beneficiario"><input className="form-input" value={editing.payee ?? ''} onChange={e => setEditing(p => ({ ...p, payee: e.target.value }))} /></Field>
            <Field label="Categoria">
              <select className="form-select" value={editing.category ?? 'fornitore'} onChange={e => setEditing(p => ({ ...p, category: e.target.value as PaymentCategory }))}>
                {Object.entries(PAYMENT_CATEGORY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Descrizione"><input className="form-input" value={editing.description ?? ''} onChange={e => setEditing(p => ({ ...p, description: e.target.value }))} /></Field>
          <div className="form-row">
            <Field label="Importo (EUR)"><input type="number" step="0.01" className="form-input" value={editing.amount ?? ''}
              onChange={e => setEditing(p => ({ ...p, amount: e.target.value === '' ? undefined : Number(e.target.value) }))} /></Field>
            <Field label="Scadenza"><input type="date" className="form-input" value={editing.due_date ?? ''} onChange={e => setEditing(p => ({ ...p, due_date: e.target.value || null }))} /></Field>
          </div>
          <div className="form-row">
            <Field label="IBAN"><input className="form-input" value={editing.iban ?? ''} onChange={e => setEditing(p => ({ ...p, iban: e.target.value }))} /></Field>
            <Field label="Causale / riferimento"><input className="form-input" value={editing.reference ?? ''} onChange={e => setEditing(p => ({ ...p, reference: e.target.value }))} /></Field>
          </div>
          <div className="form-row">
            <Field label="Pratica collegata">
              <select className="form-select" value={editing.operation_id ?? ''} onChange={e => setEditing(p => ({ ...p, operation_id: e.target.value || null }))}>
                <option value="">Nessuna</option>
                {operations.map(o => <option key={o.id} value={o.id}>{o.property_name}</option>)}
              </select>
            </Field>
            <Field label="Ricorrenza">
              <select className="form-select" value={editing.recurrence ?? 'nessuna'} onChange={e => setEditing(p => ({ ...p, recurrence: e.target.value as PaymentRecurrence }))}>
                {['nessuna', 'mensile', 'trimestrale', 'annuale'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Note"><textarea className="form-textarea" value={editing.notes ?? ''} onChange={e => setEditing(p => ({ ...p, notes: e.target.value }))} /></Field>
          <div className="form-actions">
            {editing.id && (
              <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={async () => {
                if (!confirm('Eliminare questo pagamento?')) return
                const res = await remove(editing.id!)
                if (res.error) toast(res.error, 'error'); else setEditing(null)
              }}>Elimina</button>
            )}
            <button className="btn btn-secondary" onClick={() => setEditing(null)}>Annulla</button>
            <button className="btn btn-primary" onClick={save}>Salva</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
