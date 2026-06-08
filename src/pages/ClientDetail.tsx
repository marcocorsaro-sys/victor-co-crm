import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Client, ClientProperty, OperationWithAgent } from '../lib/supabase'
import { CLIENT_SEGMENT_LABELS, CLIENT_CHANNEL_LABELS } from '../lib/supabase'
import { useOperations } from '../hooks/useOperations'
import { useProfiles } from '../hooks/useProfiles'
import { useClients } from '../hooks/useClients'
import { formatEur, formatDate, toEurInput, parseEurInput } from '../lib/calculations'
import OperationDetailModal from '../components/OperationDetailModal'
import ClientModal from '../components/ClientModal'

const STATUS_LABELS: Record<ClientProperty['status'], string> = {
  venduto_nostra: 'Venduto (nostra agenzia)',
  venduto_altri: 'Venduto (altra agenzia)',
  in_vendita_altri: 'In vendita (altra agenzia)',
  non_in_vendita: 'Non in vendita',
  tracciato: 'Tracciato',
}

const STATUS_COLORS: Record<ClientProperty['status'], { color: string; bg: string }> = {
  venduto_nostra: { color: 'var(--green)', bg: 'rgba(34,197,94,0.15)' },
  venduto_altri: { color: 'var(--g)', bg: 'rgba(128,128,128,0.15)' },
  in_vendita_altri: { color: 'var(--amber)', bg: 'rgba(245,158,11,0.15)' },
  non_in_vendita: { color: 'var(--teal)', bg: 'rgba(45,212,191,0.15)' },
  tracciato: { color: 'var(--ld)', bg: 'rgba(160,160,160,0.15)' },
}

const TYPE_LABELS: Record<Client['type'], string> = {
  acquirente: 'Acquirente',
  venditore: 'Venditore',
  entrambi: 'Entrambi',
}

export default function ClientDetail() {
  const { clientId } = useParams<{ clientId: string }>()
  const navigate = useNavigate()
  const { operations } = useOperations()

  const [client, setClient] = useState<Client | null>(null)
  const [properties, setProperties] = useState<ClientProperty[]>([])
  const [loading, setLoading] = useState(true)
  const { agents } = useProfiles()
  const { updateClient } = useClients()
  const [showPropModal, setShowPropModal] = useState(false)
  const [editingProp, setEditingProp] = useState<ClientProperty | null>(null)
  const [detailOp, setDetailOp] = useState<OperationWithAgent | null>(null)
  const [showEditClient, setShowEditClient] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    if (!clientId) return
    setLoading(true)
    const [clientRes, propsRes] = await Promise.all([
      supabase.from('clients').select('*').eq('id', clientId).single(),
      supabase.from('client_properties').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
    ])
    if (clientRes.data) setClient(clientRes.data as Client)
    if (propsRes.data) setProperties(propsRes.data as ClientProperty[])
    setLoading(false)
  }, [clientId])

  useEffect(() => { fetchData() }, [fetchData])

  // Find linked operations (buyer name match or client_id)
  const linkedOps = operations.filter(o => {
    if (o.client_id === clientId) return true
    if (!client) return false
    const buyerName = [o.buyer_first_name, o.buyer_last_name].filter(Boolean).join(' ').toLowerCase()
    const clientName = client.name.toLowerCase()
    return buyerName && clientName && buyerName === clientName
  })

  const handleAddProperty = async (data: Partial<ClientProperty>) => {
    const { error } = await supabase.from('client_properties').insert({ ...data, client_id: clientId })
    if (!error) { fetchData(); setShowPropModal(false) }
  }

  const handleEditProperty = async (data: Partial<ClientProperty>) => {
    if (!editingProp) return
    const { error } = await supabase.from('client_properties').update(data).eq('id', editingProp.id)
    if (!error) { fetchData(); setEditingProp(null); setShowPropModal(false) }
  }

  const handleDeleteProperty = async (id: string) => {
    if (!confirm('Eliminare questo immobile tracciato?')) return
    await supabase.from('client_properties').delete().eq('id', id)
    fetchData()
  }

  const mono = { fontFamily: "'JetBrains Mono', monospace" } as const

  if (loading) {
    return <div style={{ padding: 40 }}><div className="skeleton skeleton-row" style={{ height: 200 }} /></div>
  }

  if (!client) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: 'var(--g)' }}>Cliente non trovato</p>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>Torna indietro</button>
      </div>
    )
  }

  const fullName = client.name
  const mapsUrl = client.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.address)}` : null

  // Prossimo contatto dovuto = ultimo contatto + cadenza (mesi)
  const contactStatus = (() => {
    if (client.do_not_contact) return { label: 'Escluso dal dialogo periodico', color: 'var(--g)', due: null as Date | null, overdue: false }
    const cadence = client.contact_cadence_months || 12
    const base = client.last_contact_at ? new Date(client.last_contact_at) : null
    const due = base ? new Date(base.getFullYear(), base.getMonth() + cadence, base.getDate()) : null
    const snooze = client.snooze_until ? new Date(client.snooze_until) : null
    const effectiveDue = snooze && (!due || snooze > due) ? snooze : due
    const today = new Date(); today.setHours(0, 0, 0, 0)
    if (!effectiveDue) return { label: 'Mai contattato — da pianificare', color: 'var(--amber)', due: null, overdue: true }
    const daysUntil = Math.round((effectiveDue.getTime() - today.getTime()) / 86400000)
    if (daysUntil < 0) return { label: `In ritardo di ${-daysUntil} giorni`, color: 'var(--amber)', due: effectiveDue, overdue: true }
    if (daysUntil <= 30) return { label: `Tra ${daysUntil} giorni`, color: 'var(--teal)', due: effectiveDue, overdue: false }
    return { label: formatDate(effectiveDue.toISOString().slice(0, 10)), color: 'var(--green)', due: effectiveDue, overdue: false }
  })()

  const initials = client.name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?'
  const whatsappUrl = client.phone ? `https://wa.me/${client.phone.replace(/[^\d]/g, '').replace(/^00/, '')}` : null
  const edit = () => setShowEditClient(true)

  const markContacted = async () => {
    setSaving(true)
    await updateClient(client.id, { last_contact_at: new Date().toISOString() })
    await fetchData()
    setSaving(false)
  }

  // Badge data di nascita (compleanno imminente)
  const birthday = client.birth_date ? (() => {
    const bd = new Date(client.birth_date)
    const today = new Date()
    const age = today.getFullYear() - bd.getFullYear() - (today < new Date(today.getFullYear(), bd.getMonth(), bd.getDate()) ? 1 : 0)
    const nextBd = new Date(today.getFullYear(), bd.getMonth(), bd.getDate())
    if (nextBd < today) nextBd.setFullYear(today.getFullYear() + 1)
    const daysUntil = Math.round((nextBd.getTime() - today.getTime()) / 86400000)
    return { age, daysUntil }
  })() : null

  return (
    <div>
      {/* ─── Header hero ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)} style={{ flexShrink: 0 }}>←</button>
          <div style={{
            width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(200,230,74,0.18), rgba(45,212,191,0.12))',
            border: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            ...mono, fontWeight: 700, fontSize: 18, color: 'var(--lime)',
          }}>{initials}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--w)', lineHeight: 1.1 }}>{fullName}</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
              <span className={`badge badge-${client.type === 'acquirente' ? 'pipeline' : client.type === 'venditore' ? 'vendita' : 'completata'}`}>
                {TYPE_LABELS[client.type]}
              </span>
              {client.segment && <Chip text={CLIENT_SEGMENT_LABELS[client.segment]} color="var(--teal)" />}
              {client.tier && <Chip text={`Tier ${client.tier}`} color={client.tier === 'A' ? 'var(--lime)' : client.tier === 'B' ? 'var(--teal)' : 'var(--g)'} />}
              <span style={{ fontSize: 11, color: 'var(--g)' }}>· dal {formatDate(client.date_added)}</span>
            </div>
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={edit} style={{ flexShrink: 0 }}>✎ Modifica</button>
      </div>

      {/* ─── Banner Prossimo contatto (focale) ─── */}
      <div style={{
        background: 'var(--s1)', borderRadius: 12, padding: 16, marginBottom: 16,
        border: '1px solid var(--bd)', borderLeft: `3px solid ${contactStatus.color}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...mono, fontSize: 10, color: 'var(--ld)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
            // Prossimo contatto
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: contactStatus.color, display: 'flex', alignItems: 'center', gap: 8 }}>
            {contactStatus.overdue && <span style={{ fontSize: 10 }}>●</span>}
            {contactStatus.label}
          </div>
          <div style={{ fontSize: 12, color: 'var(--g)', marginTop: 4 }}>
            Ultimo contatto: <span style={{ color: 'var(--gl)' }}>{client.last_contact_at ? formatDate(client.last_contact_at.slice(0, 10)) : 'mai registrato'}</span>
            {' · '}cadenza <span style={{ color: 'var(--gl)' }}>{client.contact_cadence_months || 12} mesi</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {client.phone && <a href={`tel:${client.phone}`} className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>📞 Chiama</a>}
          {whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>WhatsApp</a>}
          {client.email && <a href={`mailto:${client.email}`} className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>✉ Email</a>}
          <button className="btn btn-primary btn-sm" onClick={markContacted} disabled={saving}>
            {saving ? '...' : '✓ Segna contattato'}
          </button>
        </div>
      </div>

      {/* ─── Info cards: Contatti | Relazione ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 16 }}>
        {/* Contatti & anagrafica */}
        <Card title="Contatti & anagrafica">
          <Detail label="Telefono" filled={!!client.phone} onAdd={edit}
            value={<a href={`tel:${client.phone}`} style={{ color: 'var(--teal)', textDecoration: 'none' }}>{client.phone}</a>} />
          <Detail label="Email" filled={!!client.email} onAdd={edit}
            value={<a href={`mailto:${client.email}`} style={{ color: 'var(--teal)', textDecoration: 'none' }}>{client.email}</a>} />
          <Detail label="Indirizzo" filled={!!client.address} onAdd={edit}
            value={<a href={mapsUrl || '#'} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal)', textDecoration: 'none' }}>{client.address} ↗</a>} />
          <Detail label="Data di nascita" filled={!!client.birth_date} onAdd={edit} value={
            <span>
              {client.birth_date && formatDate(client.birth_date)}{birthday && ` · ${birthday.age} anni`}
              {birthday && birthday.daysUntil <= 30 && (
                <span style={{ marginLeft: 8, ...mono, fontSize: 11, fontWeight: 700, color: birthday.daysUntil === 0 ? 'var(--green)' : 'var(--amber)' }}>
                  {birthday.daysUntil === 0 ? '🎂 OGGI!' : birthday.daysUntil === 1 ? 'domani!' : `tra ${birthday.daysUntil}gg`}
                </span>
              )}
            </span>
          } />
          <Detail label="Azienda" filled={!!client.company} onAdd={edit} value={client.company} />
          <Detail label="Provenienza" filled={!!client.source} onAdd={edit} value={client.source} />
        </Card>

        {/* Relazione & contatto periodico */}
        <Card title="Relazione & contatto periodico">
          <Detail label="Segmento" filled={!!client.segment} onAdd={edit} value={client.segment && CLIENT_SEGMENT_LABELS[client.segment]} />
          <Detail label="Priorità" filled={!!client.tier} onAdd={edit} value={client.tier && `Tier ${client.tier}`} />
          <Detail label="Canale preferito" filled={!!client.preferred_channel} onAdd={edit} value={client.preferred_channel && CLIENT_CHANNEL_LABELS[client.preferred_channel]} />
          <Detail label="Cadenza contatto" filled value={`${client.contact_cadence_months || 12} mesi`} />
          <Detail label="Anniversario rogito" filled={!!client.rogito_date} onAdd={edit} value={client.rogito_date && formatDate(client.rogito_date)} />
          <Detail label="Posticipato al" filled={!!client.snooze_until} onAdd={edit} value={client.snooze_until && formatDate(client.snooze_until)} />
          <Detail label="Dialogo periodico" filled value={
            <span style={{ color: client.do_not_contact ? 'var(--g)' : 'var(--green)' }}>{client.do_not_contact ? 'Escluso' : 'Attivo'}</span>
          } />
        </Card>
      </div>

      {/* ─── Riepilogo KPI ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Kpi label="Operazioni" value={String(linkedOps.length)} color="var(--w)" />
        <Kpi label="Immobili tracciati" value={String(properties.length)} color="var(--amber)" />
        <Kpi label="Completate" value={String(linkedOps.filter(o => o.status === 'incassato').length)} color="var(--green)" />
        <Kpi label="Valore totale" value={formatEur(linkedOps.reduce((s, o) => s + (o.final_value || o.property_value || 0), 0))} color="var(--w)" mono />
      </div>

      {/* ─── Note ─── */}
      <div style={{ background: 'var(--s1)', borderRadius: 12, padding: 16, border: '1px solid var(--bd)', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ ...mono, fontSize: 11, color: 'var(--ld)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>// Note</div>
          <button className="btn btn-secondary btn-sm" onClick={edit} style={{ fontSize: 11, padding: '3px 8px' }}>✎</button>
        </div>
        {client.notes ? (
          <div style={{ color: 'var(--gl)', fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{client.notes}</div>
        ) : (
          <button onClick={edit} style={{ background: 'none', border: 'none', color: 'var(--g)', cursor: 'pointer', fontSize: 13, padding: 0 }}>
            + Aggiungi una nota su questo contatto
          </button>
        )}
      </div>

      {/* ─── Linked Operations ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div className="section-heading" style={{ margin: 0 }}>Operazioni associate</div>
      </div>

      {linkedOps.length === 0 ? (
        <div style={{ background: 'var(--s1)', borderRadius: 12, padding: 24, border: '1px solid var(--bd)', marginBottom: 20, textAlign: 'center', color: 'var(--g)', fontSize: 13 }}>
          Nessuna operazione associata a questo cliente
        </div>
      ) : (
        <div className="table-wrap" style={{ marginBottom: 20 }}>
          <table>
            <thead>
              <tr>
                <th>Immobile</th><th>Tipo</th><th>Stato</th><th>Valore</th><th>Commissioni</th><th>Data</th>
              </tr>
            </thead>
            <tbody>
              {linkedOps.map(op => (
                <tr key={op.id}>
                  <td>
                    <div className="clickable-cell" style={{ fontWeight: 600 }} onClick={() => setDetailOp(op)}>
                      {op.property_name}
                    </div>
                    {op.address && <div style={{ fontSize: 11, color: 'var(--g)' }}>{op.address}</div>}
                  </td>
                  <td><span className={`badge badge-${op.type}`}>{op.type}</span></td>
                  <td><span className={`badge badge-${op.status}`}>{op.status}</span></td>
                  <td style={mono}>{formatEur(op.final_value || op.property_value || 0)}</td>
                  <td style={{ ...mono, color: 'var(--teal)' }}>{op.gross_commission ? formatEur(op.gross_commission) : '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--gl)' }}>{op.sale_date ? formatDate(op.sale_date) : formatDate(op.date_added)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Client Properties (tracked) ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div className="section-heading" style={{ margin: 0 }}>Immobili tracciati</div>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditingProp(null); setShowPropModal(true) }}>
          + Aggiungi immobile
        </button>
      </div>

      {properties.length === 0 ? (
        <div style={{ background: 'var(--s1)', borderRadius: 12, padding: 24, border: '1px solid var(--bd)', textAlign: 'center', color: 'var(--g)', fontSize: 13 }}>
          Nessun immobile tracciato per questo cliente.
          <br />
          <span style={{ fontSize: 11 }}>Usa questa sezione per tracciare immobili in vendita da altre agenzie, non ancora sul mercato, o già venduti.</span>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {properties.map(prop => {
            const sc = STATUS_COLORS[prop.status]
            return (
              <div key={prop.id} style={{
                background: 'var(--s1)', borderRadius: 12, padding: 16,
                border: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, color: 'var(--w)', fontSize: 14 }}>{prop.property_name}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6, color: sc.color, background: sc.bg }}>
                      {STATUS_LABELS[prop.status]}
                    </span>
                  </div>
                  {prop.address && (
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(prop.address)}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 12, color: 'var(--g)', textDecoration: 'none' }}>
                      {prop.address} ↗
                    </a>
                  )}
                  <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 12 }}>
                    {prop.property_value != null && prop.property_value > 0 && (
                      <span style={{ color: 'var(--g)' }}>Valore: <span style={{ ...mono, color: 'var(--w)' }}>{formatEur(prop.property_value)}</span></span>
                    )}
                    {prop.agency_name && (
                      <span style={{ color: 'var(--g)' }}>Agenzia: <span style={{ color: 'var(--gl)' }}>{prop.agency_name}</span></span>
                    )}
                  </div>
                  {prop.notes && <div style={{ fontSize: 11, color: 'var(--g)', marginTop: 4 }}>{prop.notes}</div>}
                </div>
                <div style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setEditingProp(prop); setShowPropModal(true) }}>✎</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDeleteProperty(prop.id)}>✕</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Property modal */}
      {showPropModal && (
        <PropertyModal
          initial={editingProp}
          onClose={() => { setShowPropModal(false); setEditingProp(null) }}
          onSave={editingProp ? handleEditProperty : handleAddProperty}
        />
      )}

      <OperationDetailModal open={!!detailOp} operation={detailOp}
        onClose={() => setDetailOp(null)} onEdit={() => setDetailOp(null)} />

      {/* Edit client modal */}
      <ClientModal
        open={showEditClient}
        onClose={() => setShowEditClient(false)}
        onSave={async (data) => {
          if (!client) return
          await updateClient(client.id, data)
          setShowEditClient(false)
          fetchData()
        }}
        initial={client}
        agents={agents}
      />
    </div>
  )
}

/* ─── Sub-components ─── */

const monoFont = { fontFamily: "'JetBrains Mono', monospace" } as const

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--s1)', borderRadius: 12, padding: 16, border: '1px solid var(--bd)' }}>
      <div style={{ ...monoFont, fontSize: 11, color: 'var(--ld)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
        // {title}
      </div>
      <div style={{ display: 'grid', gap: 2, fontSize: 13 }}>{children}</div>
    </div>
  )
}

/** Riga etichetta/valore; se vuota mostra un invito "+ aggiungi" cliccabile per arricchire la scheda. */
function Detail({ label, value, filled, onAdd }: {
  label: string
  value: React.ReactNode
  filled: boolean
  onAdd?: () => void
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--bd)' }}>
      <span style={{ color: 'var(--g)', whiteSpace: 'nowrap' }}>{label}</span>
      {filled ? (
        <span style={{ color: 'var(--w)', textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere' }}>{value}</span>
      ) : (
        <button onClick={onAdd} disabled={!onAdd} style={{
          background: 'none', border: 'none', padding: 0, fontSize: 12,
          color: onAdd ? 'var(--ld)' : 'var(--g)', cursor: onAdd ? 'pointer' : 'default',
        }}>{onAdd ? '+ aggiungi' : '—'}</button>
      )}
    </div>
  )
}

function Chip({ text, color }: { text: string; color: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
      color, background: 'color-mix(in srgb, ' + color + ' 14%, transparent)',
      border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
      textTransform: 'uppercase', letterSpacing: '0.3px',
    }}>{text}</span>
  )
}

function Kpi({ label, value, color, mono }: { label: string; value: string; color: string; mono?: boolean }) {
  return (
    <div style={{ background: 'var(--s1)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--bd)' }}>
      <div style={{ fontSize: 10, color: 'var(--g)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color, ...(mono ? monoFont : {}) }}>{value}</div>
    </div>
  )
}

function PropertyModal({ initial, onClose, onSave }: {
  initial: ClientProperty | null
  onClose: () => void
  onSave: (data: Partial<ClientProperty>) => void
}) {
  const [form, setForm] = useState({
    property_name: initial?.property_name || '',
    address: initial?.address || '',
    property_value: initial?.property_value ? toEurInput(initial.property_value) : '',
    status: initial?.status || 'tracciato' as ClientProperty['status'],
    agency_name: initial?.agency_name || '',
    notes: initial?.notes || '',
  })

  const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }))
  const mono = { fontFamily: "'JetBrains Mono', monospace" }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.property_name.trim()) return
    onSave({
      property_name: form.property_name.trim(),
      address: form.address.trim() || null,
      property_value: form.property_value ? parseEurInput(form.property_value) : null,
      status: form.status as ClientProperty['status'],
      agency_name: form.agency_name.trim() || null,
      notes: form.notes.trim() || null,
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-title">{initial ? 'Modifica Immobile' : 'Aggiungi Immobile Tracciato'}</div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Nome immobile *</label>
            <input className="form-input" value={form.property_name}
              onChange={e => set('property_name', e.target.value)}
              placeholder="es. Villa Via Roma 15" autoFocus />
          </div>

          <div className="form-group">
            <label className="form-label">Indirizzo</label>
            <input className="form-input" value={form.address}
              onChange={e => set('address', e.target.value)}
              placeholder="Via, CAP, Città" />
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Valore stimato (EUR)</label>
              <input className="form-input" type="text" inputMode="decimal"
                value={form.property_value}
                onChange={e => set('property_value', e.target.value)}
                onFocus={e => { const n = parseEurInput(e.target.value); if (n) e.target.value = String(n) }}
                onBlur={e => { const n = parseEurInput(e.target.value); set('property_value', n ? toEurInput(n) : '') }}
                placeholder="0,00" style={mono} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Agenzia (se altra)</label>
              <input className="form-input" value={form.agency_name}
                onChange={e => set('agency_name', e.target.value)}
                placeholder="Nome agenzia" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Stato</label>
            <select className="form-select" value={form.status}
              onChange={e => set('status', e.target.value)}>
              <option value="tracciato">Tracciato</option>
              <option value="non_in_vendita">Non in vendita</option>
              <option value="in_vendita_altri">In vendita (altra agenzia)</option>
              <option value="venduto_nostra">Venduto (nostra agenzia)</option>
              <option value="venduto_altri">Venduto (altra agenzia)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Note</label>
            <textarea className="form-textarea" rows={2}
              value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Note sull'immobile..." style={{ resize: 'vertical' }} />
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Annulla</button>
            <button type="submit" className="btn btn-primary">{initial ? 'Salva' : 'Aggiungi'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
