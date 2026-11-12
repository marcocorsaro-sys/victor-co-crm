import { useMemo, useState } from 'react'
import type { OperationWithAgent } from '../../lib/supabase'
import { getBuyersDisplay, getSellersDisplay } from '../../lib/calculations'
import { useAdmTable } from '../../hooks/useAdm'
import {
  FULFILMENT_DEFAULT_DAYS, FULFILMENT_KIND_LABELS, FULFILMENT_STATUS_LABELS,
  addDaysIso, dueLabel, fmtDate,
  type Fulfilment, type FulfilmentKind, type FulfilmentStatus, eur } from '../../lib/amministrazione'
import { Empty, Field, FileCell, Head, Modal, Pill, SetupNotice, type Tone } from './ui'

type Props = { operations: OperationWithAgent[]; toast: (m: string, t?: 'success' | 'error' | 'info') => void }

const STATUS_TONE: Record<FulfilmentStatus, Tone> = { da_preparare: 'amber', pronta: 'teal', inviata: 'teal', registrata: 'green' }
const NEXT: Partial<Record<FulfilmentStatus, { to: FulfilmentStatus; label: string }>> = {
  da_preparare: { to: 'pronta', label: 'Segna pronta' },
  pronta: { to: 'inviata', label: 'Segna inviata' },
  inviata: { to: 'registrata', label: 'Segna registrata' },
}

export default function Adempimenti({ operations, toast }: Props) {
  const { rows, loading, error, add, update, remove } = useAdmTable<Fulfilment>('adm_fulfilments', { orderBy: 'due_date', ascending: true })
  const [filter, setFilter] = useState<'aperti' | 'registrati' | 'tutti'>('aperti')
  const [editing, setEditing] = useState<Partial<Fulfilment> | null>(null)

  const opById = useMemo(() => new Map(operations.map(o => [o.id, o])), [operations])
  const visible = rows.filter(r => filter === 'tutti' ? true : filter === 'registrati' ? r.status === 'registrata' : r.status !== 'registrata')

  const advance = async (r: Fulfilment) => {
    const n = NEXT[r.status]
    if (!n) return
    const patch: Partial<Fulfilment> = { status: n.to }
    if (n.to === 'registrata') patch.completed_at = new Date().toISOString()
    const res = await update(r.id, patch)
    if (res.error) toast(res.error, 'error')
  }

  const save = async () => {
    if (!editing?.title?.trim()) { toast('Inserisci un titolo', 'error'); return }
    const { id, ...values } = editing
    const res = id ? await update(id, values) : await add(values)
    if (res.error) toast(res.error, 'error')
    else { toast('Adempimento salvato'); setEditing(null) }
  }

  const fillFromOperation = (opId: string) => {
    const op = opById.get(opId)
    if (!op) { setEditing(p => ({ ...p, operation_id: null })); return }
    const parties = [getSellersDisplay(op), getBuyersDisplay(op)].filter(Boolean).join(' / ')
    const kind: FulfilmentKind = op.type === 'locazione' ? 'locazione' : 'preliminare_compravendita'
    setEditing(p => ({
      ...p,
      operation_id: opId,
      kind,
      title: p?.title || `${FULFILMENT_KIND_LABELS[kind]} - ${op.property_name}`,
      parties: parties || p?.parties || null,
    }))
  }

  const onDate = (iso: string) => {
    setEditing(p => {
      const kind = (p?.kind ?? 'preliminare_compravendita') as FulfilmentKind
      return { ...p, act_date: iso || null, due_date: iso ? addDaysIso(iso, FULFILMENT_DEFAULT_DAYS[kind]) : p?.due_date ?? null }
    })
  }

  return (
    <div>
      <Head
        title="Registrazioni agenzia delle entrate"
        hint="Preliminari di compravendita e contratti di locazione. Qui prepari i dati e tieni le scadenze; l'invio sul portale resta un passaggio manuale, poi carichi la ricevuta."
        action={<button className="btn btn-primary" onClick={() => setEditing({ kind: 'preliminare_compravendita', status: 'da_preparare' })}>+ Nuovo adempimento</button>}
      />
      <SetupNotice error={error} />
      <div className="tabs">
        {(['aperti', 'registrati', 'tutti'] as const).map(f => (
          <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'aperti' ? 'Da completare' : f === 'registrati' ? 'Registrati' : 'Tutti'}
          </button>
        ))}
      </div>

      {loading ? <div className="skeleton" style={{ height: 200, borderRadius: 10 }} /> : visible.length === 0 ? (
        <Empty text="Nessun adempimento in questa vista." />
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Atto</th><th>Pratica</th><th>Data atto</th><th>Scadenza</th><th>Imposta</th><th>Stato</th><th>Ricevuta</th><th></th>
            </tr></thead>
            <tbody>
              {visible.map(r => {
                const d = r.status === 'registrata' ? null : dueLabel(r.due_date)
                const op = r.operation_id ? opById.get(r.operation_id) : null
                const n = NEXT[r.status]
                return (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'normal', minWidth: 220 }}>
                      <div style={{ fontWeight: 600 }}>{r.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--g)' }}>{FULFILMENT_KIND_LABELS[r.kind]}{r.parties ? ` · ${r.parties}` : ''}</div>
                    </td>
                    <td>{op?.property_name ?? '-'}</td>
                    <td>{fmtDate(r.act_date)}</td>
                    <td>
                      {fmtDate(r.due_date)}{' '}
                      {d && <Pill tone={d.tone === 'g' ? 'g' : d.tone}>{d.text}</Pill>}
                    </td>
                    <td>{eur(r.tax_amount)}</td>
                    <td><Pill tone={STATUS_TONE[r.status]}>{FULFILMENT_STATUS_LABELS[r.status]}</Pill></td>
                    <td>
                      <FileCell
                        path={r.receipt_path}
                        prefix={`admin/adempimenti/${r.id}`}
                        onUploaded={async p => { await update(r.id, { receipt_path: p }) }}
                      />
                    </td>
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
        <Modal title={editing.id ? 'Modifica adempimento' : 'Nuovo adempimento'} onClose={() => setEditing(null)}>
          <Field label="Pratica collegata">
            <select className="form-select" value={editing.operation_id ?? ''} onChange={e => fillFromOperation(e.target.value)}>
              <option value="">Nessuna</option>
              {operations.map(o => <option key={o.id} value={o.id}>{o.property_name} ({o.type})</option>)}
            </select>
          </Field>
          <div className="form-row">
            <Field label="Tipo atto">
              <select className="form-select" value={editing.kind ?? 'preliminare_compravendita'}
                onChange={e => setEditing(p => ({ ...p, kind: e.target.value as FulfilmentKind }))}>
                {Object.entries(FULFILMENT_KIND_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
            <Field label="Stato">
              <select className="form-select" value={editing.status ?? 'da_preparare'}
                onChange={e => setEditing(p => ({ ...p, status: e.target.value as FulfilmentStatus }))}>
                {Object.entries(FULFILMENT_STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Titolo"><input className="form-input" value={editing.title ?? ''} onChange={e => setEditing(p => ({ ...p, title: e.target.value }))} /></Field>
          <Field label="Parti"><input className="form-input" value={editing.parties ?? ''} onChange={e => setEditing(p => ({ ...p, parties: e.target.value }))} /></Field>
          <div className="form-row">
            <Field label="Data dell'atto"><input type="date" className="form-input" value={editing.act_date ?? ''} onChange={e => onDate(e.target.value)} /></Field>
            <Field label="Scadenza registrazione" hint="Calcolata dalla data atto (preliminari 20 gg, locazioni 30 gg): verificala sul caso.">
              <input type="date" className="form-input" value={editing.due_date ?? ''} onChange={e => setEditing(p => ({ ...p, due_date: e.target.value || null }))} />
            </Field>
          </div>
          <div className="form-row">
            <Field label="Imposta di registro e bollo (EUR)">
              <input type="number" step="0.01" className="form-input" value={editing.tax_amount ?? ''}
                onChange={e => setEditing(p => ({ ...p, tax_amount: e.target.value === '' ? null : Number(e.target.value) }))} />
            </Field>
            <Field label="Estremi registrazione">
              <input className="form-input" value={editing.registration_ref ?? ''} onChange={e => setEditing(p => ({ ...p, registration_ref: e.target.value }))} />
            </Field>
          </div>
          <Field label="Note"><textarea className="form-textarea" value={editing.notes ?? ''} onChange={e => setEditing(p => ({ ...p, notes: e.target.value }))} /></Field>
          <div className="form-actions">
            {editing.id && (
              <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={async () => {
                if (!confirm('Eliminare questo adempimento?')) return
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
