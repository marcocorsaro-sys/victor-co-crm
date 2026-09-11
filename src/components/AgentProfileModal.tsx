import type { Profile, OperationWithAgent } from '../lib/supabase'
import { formatEur } from '../lib/calculations'

type Props = {
  open: boolean
  agent: Profile | null
  operations: OperationWithAgent[]
  onClose: () => void
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

export default function AgentProfileModal({ open, agent, operations, onClose }: Props) {
  if (!open || !agent) return null

  const currentYear = new Date().getFullYear()
  const agentOps = operations.filter(op => op.agent_id === agent.id)
  const currentYearOps = agentOps.filter(op => {
    const date = op.sale_date || op.date_added
    return new Date(date).getFullYear() === currentYear
  })

  const opsChiuse = currentYearOps.filter(op => op.status === 'incassato')
  const opsPipeline = currentYearOps.filter(op => op.status === 'pipeline' || op.status === 'proposta_accettata')
  const commissioniTotali = opsChiuse.reduce((sum, op) => sum + (op.gross_commission || 0), 0)
  const provvigioniAgente = opsChiuse.reduce((sum, op) => sum + (op.agent_commission || 0), 0)

  const roleBadgeClass = agent.role === 'admin' ? 'badge badge-agenzia' : 'badge badge-agente'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto', maxWidth: 520 }}>
        {/* Header con avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div
            className="avatar"
            style={{ backgroundColor: agent.color, width: 56, height: 56, fontSize: 18 }}
          >
            {agent.initials}
          </div>
          <div>
            <div className="modal-title" style={{ marginBottom: 4 }}>{agent.full_name}</div>
            <span className={roleBadgeClass}>{agent.role}</span>
          </div>
        </div>

        {/* Contatti */}
        {sectionLabel('Contatti')}
        {infoRow('Telefono', agent.phone ? (
          <a href={`tel:${agent.phone}`} style={{ color: 'var(--teal)', textDecoration: 'none' }}>
            {agent.phone}
          </a>
        ) : null)}
        {infoRow('Email', agent.display_email ? (
          <a href={`mailto:${agent.display_email}`} style={{ color: 'var(--teal)', textDecoration: 'none' }}>
            {agent.display_email}
          </a>
        ) : null)}
        {infoRow('Indirizzo', agent.personal_address)}

        {/* Commissioni */}
        <div style={{ marginTop: 16 }}>
          {sectionLabel('Aliquote Commissioni')}
          {infoRow('% Agenzia', `${agent.comm_pct_agency}%`)}
          {infoRow('% Agente', `${agent.comm_pct_agent}%`)}
        </div>

        {/* Contratto */}
        <div style={{ marginTop: 16 }}>
          {sectionLabel('Contratto')}
          {infoRow('Data inizio', agent.contract_start_date ? new Date(agent.contract_start_date).toLocaleDateString('it-IT') : null)}
          {infoRow('Tipo contratto', agent.contract_type)}
        </div>

        {/* Performance Anno Corrente */}
        <div style={{ marginTop: 16 }}>
          {sectionLabel(`Performance Anno Corrente`)}
          {infoRow('Ops chiuse', opsChiuse.length)}
          {infoRow('Ops pipeline', opsPipeline.length)}
          {infoRow('Commissioni totali', formatEur(commissioniTotali))}
          {infoRow('Provvigioni agente', formatEur(provvigioniAgente))}
        </div>

        {/* Chiudi */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--bd)' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  )
}
