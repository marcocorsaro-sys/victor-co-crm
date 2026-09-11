import type { Operation } from '../lib/supabase'
import { formatEur, formatDateTime } from '../lib/calculations'

type Props = {
  op: Operation
  expectedCommission?: number
  onClose?: () => void
  onEdit?: () => void
  onDelete?: () => void
}

export default function OpCard({ op, expectedCommission, onClose, onEdit, onDelete }: Props) {
  const isPipeline = op.status === 'pipeline'

  return (
    <div className="op-card">
      <div className="op-card-header">
        <div>
          <div className="op-card-name">{op.property_name}</div>
          {op.address && <div className="op-card-address">{op.address}</div>}
        </div>
      </div>

      <div className="op-card-badges">
        <span className={`badge badge-${op.type}`}>{op.type}</span>
        <span className={`badge badge-${op.origin}`}>{op.origin}</span>
        <span className={`badge badge-${op.status}`}>{op.status}</span>
        {isPipeline && op.sale_probability && (
          <span style={{
            display: 'inline-block',
            fontSize: 11,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 6,
            color: op.sale_probability <= 30 ? 'var(--red)' : op.sale_probability <= 60 ? 'var(--amber)' : 'var(--green)',
            background: op.sale_probability <= 30 ? 'rgba(192,57,43,0.15)' : op.sale_probability <= 60 ? 'rgba(183,121,31,0.15)' : 'rgba(29,143,95,0.15)',
          }}>
            {op.sale_probability}%
          </span>
        )}
      </div>

      <div className="op-card-value">
        {isPipeline
          ? op.property_value != null ? formatEur(op.property_value) : '—'
          : op.final_value != null ? formatEur(op.final_value) : '—'
        }
      </div>

      {!isPipeline && op.agent_commission != null && (
        <div className="op-card-commission">
          Provvigione: {formatEur(op.agent_commission)}
        </div>
      )}

      {isPipeline && expectedCommission != null && expectedCommission > 0 && (
        <div className="op-card-commission" style={{ color: 'var(--amber)' }}>
          Comm. stimata: {formatEur(expectedCommission)}
        </div>
      )}

      <div className="op-card-date">
        Inserito il {formatDateTime(op.date_added)}
      </div>

      {!isPipeline && op.sale_date && (
        <div className="op-card-date">
          Chiusa il {new Date(op.sale_date).toLocaleDateString('it-IT')}
        </div>
      )}

      {isPipeline && (
        <div className="op-card-actions">
          {onClose && (
            <button className="btn btn-success btn-sm" onClick={onClose}>
              ✓ Chiudi
            </button>
          )}
          {onEdit && (
            <button className="btn btn-secondary btn-sm" onClick={onEdit}>
              Modifica
            </button>
          )}
          {onDelete && (
            <button className="btn btn-danger btn-sm" onClick={onDelete}>
              Elimina
            </button>
          )}
        </div>
      )}

      {!isPipeline && (
        <div className="op-card-actions">
          {onEdit && (
            <button className="btn btn-secondary btn-sm" onClick={onEdit}>
              Modifica
            </button>
          )}
          {onDelete && (
            <button className="btn btn-danger btn-sm" onClick={onDelete}>
              Elimina
            </button>
          )}
        </div>
      )}
    </div>
  )
}
