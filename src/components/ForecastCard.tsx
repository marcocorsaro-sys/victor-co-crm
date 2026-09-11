import type { OperationWithAgent, Profile } from '../lib/supabase'
import { formatEur, estimatePipelineCommission, getPipelineWeight, PIPELINE_FORMULAS } from '../lib/calculations'
import FormulaTip from './FormulaTip'

type Props = {
  operations: OperationWithAgent[]
  agents: Profile[]
}

export default function ForecastCard({ operations, agents }: Props) {
  // Include sia pipeline che proposta_accettata (entrambi "in corso")
  const pipeline = operations.filter(o => o.status === 'pipeline' || o.status === 'proposta_accettata')

  const totalPipelineValue = pipeline.reduce((s, o) => s + (o.property_value || 0), 0)

  // Precise per-operation expected commissions (central helper: fixed-mode + collaborator)
  const pipelineEstimates = pipeline.map(op => {
    const agent = agents.find(a => a.id === op.agent_id)
    const r = estimatePipelineCommission(op, agent)
    const w = getPipelineWeight(op)
    return {
      gross: r?.grossCommission || 0,
      agent: r?.agentCommission || 0,
      agency: r?.agencyRevenue || 0,
      weightedGross: (r?.grossCommission || 0) * w,
      weightedAgent: (r?.agentCommission || 0) * w,
      weightedAgency: (r?.agencyRevenue || 0) * w,
    }
  })

  const totalExpectedGross = pipelineEstimates.reduce((s, e) => s + e.gross, 0)
  const totalExpectedAgent = pipelineEstimates.reduce((s, e) => s + e.agent, 0)
  const totalExpectedAgency = pipelineEstimates.reduce((s, e) => s + e.agency, 0)
  const totalWeightedGross = pipelineEstimates.reduce((s, e) => s + e.weightedGross, 0)
  const totalWeightedAgent = pipelineEstimates.reduce((s, e) => s + e.weightedAgent, 0)
  const totalWeightedAgency = pipelineEstimates.reduce((s, e) => s + e.weightedAgency, 0)

  // Per agent breakdown
  const agentData = agents.filter(a => a.active).map(agent => {
    const agentPipeline = pipeline.filter(o => o.agent_id === agent.id)
    const agentValue = agentPipeline.reduce((s, o) => s + (o.property_value || 0), 0)
    let agentGross = 0
    let agentWeighted = 0
    agentPipeline.forEach(op => {
      const r = estimatePipelineCommission(op, agent)
      if (!r) return
      agentGross += r.grossCommission
      agentWeighted += r.grossCommission * getPipelineWeight(op)
    })
    return {
      agent,
      pipelineCount: agentPipeline.length,
      pipelineValue: agentValue,
      estimatedGross: agentGross,
      estimatedWeighted: agentWeighted,
    }
  }).filter(d => d.pipelineCount > 0)

  const maxValue = Math.max(...agentData.map(d => d.pipelineValue), 1)

  return (
    <div className="forecast-card">
      <span className="forecast-label">FORECAST</span>
      <div className="section-heading">Pipeline Corrente</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div>
          <div className="kpi-label" style={{ display: 'inline-flex', alignItems: 'center' }}>
            <span>Valore pipeline</span>
            <FormulaTip title="Valore pipeline" formula="Somma del property_value di tutte le operazioni in pipeline" />
          </div>
          <div className="kpi-value" style={{ fontSize: '1.2em' }}>{formatEur(totalPipelineValue)}</div>
        </div>
        <div>
          <div className="kpi-label" style={{ display: 'inline-flex', alignItems: 'center' }}>
            <span>Comm. lorde stimate</span>
            <FormulaTip title="Comm. lorde stimate" formula={PIPELINE_FORMULAS.pipelineGross} />
          </div>
          <div className="kpi-value amber" style={{ fontSize: '1.2em' }}>{formatEur(totalExpectedGross)}</div>
        </div>
        <div>
          <div className="kpi-label" style={{ display: 'inline-flex', alignItems: 'center' }}>
            <span>Margine agenzia stimato</span>
            <FormulaTip title="Margine agenzia stimato" formula={PIPELINE_FORMULAS.agencyMargin} />
          </div>
          <div className="kpi-value" style={{ fontSize: '1.2em', color: 'var(--green)' }}>{formatEur(totalExpectedAgency)}</div>
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: 8, marginBottom: 12,
        padding: '10px 14px', background: 'var(--s3)', borderRadius: 8,
        fontFamily: "'Montserrat', sans-serif", fontSize: 12,
      }}>
        <div>Comm. agenti stimate</div>
        <div style={{ textAlign: 'right', color: 'var(--teal)' }}>{formatEur(totalExpectedAgent)}</div>
      </div>

      {/* Weighted block */}
      {totalWeightedGross !== totalExpectedGross && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr',
          gap: 8, marginBottom: 20,
          padding: '10px 14px', background: 'var(--s2)', borderRadius: 8,
          fontFamily: "'Montserrat', sans-serif", fontSize: 12,
        }}>
          <div style={{ color: 'var(--g)', alignSelf: 'center', display: 'inline-flex', alignItems: 'center' }}>
            <span>Pesato prob.</span>
            <FormulaTip title="Pipeline pesata per probabilità"
              formula={PIPELINE_FORMULAS.pipelineWeighted}
              note={PIPELINE_FORMULAS.weight} />
          </div>
          <div style={{ textAlign: 'right', color: 'var(--amber)' }}>{formatEur(totalWeightedGross)}</div>
          <div style={{ textAlign: 'right', color: 'var(--teal)' }}>{formatEur(totalWeightedAgent)}</div>
          <div style={{ textAlign: 'right', color: 'var(--green)' }}>{formatEur(totalWeightedAgency)}</div>
        </div>
      )}

      {agentData.length > 0 && (
        <div>
          {agentData.map(d => (
            <div key={d.agent.id} className="forecast-row">
              <div className="forecast-agent-name">
                <div className="avatar" style={{ backgroundColor: d.agent.color, width: 24, height: 24, fontSize: 9 }}>
                  {d.agent.initials}
                </div>
                <span>{d.agent.full_name}</span>
                <span style={{ color: 'var(--g)', fontSize: 11, marginLeft: 4 }}>({d.pipelineCount})</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${(d.pipelineValue / maxValue) * 100}%`,
                    backgroundColor: d.agent.color,
                  }}
                />
              </div>
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: 'var(--gl)', minWidth: 90, textAlign: 'right' }}>
                {formatEur(d.estimatedGross)}
              </span>
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: 11, color: 'var(--g)', marginTop: 16 }}>
        * Stime calcolate sui valori e le percentuali di commissione di ogni operazione.
      </p>
    </div>
  )
}
