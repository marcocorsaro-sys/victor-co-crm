import { useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAdmTable } from '../../hooks/useAdm'
import {
  MONTH_CLOSE_TEMPLATE, dueLabel, fmtDate, monthStart, todayIso,
  type AccountantRequest, type MonthCloseItem,
} from '../../lib/amministrazione'
import { Empty, Field, FileCell, Head, Modal, Pill, SetupNotice, type Tone } from './ui'

type Props = { toast: (m: string, t?: 'success' | 'error' | 'info') => void }

const REQ_TONE: Record<AccountantRequest['status'], Tone> = { aperta: 'amber', in_lavorazione: 'teal', inviata: 'teal', chiusa: 'green' }
const REQ_LABEL: Record<AccountantRequest['status'], string> = { aperta: 'Aperta', in_lavorazione: 'In lavorazione', inviata: 'Inviata allo studio', chiusa: 'Chiusa' }
const REQ_NEXT: Partial<Record<AccountantRequest['status'], AccountantRequest['status']>> = { aperta: 'in_lavorazione', in_lavorazione: 'inviata', inviata: 'chiusa' }

function monthOptions(): string[] {
  const out: string[] = []
  const d = new Date()
  d.setDate(1)
  for (let i = 0; i < 12; i++) {
    out.push(monthStart(d.toISOString().slice(0, 10)))
    d.setMonth(d.getMonth() - 1)
  }
  return out
}

export default function Contabilita({ toast }: Props) {
  const reqs = useAdmTable<AccountantRequest>('adm_accountant_requests', { orderBy: 'requested_at', ascending: false })
  const closes = useAdmTable<MonthCloseItem>('adm_month_close_items', { orderBy: 'created_at', ascending: true })
  const [month, setMonth] = useState(monthStart(todayIso()))
  const [editing, setEditing] = useState<Partial<AccountantRequest> | null>(null)
  const [showClosed, setShowClosed] = useState(false)

  const monthItems = useMemo(() => closes.rows.filter(i => i.month === month), [closes.rows, month])
  const done = monthItems.filter(i => i.done).length
  const visibleReqs = reqs.rows.filter(r => showClosed || r.status !== 'chiusa')

  const initMonth = async () => {
    const have = new Set(monthItems.map(i => i.item_key))
    const rows = MONTH_CLOSE_TEMPLATE.filter(t => !have.has(t.key)).map(t => ({ month, item_key: t.key, label: t.label }))
    if (!rows.length) return
    const { error } = await supabase.from('adm_month_close_items').insert(rows)
    if (error) toast(error.message, 'error'); else closes.refetch()
  }

  const toggle = async (i: MonthCloseItem) => {
    const res = await closes.update(i.id, { done: !i.done, done_at: !i.done ? new Date().toISOString() : null })
    if (res.error) toast(res.error, 'error')
  }

  const saveReq = async () => {
    if (!editing?.description?.trim()) { toast('Descrivi la richiesta', 'error'); return }
    const { id, ...values } = editing
    const res = id ? await reqs.update(id, values) : await reqs.add(values)
    if (res.error) toast(res.error, 'error'); else { toast('Richiesta salvata'); setEditing(null) }
  }

  return (
    <div>
      <Head
        title="Contabilita e commercialista"
        hint="Due strumenti: la chiusura mensile (tutto cio' che lo studio si aspetta ogni mese) e il registro delle richieste puntuali del commercialista, con scadenza e allegati."
      />
      <SetupNotice error={reqs.error ?? closes.error} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(360px, 2fr)', gap: 16, alignItems: 'start' }}>
        <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
            <select className="form-select" value={month} onChange={e => setMonth(e.target.value)} style={{ maxWidth: 170 }}>
              {monthOptions().map(m => (
                <option key={m} value={m}>{new Date(m + 'T12:00:00').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</option>
              ))}
            </select>
            <Pill tone={monthItems.length && done === monthItems.length ? 'green' : 'amber'}>{done}/{monthItems.length || MONTH_CLOSE_TEMPLATE.length}</Pill>
          </div>
          {monthItems.length < MONTH_CLOSE_TEMPLATE.length && (
            <button className="btn btn-secondary btn-sm" style={{ marginBottom: 10 }} onClick={initMonth}>
              {monthItems.length ? 'Aggiungi voci mancanti' : 'Avvia chiusura del mese'}
            </button>
          )}
          {monthItems.map(i => (
            <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--bd)' }}>
              <input type="checkbox" checked={i.done} onChange={() => toggle(i)} />
              <span style={{ flex: 1, fontSize: 13, textDecoration: i.done ? 'line-through' : 'none', color: i.done ? 'var(--g)' : 'var(--w)' }}>{i.label}</span>
              <FileCell path={i.attachment_path} prefix={`admin/contabilita/${month}`} label="File"
                onUploaded={async p => { await closes.update(i.id, { attachment_path: p }) }} />
            </div>
          ))}
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Richieste dello studio</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <label style={{ fontSize: 12, color: 'var(--gl)', display: 'flex', gap: 4, alignItems: 'center' }}>
                <input type="checkbox" checked={showClosed} onChange={e => setShowClosed(e.target.checked)} /> Mostra chiuse
              </label>
              <button className="btn btn-primary btn-sm" onClick={() => setEditing({ status: 'aperta', requested_at: todayIso() })}>+ Nuova richiesta</button>
            </div>
          </div>
          {visibleReqs.length === 0 ? <Empty text="Nessuna richiesta aperta dallo studio." /> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Richiesta</th><th>Periodo</th><th>Scadenza</th><th>Stato</th><th>Allegato</th><th></th></tr></thead>
                <tbody>
                  {visibleReqs.map(r => {
                    const d = r.status === 'chiusa' ? null : dueLabel(r.due_date)
                    const next = REQ_NEXT[r.status]
                    return (
                      <tr key={r.id}>
                        <td style={{ whiteSpace: 'normal', minWidth: 200 }}>{r.description}
                          <div style={{ fontSize: 11, color: 'var(--g)' }}>{r.requested_by ? `${r.requested_by} · ` : ''}{fmtDate(r.requested_at)}</div></td>
                        <td>{r.period ?? '-'}</td>
                        <td>{fmtDate(r.due_date)} {d && r.due_date && <Pill tone={d.tone === 'g' ? 'g' : d.tone}>{d.text}</Pill>}</td>
                        <td><Pill tone={REQ_TONE[r.status]}>{REQ_LABEL[r.status]}</Pill></td>
                        <td><FileCell path={r.attachment_path} prefix={`admin/commercialista/${r.id}`}
                          onUploaded={async p => { await reqs.update(r.id, { attachment_path: p }) }} /></td>
                        <td style={{ display: 'flex', gap: 6 }}>
                          {next && <button className="btn btn-success btn-sm" onClick={async () => {
                            const res = await reqs.update(r.id, { status: next, closed_at: next === 'chiusa' ? new Date().toISOString() : null })
                            if (res.error) toast(res.error, 'error')
                          }}>{REQ_LABEL[next]}</button>}
                          <button className="btn btn-secondary btn-sm" onClick={() => setEditing(r)}>Modifica</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <Modal title={editing.id ? 'Modifica richiesta' : 'Nuova richiesta dello studio'} onClose={() => setEditing(null)}>
          <Field label="Cosa serve"><textarea className="form-textarea" value={editing.description ?? ''} onChange={e => setEditing(p => ({ ...p, description: e.target.value }))} /></Field>
          <div className="form-row">
            <Field label="Chi la chiede"><input className="form-input" value={editing.requested_by ?? ''} onChange={e => setEditing(p => ({ ...p, requested_by: e.target.value }))} /></Field>
            <Field label="Periodo di riferimento"><input className="form-input" placeholder="es. ottobre 2026" value={editing.period ?? ''} onChange={e => setEditing(p => ({ ...p, period: e.target.value }))} /></Field>
          </div>
          <div className="form-row">
            <Field label="Data richiesta"><input type="date" className="form-input" value={editing.requested_at ?? ''} onChange={e => setEditing(p => ({ ...p, requested_at: e.target.value }))} /></Field>
            <Field label="Scadenza"><input type="date" className="form-input" value={editing.due_date ?? ''} onChange={e => setEditing(p => ({ ...p, due_date: e.target.value || null }))} /></Field>
          </div>
          <Field label="Note"><textarea className="form-textarea" value={editing.notes ?? ''} onChange={e => setEditing(p => ({ ...p, notes: e.target.value }))} /></Field>
          <div className="form-actions">
            {editing.id && (
              <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={async () => {
                if (!confirm('Eliminare questa richiesta?')) return
                const res = await reqs.remove(editing.id!)
                if (res.error) toast(res.error, 'error'); else setEditing(null)
              }}>Elimina</button>
            )}
            <button className="btn btn-secondary" onClick={() => setEditing(null)}>Annulla</button>
            <button className="btn btn-primary" onClick={saveReq}>Salva</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
