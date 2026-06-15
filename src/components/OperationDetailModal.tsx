import { useState } from 'react'
import type { Operation, OperationWithAgent, Profile } from '../lib/supabase'
import { formatEur, formatDate } from '../lib/calculations'
import DocumentsTab from './documents/DocumentsTab'

type Props = {
  open: boolean
  operation: OperationWithAgent | null
  onClose: () => void
  onEdit: (op: Operation) => void
  /** Callback per chiudere/incassare l'operazione (apre CloseModal). */
  onCloseOp?: (op: Operation) => void
  /** Cambia lo stato dell'operazione (es. → 'proposta_accettata' o 'terminato'). */
  onChangeStatus?: (op: Operation, newStatus: 'pipeline' | 'proposta_accettata' | 'incassato' | 'terminato') => void
  /** Eliminazione permanente (admin only). */
  onDelete?: (id: string) => void
  /** Mostra il bottone elimina permanente. */
  isAdmin?: boolean
}

const sectionLabel = (text: string) => (
  <div style={{
    fontFamily: "'JetBrains Mono', monospace",
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

export default function OperationDetailModal({ open, operation, onClose, onEdit, onCloseOp, onChangeStatus, onDelete, isAdmin }: Props) {
  const [tab, setTab] = useState<'dettagli' | 'documenti'>('dettagli')
  if (!open || !operation) return null

  const agent = operation.profiles as Profile | undefined
  const buyerName = [operation.buyer_first_name, operation.buyer_last_name].filter(Boolean).join(' ') || null
  const collaboratorName = [operation.collaborator_first_name, operation.collaborator_last_name].filter(Boolean).join(' ') || operation.collaborator_name || null
  const mapsUrl = operation.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(operation.address)}`
    : null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto', maxWidth: 560 }}>
        {/* Header */}
        <div className="modal-title" style={{ marginBottom: 4 }}>{operation.property_name}</div>
        {operation.address && (
          <a
            href={mapsUrl!}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--teal)', fontSize: 13, textDecoration: 'none', display: 'block', marginBottom: 16 }}
          >
            {operation.address} ↗
          </a>
        )}

        {/* Badges */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          <span className={`badge badge-${operation.type}`}>{operation.type}</span>
          <span className={`badge badge-${operation.origin}`}>{operation.origin}</span>
          <span className={`badge badge-${operation.status}`}>{operation.status}</span>
        </div>

        {/* Tabs */}
        <div className="tabs" style={{ marginBottom: 16 }}>
          <button className={`tab ${tab === 'dettagli' ? 'active' : ''}`} onClick={() => setTab('dettagli')}>
            Dettagli
          </button>
          <button className={`tab ${tab === 'documenti' ? 'active' : ''}`} onClick={() => setTab('documenti')}>
            📄 Documenti
          </button>
        </div>

        {tab === 'documenti' ? (
          <DocumentsTab operation={operation} />
        ) : (
        <>

        {/* Agente */}
        {sectionLabel('Agente')}
        {agent && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div
              className="avatar"
              style={{ backgroundColor: agent.color, width: 36, height: 36, fontSize: 13 }}
            >
              {agent.initials}
            </div>
            <span style={{ color: 'var(--w)', fontSize: 14 }}>{agent.full_name}</span>
          </div>
        )}

        {/* Acquirente */}
        {sectionLabel('Acquirente')}
        {infoRow('Nome acquirente', buyerName)}

        {/* Valori */}
        {sectionLabel('Valori Immobile')}
        {infoRow('Valore immobile', operation.property_value != null ? formatEur(operation.property_value) : null)}
        {infoRow('Valore finale', operation.final_value != null ? formatEur(operation.final_value) : null)}

        {/* Commissioni */}
        <div style={{ marginTop: 16 }}>
          {sectionLabel('Commissioni')}
          {infoRow('Commissione lorda', operation.gross_commission != null ? formatEur(operation.gross_commission) : null)}
          {infoRow(
            'Comm. venditore',
            operation.comm_mode_seller === 'fixed'
              ? formatEur(operation.comm_fixed_seller)
              : `${operation.comm_pct_seller}%`
          )}
          {infoRow(
            'Comm. acquirente',
            operation.comm_mode_buyer === 'fixed'
              ? formatEur(operation.comm_fixed_buyer)
              : `${operation.comm_pct_buyer}%`
          )}
          {infoRow('Provvigione agente', operation.agent_commission != null ? formatEur(operation.agent_commission) : null)}
          {infoRow('Provvigione collaboratore', operation.collaborator_commission != null ? (
            <>
              {formatEur(operation.collaborator_commission)}
              {collaboratorName && <span style={{ color: 'var(--g)', marginLeft: 6, fontSize: 11 }}>({collaboratorName})</span>}
            </>
          ) : null)}
          {infoRow('Ricavo agenzia', operation.gross_commission != null && operation.agent_commission != null
            ? formatEur(operation.gross_commission - operation.agent_commission - (operation.collaborator_commission || 0))
            : null
          )}
        </div>

        {/* Incarico */}
        <div style={{ marginTop: 16 }}>
          {sectionLabel('Incarico')}
          {infoRow('Data inizio incarico', operation.mandate_start_date ? formatDate(operation.mandate_start_date) : null)}
          {infoRow('Data fine incarico', operation.mandate_end_date ? formatDate(operation.mandate_end_date) : null)}
          {infoRow('Data vendita', operation.sale_date ? formatDate(operation.sale_date) : null)}
        </div>

        {/* Incasso */}
        <div style={{ marginTop: 16 }}>
          {sectionLabel('Incasso')}
          {infoRow('Importo incassato vend.', operation.commission_collected_seller != null ? formatEur(operation.commission_collected_seller) : null)}
          {infoRow('Data incasso vend.', operation.collection_date_seller ? formatDate(operation.collection_date_seller) : null)}
          {infoRow('Importo incassato acq.', operation.commission_collected_buyer != null ? formatEur(operation.commission_collected_buyer) : null)}
          {infoRow('Data incasso acq.', operation.collection_date_buyer ? formatDate(operation.collection_date_buyer) : null)}
          {infoRow('Totale incassato', operation.commission_collected != null ? formatEur(operation.commission_collected) : null)}
        </div>

        {/* Note */}
        {operation.notes && (
          <div style={{ marginTop: 16 }}>
            {sectionLabel('Note')}
            <div style={{ color: 'var(--gl)', fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {operation.notes}
            </div>
          </div>
        )}
        </>
        )}

        {/* Azioni */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--bd)', flexWrap: 'wrap' }}>
          {/* Termina mandato (per pipeline o proposta_accettata) */}
          {onChangeStatus && (operation.status === 'pipeline' || operation.status === 'proposta_accettata') && (
            <button
              className="btn btn-secondary"
              onClick={() => {
                if (confirm('Confermi la fine del mandato? L\'operazione verrà marcata come "terminato".')) {
                  onChangeStatus(operation, 'terminato')
                }
              }}
              style={{ marginRight: 'auto', color: 'var(--g)' }}
              title="Mandato scaduto / non rinnovato / cliente revoca"
            >
              Termina mandato
            </button>
          )}

          {/* Elimina permanente — solo admin, distruttivo */}
          {isAdmin && onDelete && (
            <button
              className="btn btn-danger"
              onClick={() => {
                if (confirm('⚠ ELIMINAZIONE PERMANENTE\n\nQuesta operazione cancellerà DEFINITIVAMENTE l\'immobile dal database. Usa solo per record di test o duplicati. Per mandati scaduti usa "Termina mandato".\n\nProcedere?')) {
                  onDelete(operation.id)
                }
              }}
              style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--red)', border: '1px solid var(--red)' }}
              title="Elimina permanentemente dal DB (admin only)"
            >
              🗑 Elimina permanente
            </button>
          )}

          {/* Proposta accettata (solo pipeline) */}
          {onChangeStatus && operation.status === 'pipeline' && (
            <button
              className="btn btn-secondary"
              onClick={() => onChangeStatus(operation, 'proposta_accettata')}
              style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--amber)' }}
              title="Soldi attesi ma non ancora incassati"
            >
              Proposta accettata
            </button>
          )}

          {/* Registra incasso (per pipeline o proposta_accettata) */}
          {onCloseOp && (operation.status === 'pipeline' || operation.status === 'proposta_accettata') && (
            <button className="btn btn-success" onClick={() => onCloseOp(operation)}>
              {operation.status === 'proposta_accettata' ? 'Registra incasso' : 'Chiudi e incassa'}
            </button>
          )}

          {/* Riapri (per terminato) */}
          {onChangeStatus && operation.status === 'terminato' && (
            <button
              className="btn btn-secondary"
              onClick={() => onChangeStatus(operation, 'pipeline')}
              title="Riporta in pipeline"
            >
              Riapri in pipeline
            </button>
          )}

          <button className="btn btn-primary" onClick={() => onEdit(operation)}>
            Modifica
          </button>
        </div>
      </div>
    </div>
  )
}
