import type { Client } from '../lib/supabase'
import { formatDate } from '../lib/calculations'

type Props = {
  open: boolean
  client: Client | null
  onClose: () => void
  onEdit: (client: Client) => void
  onDelete?: (id: string) => void
}

const sectionLabel = (text: string) => (
  <div style={{
    fontFamily: "'Montserrat', sans-serif",
    fontSize: 11,
    color: 'var(--ld)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: 8,
  }}>
    // {text}
  </div>
)

const infoRow = (label: string, value: React.ReactNode) => (
  <div style={{
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid var(--bd)',
  }}>
    <span style={{ color: 'var(--g)', fontSize: 13 }}>{label}</span>
    <span style={{ color: 'var(--w)', fontSize: 13, textAlign: 'right' }}>{value ?? '—'}</span>
  </div>
)

export default function ClientDetailModal({ open, client, onClose, onEdit, onDelete }: Props) {
  if (!open || !client) return null

  const fullName = [client.first_name, client.last_name].filter(Boolean).join(' ')
  const mapsUrl = client.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.address)}`
    : null

  const typeBadgeMap: Record<string, string> = {
    acquirente: 'badge badge-vendita',
    venditore: 'badge badge-locazione',
    entrambi: 'badge badge-agenzia',
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto', maxWidth: 480 }}>
        {/* Nome */}
        <div className="modal-title" style={{ marginBottom: 12 }}>{fullName}</div>

        {/* Tipo */}
        <div style={{ marginBottom: 20 }}>
          <span className={typeBadgeMap[client.type] || 'badge'}>{client.type}</span>
        </div>

        {/* Contatti */}
        {sectionLabel('Contatti')}
        {infoRow('Telefono', client.phone ? (
          <a href={`tel:${client.phone}`} style={{ color: 'var(--teal)', textDecoration: 'none' }}>
            {client.phone}
          </a>
        ) : null)}
        {infoRow('Email', client.email ? (
          <a href={`mailto:${client.email}`} style={{ color: 'var(--teal)', textDecoration: 'none' }}>
            {client.email}
          </a>
        ) : null)}

        {/* Indirizzo */}
        <div style={{ marginTop: 16 }}>
          {sectionLabel('Indirizzo')}
          {infoRow('Indirizzo', client.address ? (
            <a
              href={mapsUrl!}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--teal)', textDecoration: 'none' }}
            >
              {client.address} ↗
            </a>
          ) : null)}
        </div>

        {/* Note */}
        {client.notes && (
          <div style={{ marginTop: 16 }}>
            {sectionLabel('Note')}
            <div style={{ color: 'var(--gl)', fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {client.notes}
            </div>
          </div>
        )}

        {/* Data aggiunta */}
        <div style={{ marginTop: 16 }}>
          {sectionLabel('Info')}
          {infoRow('Data aggiunta', formatDate(client.date_added))}
        </div>

        {/* Azioni */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--bd)' }}>
          {onDelete && (
            <button
              className="btn btn-danger"
              onClick={() => onDelete(client.id)}
              style={{ marginRight: 'auto' }}
            >
              Elimina
            </button>
          )}
          <button className="btn btn-primary" onClick={() => onEdit(client)}>
            Modifica
          </button>
        </div>
      </div>
    </div>
  )
}
