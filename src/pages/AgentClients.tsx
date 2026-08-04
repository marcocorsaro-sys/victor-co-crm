import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Profile, Client } from '../lib/supabase'
import { useClients } from '../hooks/useClients'
import { useOperations } from '../hooks/useOperations'
import { formatDate } from '../lib/calculations'

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

type Props = { profile: Profile }

export default function AgentClients({ profile }: Props) {
  const navigate = useNavigate()
  const { clients, loading: cLoading } = useClients()
  const { operations, loading: oLoading } = useOperations(profile.id)
  const loading = cLoading || oLoading
  const [search, setSearch] = useState('')

  // Clients linked to this agent: via linked_agent_id or via operations (any buyer/seller match)
  const myClients = useMemo(() => {
    const partyNames = new Set<string>()
    operations.forEach(o => {
      // Legacy single buyer
      const legacy = [o.buyer_first_name, o.buyer_last_name].filter(Boolean).join(' ').toLowerCase().trim()
      if (legacy) partyNames.add(legacy)
      // Multi buyers
      o.buyers?.forEach(b => {
        const n = `${b.first_name} ${b.last_name}`.toLowerCase().trim()
        if (n) partyNames.add(n)
      })
      // Multi sellers
      o.sellers?.forEach(s => {
        const n = `${s.first_name} ${s.last_name}`.toLowerCase().trim()
        if (n) partyNames.add(n)
      })
    })
    return clients.filter(c => {
      if (c.linked_agent_id === profile.id) return true
      if (partyNames.has(c.name.toLowerCase().trim())) return true
      return false
    })
  }, [clients, operations, profile.id])

  // Birthday panel
  const upcomingBirthdays = useMemo(() => {
    const today = new Date()
    return myClients
      .filter(c => c.birth_date)
      .map(c => {
        const bd = new Date(c.birth_date!)
        const nextBd = new Date(today.getFullYear(), bd.getMonth(), bd.getDate())
        if (nextBd < today) nextBd.setFullYear(today.getFullYear() + 1)
        const daysUntil = Math.round((nextBd.getTime() - today.getTime()) / 86400000)
        const age = nextBd.getFullYear() - bd.getFullYear()
        return { client: c, daysUntil, age }
      })
      .filter(b => b.daysUntil <= 30)
      .sort((a, b) => a.daysUntil - b.daysUntil)
  }, [myClients])

  const filtered = search
    ? myClients.filter(c => {
        const q = search.toLowerCase()
        return c.name.toLowerCase().includes(q) || (c.phone || '').includes(q) || (c.email || '').toLowerCase().includes(q)
      })
    : myClients

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="section-heading" style={{ margin: 0 }}>
          I miei clienti
          <span style={{ fontSize: 13, color: 'var(--g)', fontWeight: 400, marginLeft: 8 }}>({myClients.length})</span>
        </div>
      </div>

      {/* Birthday panel */}
      {upcomingBirthdays.length > 0 && (
        <div style={{ background: 'var(--s1)', borderRadius: 12, padding: 16, border: '1px solid var(--bd)', marginBottom: 16 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--ld)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
            // Compleanni in arrivo
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {upcomingBirthdays.map(b => (
              <div key={b.client.id} style={{
                background: 'var(--bg2)', borderRadius: 10, padding: '10px 14px', border: '1px solid var(--bd)', minWidth: 180, flexShrink: 0,
              }}>
                <div style={{ fontWeight: 600, color: 'var(--w)', fontSize: 13, marginBottom: 4 }}>{b.client.name}</div>
                <div style={{ fontSize: 11, color: 'var(--g)', marginBottom: 6 }}>
                  {formatDate(b.client.birth_date!)} · {b.age} anni
                </div>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700,
                  color: b.daysUntil === 0 ? 'var(--green)' : b.daysUntil <= 7 ? 'var(--amber)' : 'var(--teal)',
                }}>
                  {b.daysUntil === 0 ? 'OGGI!' : b.daysUntil === 1 ? 'Domani' : `Tra ${b.daysUntil} giorni`}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  {b.client.phone && <a href={`tel:${b.client.phone}`} className="btn btn-secondary btn-sm" style={{ fontSize: 10, textDecoration: 'none' }}>Chiama</a>}
                  {b.client.email && <a href={`mailto:${b.client.email}?subject=Auguri!`} className="btn btn-secondary btn-sm" style={{ fontSize: 10, textDecoration: 'none' }}>Email</a>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="filters-bar" style={{ marginBottom: 16 }}>
        <input className="filter-input" placeholder="Cerca nome, telefono, email..."
          value={search} onChange={e => setSearch(e.target.value)} style={{ minWidth: 280 }} />
      </div>

      {loading ? (
        <div className="skeleton skeleton-row" style={{ height: 200 }} />
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👥</div>
          <p>{search ? 'Nessun cliente trovato' : 'Nessun cliente associato alle tue operazioni'}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Nome</th><th>Telefono</th><th>Email</th><th>Tipo</th><th>Compleanno</th></tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td>
                    <div className="clickable-cell" style={{ fontWeight: 600 }} onClick={() => navigate(`/admin/client/${c.id}`)}>
                      {c.name}
                    </div>
                    {c.company && <div style={{ fontSize: 11, color: 'var(--g)' }}>{c.company}</div>}
                  </td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                    {c.phone ? <a href={`tel:${c.phone}`} style={{ color: 'var(--w)', textDecoration: 'none' }}>{c.phone}</a> : '—'}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {c.email ? <a href={`mailto:${c.email}`} style={{ color: 'var(--teal)', textDecoration: 'none' }}>{c.email}</a> : '—'}
                  </td>
                  <td><span className={`badge ${TYPE_COLORS[c.type]}`}>{TYPE_LABELS[c.type]}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--gl)' }}>
                    {c.birth_date ? formatDate(c.birth_date) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
