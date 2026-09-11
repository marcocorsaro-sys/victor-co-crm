import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Client } from '../lib/supabase'
import { useClients } from '../hooks/useClients'
import { useProfiles } from '../hooks/useProfiles'
import { useToast } from '../hooks/useToast'
import { formatDateTime, formatDate } from '../lib/calculations'
import { exportCsv } from '../lib/exportCsv'
import ClientModal from '../components/ClientModal'
import ClientDetailModal from '../components/ClientDetailModal'
import ToastContainer from '../components/ToastContainer'

const PAGE_SIZE = 20

const TYPE_LABELS: Record<Client['type'], string> = {
  acquirente: 'Acquirente',
  venditore: 'Venditore',
  entrambi: 'Entrambi',
}

const TYPE_COLORS: Record<Client['type'], string> = {
  acquirente: 'badge-pipeline',
  venditore: 'badge-vendita',
  entrambi: 'badge-completata',
}

export default function AdminClients() {
  const navigate = useNavigate()
  const { clients, loading, addClient, updateClient, deleteClient } = useClients()
  const { agents } = useProfiles()
  const { toasts, addToast } = useToast()

  // Birthday panel: next 30 days
  const upcomingBirthdays = useMemo(() => {
    const today = new Date()
    return clients
      .filter(c => c.birth_date)
      .map(c => {
        const bd = new Date(c.birth_date!)
        const nextBd = new Date(today.getFullYear(), bd.getMonth(), bd.getDate())
        if (nextBd < today) nextBd.setFullYear(today.getFullYear() + 1)
        const daysUntil = Math.round((nextBd.getTime() - today.getTime()) / 86400000)
        const age = nextBd.getFullYear() - bd.getFullYear()
        return { client: c, nextBd, daysUntil, age }
      })
      .filter(b => b.daysUntil <= 30)
      .sort((a, b) => a.daysUntil - b.daysUntil)
  }, [clients])

  const [showModal, setShowModal] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [detailClient, setDetailClient] = useState<Client | null>(null)
  const [search, setSearch] = useState('')
  const [fType, setFType] = useState('')
  const [page, setPage] = useState(0)

  const filtered = clients.filter(c => {
    if (fType && c.type !== fType) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        c.name.toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.address || '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const handleCreate = async (data: Partial<Client>) => {
    const { error } = await addClient(data)
    if (error) addToast('Errore nella creazione', 'error')
    else { addToast('Cliente creato', 'success'); setShowModal(false) }
  }

  const handleUpdate = async (data: Partial<Client>) => {
    if (!editingClient) return
    const { error } = await updateClient(editingClient.id, data)
    if (error) addToast('Errore nella modifica', 'error')
    else { addToast('Cliente modificato', 'success'); setEditingClient(null); setShowModal(false) }
  }

  const handleDelete = async (id: string) => {
    const client = clients.find(c => c.id === id)
    if (!client || !confirm(`Eliminare ${client.name}?`)) return
    const { error } = await deleteClient(id)
    if (error) addToast("Errore nell'eliminazione", 'error')
    else addToast('Cliente eliminato', 'success')
  }

  const handleExport = () => {
    const headers = ['Nome', 'Cognome', 'Telefono', 'Email', 'Tipo', 'Indirizzo', 'Note', 'Data inserimento']
    const rows = filtered.map(c => [
      c.first_name || '', c.last_name || '',
      c.phone || '', c.email || '', TYPE_LABELS[c.type],
      c.address || '', c.notes || '', formatDateTime(c.date_added),
    ])
    exportCsv(headers, rows, `victorco-clienti-${new Date().toISOString().split('T')[0]}.csv`)
  }

  return (
    <div>
      <ToastContainer toasts={toasts} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="section-heading" style={{ margin: 0 }}>
          Gestione Clienti
          <span style={{ fontSize: 13, color: 'var(--g)', fontWeight: 400, marginLeft: 8 }}>({filtered.length})</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={handleExport}>Export CSV</button>
          <button className="btn btn-primary" onClick={() => { setEditingClient(null); setShowModal(true) }}>+ Nuovo Cliente</button>
        </div>
      </div>

      <div className="filters-bar">
        <input className="filter-input" placeholder="Cerca nome, telefono, email, indirizzo..."
          value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} style={{ minWidth: 280 }} />
        <select className="filter-select" value={fType} onChange={e => { setFType(e.target.value); setPage(0) }}>
          <option value="">Tutti i tipi</option>
          <option value="acquirente">Acquirente</option>
          <option value="venditore">Venditore</option>
          <option value="entrambi">Entrambi</option>
        </select>
      </div>

      {/* Birthday panel */}
      {upcomingBirthdays.length > 0 && (
        <div style={{ background: 'var(--s1)', borderRadius: 12, padding: 16, border: '1px solid var(--bd)', marginBottom: 16 }}>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: 'var(--ld)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
            // Compleanni in arrivo (30 giorni)
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {upcomingBirthdays.map(b => (
              <div key={b.client.id} style={{
                background: 'var(--bg2)', borderRadius: 10, padding: '10px 14px', border: '1px solid var(--bd)',
                minWidth: 180, flexShrink: 0,
              }}>
                <div style={{ fontWeight: 600, color: 'var(--w)', fontSize: 13, marginBottom: 4 }}>
                  {b.client.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--g)', marginBottom: 6 }}>
                  {formatDate(b.client.birth_date!)} · {b.age} anni
                </div>
                <div style={{
                  fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 700,
                  color: b.daysUntil === 0 ? 'var(--green)' : b.daysUntil <= 7 ? 'var(--amber)' : 'var(--teal)',
                }}>
                  {b.daysUntil === 0 ? 'OGGI!' : b.daysUntil === 1 ? 'Domani' : `Tra ${b.daysUntil} giorni`}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  {b.client.phone && (
                    <a href={`tel:${b.client.phone}`} className="btn btn-secondary btn-sm" style={{ fontSize: 10, textDecoration: 'none' }}>
                      Chiama
                    </a>
                  )}
                  {b.client.email && (
                    <a href={`mailto:${b.client.email}?subject=Auguri!`} className="btn btn-secondary btn-sm" style={{ fontSize: 10, textDecoration: 'none' }}>
                      Email
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Nome</th><th>Telefono</th><th>Email</th><th>Tipo</th><th>Indirizzo</th><th>Inserito</th><th>Azioni</th></tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={7}><div className="skeleton skeleton-row" /></td></tr>
              ))
            ) : paged.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--g)', padding: 24 }}>
                {search || fType ? 'Nessun cliente trovato' : 'Nessun cliente ancora inserito'}
              </td></tr>
            ) : (
              paged.map(c => (
                <tr key={c.id}>
                  <td>
                    <div>
                      <div className="clickable-cell" style={{ fontWeight: 600 }} onClick={() => navigate(`/admin/client/${c.id}`)}>
                        {c.name}
                      </div>
                      {c.notes && (
                        <div style={{ fontSize: 11, color: 'var(--g)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.notes}
                        </div>
                      )}
                    </div>
                  </td>
                  <td style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12 }}>
                    {c.phone ? <a href={`tel:${c.phone}`} style={{ color: 'var(--w)', textDecoration: 'none' }}>{c.phone}</a> : '—'}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {c.email ? <a href={`mailto:${c.email}`} style={{ color: 'var(--teal)', textDecoration: 'none' }}>{c.email}</a> : '—'}
                  </td>
                  <td><span className={`badge ${TYPE_COLORS[c.type]}`}>{TYPE_LABELS[c.type]}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--gl)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.address ? (
                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`}
                        target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gl)', textDecoration: 'none' }}>
                        {c.address}
                      </a>
                    ) : '—'}
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--g)', whiteSpace: 'nowrap' }}>{formatDateTime(c.date_added)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => { setEditingClient(c); setShowModal(true) }}>Modifica</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}>Elimina</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Precedente</button>
          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: 'var(--g)', lineHeight: '30px' }}>{page + 1} / {totalPages}</span>
          <button className="btn btn-secondary btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Successiva →</button>
        </div>
      )}

      <ClientModal open={showModal} onClose={() => { setShowModal(false); setEditingClient(null) }}
        onSave={editingClient ? handleUpdate : handleCreate} initial={editingClient} agents={agents} />
      <ClientDetailModal open={!!detailClient} client={detailClient} onClose={() => setDetailClient(null)}
        onEdit={(c) => { setDetailClient(null); setEditingClient(c); setShowModal(true) }}
        onDelete={(id) => { setDetailClient(null); handleDelete(id) }} />
    </div>
  )
}
