import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProfiles } from '../hooks/useProfiles'
import { useOperations } from '../hooks/useOperations'
import { formatEur } from '../lib/calculations'
import { calculateProjectedTrajectory, computeMedianLeadDays } from '../lib/projections'


export default function AdminAgents() {
  const navigate = useNavigate()
  const { agents, loading: pLoading } = useProfiles()
  const { operations, loading: oLoading } = useOperations()
  const loading = pLoading || oLoading
  const currentYear = new Date().getFullYear()

  const agentStats = useMemo(() => {
    // Lead mediano globale per il fattore tempo del modello di proiezione
    const globalLead = computeMedianLeadDays(operations.filter(o => o.status === 'incassato'))
    return agents.map(agent => {
      const ops = operations.filter(o => o.agent_id === agent.id)
      const completed = ops.filter(o => o.status === 'incassato')
      const yearStart = new Date(currentYear, 0, 1)
      const yearEnd = new Date(currentYear + 1, 0, 1)
      const completedYear = completed.filter(o =>
        o.sale_date && new Date(o.sale_date) >= yearStart && new Date(o.sale_date) < yearEnd
      )
      // Include sia 'pipeline' che 'proposta_accettata' (entrambe operazioni in corso)
      const pipeline = ops.filter(o => o.status === 'pipeline' || o.status === 'proposta_accettata')
      const grossYear = completedYear.reduce((s, o) => s + (o.gross_commission || 0), 0)
      const agentYear = completedYear.reduce((s, o) => s + (o.agent_commission || 0), 0)
      const pipelineValue = pipeline.reduce((s, o) => s + (o.property_value || 0), 0)
      // Closing rate year-based: closed in year / (closed + pipeline)
      const closingRate = (completedYear.length + pipeline.length) > 0
        ? (completedYear.length / (completedYear.length + pipeline.length) * 100) : 0

      // Stima chiusura 31/12: YTD + proposte accettate × 90% + pipeline × prob × fattore tempo
      const { breakdown: proj } = calculateProjectedTrajectory(completed, pipeline, agents, currentYear, globalLead)

      return {
        projectedTotal: proj.projectedTotal,
        projectedAgent: proj.projectedAgent,
        agent,
        totalOps: ops.length,
        completedYear: completedYear.length,
        pipelineCount: pipeline.length,
        grossYear,
        agentYear,
        agencyMargin: grossYear - agentYear,
        pipelineValue,
        closingRate,
      }
    }).sort((a, b) => b.grossYear - a.grossYear)
  }, [agents, operations, currentYear])

  const mono = { fontFamily: "'JetBrains Mono', monospace" } as const

  return (
    <div>
      <div className="section-heading">// Agenti</div>

      {loading ? (
        <div className="skeleton skeleton-row" style={{ height: 200 }} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {agentStats.map(({ agent, completedYear, pipelineCount, grossYear, agentYear, agencyMargin, pipelineValue, closingRate, projectedTotal, projectedAgent }) => (
            <div
              key={agent.id}
              onClick={() => navigate(`/admin/agent/${agent.id}`)}
              style={{
                background: 'var(--s1)',
                borderRadius: 12,
                padding: 20,
                border: '1px solid var(--bd)',
                cursor: 'pointer',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = agent.color || 'var(--lime)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--bd)')}
            >
              {/* Agent header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div className="avatar" style={{ backgroundColor: agent.color, width: 44, height: 44, fontSize: 15 }}>
                  {agent.initials}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--w)', fontSize: 15 }}>{agent.full_name}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                    <span className={`badge badge-${agent.active ? 'agente' : 'inattivo'}`}>
                      {agent.active ? 'Attivo' : 'Inattivo'}
                    </span>
                    {agent.contract_type && (
                      <span style={{ fontSize: 11, color: 'var(--g)' }}>{agent.contract_type}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <StatItem label={`Chiuse ${currentYear}`} value={completedYear.toString()} />
                <StatItem label="Pipeline" value={pipelineCount.toString()} color="var(--amber)" />
                <StatItem label="Comm. Lorde" value={formatEur(grossYear)} mono />
                <StatItem label="Quota Agente" value={formatEur(agentYear)} color="var(--teal)" mono />
                <StatItem label="Margine Agenzia" value={formatEur(agencyMargin)} color="var(--green)" mono />
                <StatItem label="% Chiusura" value={`${closingRate.toFixed(0)}%`} />
                <StatItem label={`Stima 31/12 (lorde)`} value={formatEur(projectedTotal)} color="var(--amber)" mono />
                <StatItem label="Quota Agente Stim." value={formatEur(projectedAgent)} color="var(--teal)" mono />
              </div>

              {/* Pipeline value bar */}
              {pipelineValue > 0 && (
                <div style={{ marginTop: 12, padding: '8px 0 0', borderTop: '1px solid var(--bd)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: 'var(--g)' }}>Valore pipeline</span>
                    <span style={{ ...mono, color: 'var(--amber)', fontSize: 11 }}>{formatEur(pipelineValue)}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatItem({ label, value, color, mono: isMono }: { label: string; value: string; color?: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--g)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 2 }}>{label}</div>
      <div style={{
        fontSize: 14,
        fontWeight: 600,
        color: color || 'var(--w)',
        ...(isMono ? { fontFamily: "'JetBrains Mono', monospace" } : {}),
      }}>{value}</div>
    </div>
  )
}
