import { useEffect, useMemo, useState } from 'react'
import type { Profile } from '../../lib/supabase'
import { supabase } from '../../lib/supabase'
import { useAdmTable } from '../../hooks/useAdm'
import { LEAD_STATUS_LABELS, PORTALS, fmtDate, type AdmLead, type LeadStatus } from '../../lib/amministrazione'
import { Empty, Field, Head, Kpi, Modal, Pill, SetupNotice, type Tone } from './ui'

type Props = { agents: Profile[]; toast: (m: string, t?: 'success' | 'error' | 'info') => void }

const TONE: Record<LeadStatus, Tone> = { nuova: 'red', inoltrata: 'amber', presa_in_carico: 'teal', contattata: 'green', chiusa: 'g' }

type SiteRow = {
  key: string; table: 'property_inquiries' | 'website_contacts'; id: string
  name: string | null; email: string | null; phone: string | null; message: string | null
  title: string | null; created_at: string
}

function hoursSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 3600000)
}

export default function RichiestePortali({ agents, toast }: Props) {
  const { rows, loading, error, add, update, remove, refetch } = useAdmTable<AdmLead>('adm_leads', { orderBy: 'received_at', ascending: false })
  const [filter, setFilter] = useState<'da_gestire' | 'in_corso' | 'chiuse'>('da_gestire')
  const [editing, setEditing] = useState<Partial<AdmLead> | null>(null)
  const [site, setSite] = useState<SiteRow[]>([])

  // richieste arrivate dal sito, non ancora importate in coda
  useEffect(() => {
    (async () => {
      const [a, b] = await Promise.all([
        supabase.from('property_inquiries').select('id, name, email, phone, message, property_title, created_at').order('created_at', { ascending: false }).limit(50),
        supabase.from('website_contacts').select('id, name, surname, email, phone, message, created_at').order('created_at', { ascending: false }).limit(50),
      ])
      const out: SiteRow[] = []
      for (const r of (a.data ?? []) as Array<Record<string, string | null>>) {
        out.push({ key: `property_inquiries:${r.id}`, table: 'property_inquiries', id: String(r.id), name: r.name, email: r.email, phone: r.phone, message: r.message, title: r.property_title, created_at: String(r.created_at) })
      }
      for (const r of (b.data ?? []) as Array<Record<string, string | null>>) {
        out.push({ key: `website_contacts:${r.id}`, table: 'website_contacts', id: String(r.id), name: [r.name, r.surname].filter(Boolean).join(' '), email: r.email, phone: r.phone, message: r.message, title: null, created_at: String(r.created_at) })
      }
      setSite(out)
    })()
  }, [])

  const imported = useMemo(() => new Set(rows.filter(r => r.source_table).map(r => `${r.source_table}:${r.source_id}`)), [rows])
  const pendingSite = site.filter(s => !imported.has(s.key))
  const agentName = (id: string | null) => agents.find(a => a.id === id)?.full_name ?? '-'

  const visible = rows.filter(r =>
    filter === 'da_gestire' ? (r.status === 'nuova' || r.status === 'inoltrata')
      : filter === 'in_corso' ? (r.status === 'presa_in_carico' || r.status === 'contattata')
        : r.status === 'chiusa')
  const unassigned = rows.filter(r => r.status === 'nuova').length
  const stale = rows.filter(r => r.status === 'inoltrata' && r.forwarded_at && hoursSince(r.forwarded_at) >= 24).length

  const importSite = async (s: SiteRow) => {
    const res = await add({
      portal: 'sito victorcorealestate', name: s.name, email: s.email, phone: s.phone, message: s.message,
      property_title: s.title, received_at: s.created_at, source_table: s.table, source_id: s.id,
    })
    if (res.error) toast(res.error, 'error')
  }

  const forward = async (r: AdmLead) => {
    const agent = agents.find(a => a.id === r.assigned_agent_id)
    if (!agent) { toast('Assegna prima un agente', 'error'); return }
    const subject = `Nuova richiesta ${r.portal}${r.property_title ? ` - ${r.property_title}` : ''}`
    const body = [
      `Ciao ${agent.first_name || agent.full_name},`, '',
      `e' arrivata una richiesta da ${r.portal}${r.property_title ? ` per ${r.property_title}` : ''}${r.property_ref ? ` (rif. ${r.property_ref})` : ''}.`, '',
      `Nome: ${r.name ?? '-'}`, `Telefono: ${r.phone ?? '-'}`, `Email: ${r.email ?? '-'}`, '',
      r.message ? `Messaggio: ${r.message}` : '', '',
      'Per favore ricontatta il cliente entro oggi e segna la presa in carico nel crm.',
    ].join('\n')
    if (agent.display_email) {
      window.open(`mailto:${agent.display_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank')
    } else if (agent.phone) {
      window.open(`https://wa.me/${agent.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(body)}`, '_blank')
    } else {
      navigator.clipboard?.writeText(body)
      toast('Nessun contatto dell\'agente: testo copiato negli appunti', 'info')
    }
    const res = await update(r.id, { status: 'inoltrata', forwarded_at: new Date().toISOString() })
    if (res.error) toast(res.error, 'error')
  }

  const setStatus = async (r: AdmLead, status: LeadStatus) => {
    const patch: Partial<AdmLead> = { status }
    if (status === 'contattata' && !r.first_contact_at) patch.first_contact_at = new Date().toISOString()
    const res = await update(r.id, patch)
    if (res.error) toast(res.error, 'error')
  }

  const save = async () => {
    if (!editing?.name?.trim() && !editing?.phone?.trim() && !editing?.email?.trim()) { toast('Inserisci almeno un recapito', 'error'); return }
    const { id, ...values } = editing
    const res = id ? await update(id, values) : await add(values)
    if (res.error) toast(res.error, 'error'); else { toast('Richiesta salvata'); setEditing(null) }
  }

  return (
    <div>
      <Head
        title="Richieste dai portali"
        hint="Coda unica delle richieste di acquisto: le inserisci da mail dei portali oppure le importi dal sito. Assegni l'agente, giri il messaggio, e il crm segnala quelle ferme da oltre 24 ore."
        action={<button className="btn btn-primary" onClick={() => setEditing({ portal: 'immobiliare.it', status: 'nuova' })}>+ Nuova richiesta</button>}
      />
      <SetupNotice error={error} />
      <div className="kpi-grid" style={{ marginBottom: 16 }}>
        <Kpi label="Da assegnare" value={unassigned} tone={unassigned ? 'red' : 'green'} />
        <Kpi label="Inoltrate da oltre 24 ore" value={stale} tone={stale ? 'amber' : 'green'} />
        <Kpi label="Dal sito, non importate" value={pendingSite.length} tone={pendingSite.length ? 'teal' : undefined} />
      </div>

      {pendingSite.length > 0 && (
        <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Richieste arrivate dal sito, da portare in coda</div>
          {pendingSite.slice(0, 8).map(s => (
            <div key={s.key} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '5px 0', borderTop: '1px solid var(--bd)', fontSize: 12 }}>
              <span style={{ width: 80, color: 'var(--g)' }}>{fmtDate(s.created_at)}</span>
              <span style={{ flex: 1 }}>{s.name ?? '-'} · {s.title ?? s.message?.slice(0, 60) ?? ''}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => importSite(s)}>Porta in coda</button>
            </div>
          ))}
        </div>
      )}

      <div className="tabs">
        {([['da_gestire', 'Da gestire'], ['in_corso', 'In corso'], ['chiuse', 'Chiuse']] as const).map(([k, l]) => (
          <button key={k} className={`tab ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      {loading ? <div className="skeleton" style={{ height: 160, borderRadius: 10 }} /> : visible.length === 0 ? <Empty text="Nessuna richiesta in questa vista." /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Ricevuta</th><th>Portale</th><th>Cliente</th><th>Immobile</th><th>Agente</th><th>Stato</th><th></th></tr></thead>
            <tbody>
              {visible.map(r => (
                <tr key={r.id}>
                  <td>{fmtDate(r.received_at)}</td>
                  <td>{r.portal}</td>
                  <td style={{ whiteSpace: 'normal', minWidth: 180 }}>
                    <div style={{ fontWeight: 600 }}>{r.name ?? '-'}</div>
                    <div style={{ fontSize: 11, color: 'var(--g)' }}>{[r.phone, r.email].filter(Boolean).join(' · ')}</div>
                  </td>
                  <td style={{ whiteSpace: 'normal', minWidth: 140 }}>{r.property_title ?? r.property_ref ?? '-'}</td>
                  <td>
                    <select className="form-select" style={{ minWidth: 150, padding: '4px 28px 4px 8px', fontSize: 12 }} value={r.assigned_agent_id ?? ''}
                      onChange={async e => { const res = await update(r.id, { assigned_agent_id: e.target.value || null }); if (res.error) toast(res.error, 'error') }}>
                      <option value="">Assegna...</option>
                      {agents.filter(a => a.active).map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                    </select>
                  </td>
                  <td>
                    <Pill tone={TONE[r.status]}>{LEAD_STATUS_LABELS[r.status]}</Pill>
                    {r.status === 'inoltrata' && r.forwarded_at && hoursSince(r.forwarded_at) >= 24 && <> <Pill tone="red">ferma da {Math.floor(hoursSince(r.forwarded_at) / 24)} gg</Pill></>}
                  </td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    {(r.status === 'nuova' || r.status === 'inoltrata') && (
                      <button className="btn btn-success btn-sm" onClick={() => forward(r)} title={r.assigned_agent_id ? `Gira a ${agentName(r.assigned_agent_id)}` : 'Assegna prima un agente'}>Inoltra</button>
                    )}
                    {r.status === 'inoltrata' && <button className="btn btn-secondary btn-sm" onClick={() => setStatus(r, 'presa_in_carico')}>Presa in carico</button>}
                    {r.status === 'presa_in_carico' && <button className="btn btn-secondary btn-sm" onClick={() => setStatus(r, 'contattata')}>Contattata</button>}
                    {r.status === 'contattata' && <button className="btn btn-secondary btn-sm" onClick={() => setStatus(r, 'chiusa')}>Chiudi</button>}
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditing(r)}>Modifica</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Modal title={editing.id ? 'Modifica richiesta' : 'Nuova richiesta'} onClose={() => setEditing(null)}>
          <div className="form-row">
            <Field label="Portale">
              <select className="form-select" value={editing.portal ?? 'altro'} onChange={e => setEditing(p => ({ ...p, portal: e.target.value }))}>
                {PORTALS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Agente">
              <select className="form-select" value={editing.assigned_agent_id ?? ''} onChange={e => setEditing(p => ({ ...p, assigned_agent_id: e.target.value || null }))}>
                <option value="">Da assegnare</option>
                {agents.filter(a => a.active).map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Nome"><input className="form-input" value={editing.name ?? ''} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} /></Field>
          <div className="form-row">
            <Field label="Telefono"><input className="form-input" value={editing.phone ?? ''} onChange={e => setEditing(p => ({ ...p, phone: e.target.value }))} /></Field>
            <Field label="Email"><input className="form-input" value={editing.email ?? ''} onChange={e => setEditing(p => ({ ...p, email: e.target.value }))} /></Field>
          </div>
          <div className="form-row">
            <Field label="Immobile"><input className="form-input" value={editing.property_title ?? ''} onChange={e => setEditing(p => ({ ...p, property_title: e.target.value }))} /></Field>
            <Field label="Riferimento annuncio"><input className="form-input" value={editing.property_ref ?? ''} onChange={e => setEditing(p => ({ ...p, property_ref: e.target.value }))} /></Field>
          </div>
          <Field label="Messaggio del cliente"><textarea className="form-textarea" value={editing.message ?? ''} onChange={e => setEditing(p => ({ ...p, message: e.target.value }))} /></Field>
          <Field label="Note interne"><textarea className="form-textarea" value={editing.notes ?? ''} onChange={e => setEditing(p => ({ ...p, notes: e.target.value }))} /></Field>
          <div className="form-actions">
            {editing.id && (
              <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={async () => {
                if (!confirm('Eliminare questa richiesta?')) return
                const res = await remove(editing.id!)
                if (res.error) toast(res.error, 'error'); else { setEditing(null); refetch() }
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
