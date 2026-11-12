import { useEffect, useMemo, useState } from 'react'
import type { Client, OperationWithAgent, Profile } from '../../lib/supabase'
import { supabase } from '../../lib/supabase'
import { calculateCommissions, getBuyersDisplay, getSellersDisplay } from '../../lib/calculations'
import { useAdmTable } from '../../hooks/useAdm'
import {
  addDaysIso, dueLabel, fmtDate, todayIso,
  type AdmInvoice, type InvoiceEvent, eur } from '../../lib/amministrazione'
import { Empty, Field, Head, Kpi, Modal, Pill, SetupNotice, type Tone } from './ui'

type Props = {
  operations: OperationWithAgent[]
  clients: Client[]
  agents: Profile[]
  toast: (m: string, t?: 'success' | 'error' | 'info') => void
}

const STATUS_LABEL: Record<AdmInvoice['status'], string> = { bozza: 'Bozza', inviata: 'Inviata', pagata: 'Pagata', annullata: 'Annullata' }
const STATUS_TONE: Record<AdmInvoice['status'], Tone> = { bozza: 'g', inviata: 'amber', pagata: 'green', annullata: 'g' }
const SDI_LABEL = { da_emettere: 'Da emettere', emessa: 'Emessa a SDI', consegnata: 'Consegnata', scartata: 'Scartata' } as const

export default function ProformaIncassi({ operations, clients, agents, toast }: Props) {
  const { rows, loading, error, add, update, remove, refetch } = useAdmTable<AdmInvoice>('adm_invoices', { orderBy: 'issue_date', ascending: false })
  const [filter, setFilter] = useState<'da_incassare' | 'incassate' | 'fatture' | 'tutte'>('da_incassare')
  const [editing, setEditing] = useState<Partial<AdmInvoice> | null>(null)
  const [detail, setDetail] = useState<AdmInvoice | null>(null)
  const [events, setEvents] = useState<InvoiceEvent[]>([])
  const [reminderCounts, setReminderCounts] = useState<Record<string, number>>({})
  const [creating, setCreating] = useState<{ opId: string; party: 'venditore' | 'acquirente' } | null>(null)

  const opById = useMemo(() => new Map(operations.map(o => [o.id, o])), [operations])

  const loadCounts = async () => {
    const { data } = await supabase.from('adm_invoice_events').select('invoice_id, kind').in('kind', ['sollecito_mail', 'sollecito_telefonico'])
    const c: Record<string, number> = {}
    for (const e of (data ?? []) as Array<{ invoice_id: string }>) c[e.invoice_id] = (c[e.invoice_id] ?? 0) + 1
    setReminderCounts(c)
  }
  useEffect(() => { loadCounts() }, [rows.length])

  const isOverdue = (r: AdmInvoice) => r.status === 'inviata' && !!r.due_date && r.due_date < todayIso()
  const open = rows.filter(r => r.doc_type === 'proforma' && (r.status === 'inviata' || r.status === 'bozza'))
  const overdue = rows.filter(isOverdue)
  const monthKey = todayIso().slice(0, 7)
  const paidMonth = rows.filter(r => r.status === 'pagata' && (r.paid_at ?? '').startsWith(monthKey))
  const sdiPending = rows.filter(r => r.doc_type === 'fattura' && r.sdi_status === 'da_emettere')

  const visible = rows.filter(r =>
    filter === 'da_incassare' ? (r.doc_type === 'proforma' && (r.status === 'bozza' || r.status === 'inviata'))
      : filter === 'incassate' ? r.status === 'pagata'
        : filter === 'fatture' ? r.doc_type === 'fattura' : true)

  const openDetail = async (r: AdmInvoice) => {
    setDetail(r)
    const { data } = await supabase.from('adm_invoice_events').select('*').eq('invoice_id', r.id).order('happened_at', { ascending: false })
    setEvents((data ?? []) as InvoiceEvent[])
  }

  const logEvent = async (inv: AdmInvoice, kind: InvoiceEvent['kind'], note: string) => {
    const { error: err } = await supabase.from('adm_invoice_events').insert({ invoice_id: inv.id, kind, note })
    if (err) { toast(err.message, 'error'); return }
    loadCounts()
    if (detail?.id === inv.id) openDetail(inv)
  }

  const createFromOperation = async () => {
    if (!creating) return
    const op = opById.get(creating.opId)
    if (!op) return
    const agent = agents.find(a => a.id === op.agent_id)
    const base = op.final_value ?? op.property_value ?? 0
    const calc = calculateCommissions(
      base, op.comm_pct_seller, op.comm_pct_buyer, op.origin,
      agent?.comm_pct_agency ?? 0, agent?.comm_pct_agent ?? 0,
      {
        commModeSeller: op.comm_mode_seller, commModeBuyer: op.comm_mode_buyer,
        commFixedSeller: op.comm_fixed_seller, commFixedBuyer: op.comm_fixed_buyer,
      },
    )
    const net = creating.party === 'venditore' ? calc.breakdown.seller : calc.breakdown.buyer
    const names = creating.party === 'venditore' ? getSellersDisplay(op) : getBuyersDisplay(op)
    const linked = op.client_id ? clients.find(c => c.id === op.client_id) : undefined
    const res = await add({
      doc_type: 'proforma', operation_id: op.id, party: creating.party,
      client_id: creating.party === 'venditore' ? (op.client_id ?? null) : null,
      client_name: names || linked?.name || '',
      client_email: creating.party === 'venditore' ? (linked?.email ?? null) : null,
      client_tax_id: creating.party === 'venditore' ? (linked?.codice_fiscale ?? null) : null,
      description: `Provvigione per mediazione immobiliare - ${op.property_name}`,
      amount_net: net, vat_pct: 22, issue_date: todayIso(), due_date: addDaysIso(todayIso(), 7), status: 'bozza',
    })
    if (res.error) { toast(res.error, 'error'); return }
    toast(net > 0 ? 'Proforma creata in bozza: controlla importi e dati del cliente' : 'Proforma creata, ma l\'importo e\' zero: completa le provvigioni sulla pratica', net > 0 ? 'success' : 'info')
    setCreating(null)
    if (res.data) setEditing(res.data)
  }

  const send = async (r: AdmInvoice) => {
    const subject = `${r.doc_type === 'proforma' ? 'Nota proforma' : 'Fattura'} ${r.number ?? ''} - Victor&Co Real Estate`
    const body = [
      `Gentile ${r.client_name},`, '',
      `in allegato ${r.doc_type === 'proforma' ? 'la nota proforma' : 'la fattura'} ${r.number ?? ''} di ${eur(r.amount_total)} (IVA inclusa)${r.due_date ? `, da saldare entro il ${fmtDate(r.due_date)}` : ''}.`,
      '', 'Per qualsiasi chiarimento siamo a disposizione.', 'Cordiali saluti', 'Victor&Co Real Estate',
    ].join('\n')
    if (r.client_email) window.open(`mailto:${r.client_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank')
    else toast('Manca l\'email del cliente: segno comunque come inviata', 'info')
    const res = await update(r.id, { status: 'inviata', sent_at: new Date().toISOString(), due_date: r.due_date ?? addDaysIso(todayIso(), 7) })
    if (res.error) toast(res.error, 'error')
  }

  const remind = async (r: AdmInvoice) => {
    const n = (reminderCounts[r.id] ?? 0) + 1
    const subject = `Sollecito di pagamento - ${r.number ?? ''}`
    const body = [
      `Gentile ${r.client_name},`, '',
      `ci risulta ancora da saldare ${r.doc_type === 'proforma' ? 'la nota proforma' : 'la fattura'} ${r.number ?? ''} di ${eur(r.amount_total)}, scaduta il ${fmtDate(r.due_date)}.`,
      'Ti chiediamo di provvedere al pagamento appena possibile, o di segnalarci eventuali difficolta.', '', 'Grazie e cordiali saluti', 'Victor&Co Real Estate',
    ].join('\n')
    if (r.client_email) window.open(`mailto:${r.client_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank')
    else toast('Manca l\'email del cliente', 'error')
    await logEvent(r, 'sollecito_mail', `Sollecito ${n} inviato`)
  }

  const markPaid = async (r: AdmInvoice) => {
    const res = await update(r.id, { status: 'pagata', paid_at: new Date().toISOString(), paid_amount: r.amount_total })
    if (res.error) { toast(res.error, 'error'); return }
    // se era una proforma, propone l'emissione della fattura elettronica
    if (r.doc_type === 'proforma' && confirm('Incasso registrato. Preparo la fattura elettronica collegata?')) {
      const f = await add({
        doc_type: 'fattura', operation_id: r.operation_id, party: r.party, client_id: r.client_id,
        client_name: r.client_name, client_email: r.client_email, client_tax_id: r.client_tax_id,
        description: r.description, amount_net: r.amount_net, vat_pct: r.vat_pct, issue_date: todayIso(),
        proforma_id: r.id, status: 'pagata', paid_at: new Date().toISOString(), paid_amount: r.amount_total, sdi_status: 'da_emettere',
      })
      if (f.error) toast(f.error, 'error'); else toast('Fattura in bozza: emettila dal tuo provider e segna lo stato SDI')
    }
  }

  const forwardToAgent = async (r: AdmInvoice) => {
    const op = r.operation_id ? opById.get(r.operation_id) : null
    const agent = agents.find(a => a.id === op?.agent_id)
    if (!agent?.display_email) { toast('L\'agente non ha un\'email nel profilo', 'error'); return }
    const subject = `${r.number} - copia per ${op?.property_name ?? 'pratica'}`
    const body = `Ciao ${agent.first_name || agent.full_name},\n\ntrasmetto per conoscenza ${r.doc_type} ${r.number} di ${eur(r.amount_total)} intestata a ${r.client_name}.\nStato: ${STATUS_LABEL[r.status]}.\n\nGrazie`
    window.open(`mailto:${agent.display_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank')
    const res = await update(r.id, { forwarded_to_agent_at: new Date().toISOString() })
    if (res.error) toast(res.error, 'error')
  }

  const save = async () => {
    if (!editing?.client_name?.trim()) { toast('Inserisci il cliente', 'error'); return }
    if (editing.amount_net === undefined || Number.isNaN(Number(editing.amount_net))) { toast('Inserisci l\'imponibile', 'error'); return }
    const { id, amount_total: _t, number: _n, ...values } = editing as Partial<AdmInvoice>
    void _t; void _n
    const res = id ? await update(id, values) : await add(values)
    if (res.error) toast(res.error, 'error'); else { toast('Salvato'); setEditing(null); refetch() }
  }

  const total = editing ? Math.round(Number(editing.amount_net ?? 0) * (1 + Number(editing.vat_pct ?? 22) / 100) * 100) / 100 : 0

  return (
    <div>
      <Head
        title="Proforma, fatture e incassi"
        hint="La proforma nasce dalla pratica con le provvigioni gia' calcolate, scadenza a 7 giorni. Se non arriva il pagamento si sollecita e si registra ogni contatto. A incasso avvenuto si prepara la fattura elettronica."
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={() => setCreating({ opId: operations[0]?.id ?? '', party: 'acquirente' })}>+ Proforma da pratica</button>
            <button className="btn btn-secondary" onClick={() => setEditing({ doc_type: 'proforma', party: 'acquirente', vat_pct: 22, issue_date: todayIso(), due_date: addDaysIso(todayIso(), 7), status: 'bozza' })}>+ Manuale</button>
          </div>
        }
      />
      <SetupNotice error={error} />
      <div className="kpi-grid" style={{ marginBottom: 16 }}>
        <Kpi label="Proforma da incassare" value={eur(open.reduce((s, r) => s + Number(r.amount_total), 0))} tone="teal" />
        <Kpi label="Scadute" value={`${overdue.length} · ${eur(overdue.reduce((s, r) => s + Number(r.amount_total), 0))}`} tone={overdue.length ? 'red' : 'green'} onClick={() => setFilter('da_incassare')} />
        <Kpi label="Incassato nel mese" value={eur(paidMonth.reduce((s, r) => s + Number(r.paid_amount ?? r.amount_total), 0))} tone="green" />
        <Kpi label="Fatture da emettere a SDI" value={sdiPending.length} tone={sdiPending.length ? 'amber' : undefined} />
      </div>
      <div className="tabs">
        {([['da_incassare', 'Da incassare'], ['incassate', 'Incassate'], ['fatture', 'Fatture'], ['tutte', 'Tutte']] as const).map(([k, l]) => (
          <button key={k} className={`tab ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      {loading ? <div className="skeleton" style={{ height: 200, borderRadius: 10 }} /> : visible.length === 0 ? <Empty text="Nessun documento in questa vista." /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Numero</th><th>Cliente</th><th>Pratica</th><th>Totale</th><th>Scadenza</th><th>Stato</th><th>SDI</th><th></th></tr></thead>
            <tbody>
              {visible.map(r => {
                const over = isOverdue(r)
                const d = r.status === 'inviata' ? dueLabel(r.due_date) : null
                const sol = reminderCounts[r.id] ?? 0
                const op = r.operation_id ? opById.get(r.operation_id) : null
                return (
                  <tr key={r.id}>
                    <td><span className="mono">{r.number}</span><div style={{ fontSize: 10, color: 'var(--g)' }}>{r.doc_type} · {r.party}</div></td>
                    <td style={{ whiteSpace: 'normal', minWidth: 160 }}>{r.client_name}<div style={{ fontSize: 11, color: 'var(--g)' }}>{r.client_email ?? 'email mancante'}</div></td>
                    <td>{op?.property_name ?? '-'}</td>
                    <td className="mono">{eur(Number(r.amount_total))}</td>
                    <td>{fmtDate(r.due_date)} {d && <Pill tone={d.tone === 'g' ? 'g' : d.tone}>{d.text}</Pill>}</td>
                    <td><Pill tone={over ? 'red' : STATUS_TONE[r.status]}>{over ? 'Scaduta' : STATUS_LABEL[r.status]}</Pill>{sol > 0 && <> <Pill tone="amber">{sol} solleciti</Pill></>}</td>
                    <td>{r.sdi_status ? <Pill tone={r.sdi_status === 'consegnata' ? 'green' : r.sdi_status === 'scartata' ? 'red' : 'amber'}>{SDI_LABEL[r.sdi_status]}</Pill> : '-'}</td>
                    <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {r.status === 'bozza' && <button className="btn btn-success btn-sm" onClick={() => send(r)}>Invia</button>}
                      {over && <button className="btn btn-success btn-sm" onClick={() => remind(r)}>Sollecita</button>}
                      {over && sol >= 2 && <Pill tone="red">chiamare il cliente</Pill>}
                      {(r.status === 'inviata' || r.status === 'bozza') && <button className="btn btn-secondary btn-sm" onClick={() => markPaid(r)}>Incassata</button>}
                      {r.operation_id && <button className="btn btn-secondary btn-sm" onClick={() => forwardToAgent(r)} title={r.forwarded_to_agent_at ? `Inoltrata il ${fmtDate(r.forwarded_to_agent_at)}` : 'Invia copia all\'agente'}>{r.forwarded_to_agent_at ? 'Copia inviata' : 'Copia all\'agente'}</button>}
                      <button className="btn btn-secondary btn-sm" onClick={() => openDetail(r)}>Contatti</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditing(r)}>Modifica</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <Modal title="Nuova proforma da pratica" onClose={() => setCreating(null)}>
          <Field label="Pratica">
            <select className="form-select" value={creating.opId} onChange={e => setCreating({ ...creating, opId: e.target.value })}>
              {operations.map(o => <option key={o.id} value={o.id}>{o.property_name} ({o.type}, {o.status.replace('_', ' ')})</option>)}
            </select>
          </Field>
          <Field label="Intestata a" hint="L'importo e' la provvigione di quella parte, calcolata con le stesse regole del crm; IVA 22% modificabile dopo.">
            <select className="form-select" value={creating.party} onChange={e => setCreating({ ...creating, party: e.target.value as 'venditore' | 'acquirente' })}>
              <option value="acquirente">Acquirente</option>
              <option value="venditore">Venditore</option>
            </select>
          </Field>
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => setCreating(null)}>Annulla</button>
            <button className="btn btn-primary" onClick={createFromOperation} disabled={!creating.opId}>Crea bozza</button>
          </div>
        </Modal>
      )}

      {editing && (
        <Modal title={editing.id ? `Modifica ${editing.number ?? ''}` : 'Nuovo documento'} onClose={() => setEditing(null)}>
          <div className="form-row">
            <Field label="Tipo">
              <select className="form-select" value={editing.doc_type ?? 'proforma'} onChange={e => setEditing(p => ({ ...p, doc_type: e.target.value as AdmInvoice['doc_type'] }))}>
                <option value="proforma">Nota proforma</option><option value="fattura">Fattura</option>
              </select>
            </Field>
            <Field label="Parte">
              <select className="form-select" value={editing.party ?? 'acquirente'} onChange={e => setEditing(p => ({ ...p, party: e.target.value as AdmInvoice['party'] }))}>
                <option value="acquirente">Acquirente</option><option value="venditore">Venditore</option>
              </select>
            </Field>
          </div>
          <Field label="Cliente (intestatario)"><input className="form-input" value={editing.client_name ?? ''} onChange={e => setEditing(p => ({ ...p, client_name: e.target.value }))} /></Field>
          <div className="form-row">
            <Field label="Email"><input className="form-input" value={editing.client_email ?? ''} onChange={e => setEditing(p => ({ ...p, client_email: e.target.value }))} /></Field>
            <Field label="Codice fiscale / P.IVA"><input className="form-input" value={editing.client_tax_id ?? ''} onChange={e => setEditing(p => ({ ...p, client_tax_id: e.target.value }))} /></Field>
          </div>
          <Field label="Anagrafica cliente">
            <select className="form-select" value={editing.client_id ?? ''} onChange={e => {
              const c = clients.find(x => x.id === e.target.value)
              setEditing(p => ({ ...p, client_id: e.target.value || null, ...(c ? { client_name: p?.client_name || c.name, client_email: p?.client_email || c.email, client_tax_id: p?.client_tax_id || c.codice_fiscale } : {}) }))
            }}>
              <option value="">Non collegato</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Pratica">
            <select className="form-select" value={editing.operation_id ?? ''} onChange={e => setEditing(p => ({ ...p, operation_id: e.target.value || null }))}>
              <option value="">Nessuna</option>
              {operations.map(o => <option key={o.id} value={o.id}>{o.property_name}</option>)}
            </select>
          </Field>
          <Field label="Descrizione"><input className="form-input" value={editing.description ?? ''} onChange={e => setEditing(p => ({ ...p, description: e.target.value }))} /></Field>
          <div className="form-row">
            <Field label="Imponibile (EUR)"><input type="number" step="0.01" className="form-input" value={editing.amount_net ?? ''}
              onChange={e => setEditing(p => ({ ...p, amount_net: e.target.value === '' ? undefined : Number(e.target.value) }))} /></Field>
            <Field label="IVA %" hint={`Totale: ${eur(total)}`}><input type="number" step="0.01" className="form-input" value={editing.vat_pct ?? 22}
              onChange={e => setEditing(p => ({ ...p, vat_pct: Number(e.target.value) }))} /></Field>
          </div>
          <div className="form-row">
            <Field label="Data emissione"><input type="date" className="form-input" value={editing.issue_date ?? ''} onChange={e => setEditing(p => ({ ...p, issue_date: e.target.value, due_date: e.target.value ? addDaysIso(e.target.value, 7) : p?.due_date ?? null }))} /></Field>
            <Field label="Scadenza pagamento"><input type="date" className="form-input" value={editing.due_date ?? ''} onChange={e => setEditing(p => ({ ...p, due_date: e.target.value || null }))} /></Field>
          </div>
          {editing.doc_type === 'fattura' && (
            <div className="form-row">
              <Field label="Stato SDI">
                <select className="form-select" value={editing.sdi_status ?? ''} onChange={e => setEditing(p => ({ ...p, sdi_status: (e.target.value || null) as AdmInvoice['sdi_status'] }))}>
                  <option value="">-</option>
                  {Object.entries(SDI_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </Field>
              <Field label="Numero fattura del provider"><input className="form-input" value={editing.sdi_ref ?? ''} onChange={e => setEditing(p => ({ ...p, sdi_ref: e.target.value }))} /></Field>
            </div>
          )}
          <Field label="Note"><textarea className="form-textarea" value={editing.notes ?? ''} onChange={e => setEditing(p => ({ ...p, notes: e.target.value }))} /></Field>
          <div className="form-actions">
            {editing.id && (
              <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={async () => {
                if (!confirm('Eliminare questo documento?')) return
                const res = await remove(editing.id!)
                if (res.error) toast(res.error, 'error'); else setEditing(null)
              }}>Elimina</button>
            )}
            <button className="btn btn-secondary" onClick={() => setEditing(null)}>Annulla</button>
            <button className="btn btn-primary" onClick={save}>Salva</button>
          </div>
        </Modal>
      )}

      {detail && (
        <Modal title={`Contatti e solleciti ${detail.number ?? ''}`} onClose={() => setDetail(null)}>
          <div style={{ fontSize: 13, marginBottom: 10 }}>{detail.client_name} · {eur(Number(detail.amount_total))}</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => { const n = prompt('Esito della telefonata'); if (n) logEvent(detail, 'sollecito_telefonico', n) }}>+ Telefonata</button>
            <button className="btn btn-secondary btn-sm" onClick={() => { const n = prompt('Data promessa e note'); if (n) logEvent(detail, 'promessa_pagamento', n) }}>+ Promessa di pagamento</button>
            <button className="btn btn-secondary btn-sm" onClick={() => { const n = prompt('Nota'); if (n) logEvent(detail, 'nota', n) }}>+ Nota</button>
          </div>
          {events.length === 0 ? <div style={{ fontSize: 12, color: 'var(--g)' }}>Nessun contatto registrato.</div> : events.map(e => (
            <div key={e.id} style={{ padding: '6px 0', borderTop: '1px solid var(--bd)', fontSize: 12 }}>
              <strong>{fmtDate(e.happened_at)}</strong> · {e.kind.replace('_', ' ')} · {e.note}
            </div>
          ))}
          <div className="form-actions"><button className="btn btn-secondary" onClick={() => setDetail(null)}>Chiudi</button></div>
        </Modal>
      )}
    </div>
  )
}
