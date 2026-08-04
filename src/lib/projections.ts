import type { Operation, Profile } from './supabase'
import { estimatePipelineCommission, getPipelineWeight, ACCEPTED_PROPOSAL_WEIGHT } from './calculations'

export interface MonthlyProjection {
  month: number
  actual: number
  projected: number
  cumulative: number
  cumulativeProjected: number
}

export interface ProjectionBreakdown {
  ytdActual: number
  acceptedGross: number
  acceptedWeighted: number
  pipelineGrossTotal: number
  pipelineWeightedByProb: number
  medianLeadDays: number
  discountedOpsCount: number
  projectedTotal: number
  projectedAgent: number
  projectedMargin: number
  projectedValue: number
  projectedOps: number
  projectedPrudente: number
  projectedOttimista: number
  remainingMonths: number
}

/** Lead mediano di fallback (giorni incarico→incasso) quando lo storico è scarso. */
const FALLBACK_LEAD_DAYS = 90

function medianOf(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function opStartDate(op: Operation): Date {
  return new Date(op.mandate_start_date || op.date_added)
}

/**
 * Proiezione a fine anno basata sulla PIPELINE PESATA (nessuna componente di
 * trend storico):
 *
 *   Stima 31/12 = YTD incassato
 *               + Σ proposte accettate × ACCEPTED_PROPOSAL_WEIGHT
 *               + Σ pipeline × (probabilità di vendita) × (fattore tempo)
 *
 * Il fattore tempo sconta le operazioni entrate da poco: se il tempo residuo
 * atteso alla chiusura (lead mediano storico − età dell'operazione) supera i
 * giorni che mancano al 31/12, il peso scala proporzionalmente.
 *
 * `openOps` deve contenere le operazioni in stato `pipeline` E `proposta_accettata`.
 */
export function calculateProjectedTrajectory(
  completedOps: Operation[],
  openOps: Operation[],
  agents: Profile[],
  year: number,
): { monthly: MonthlyProjection[]; breakdown: ProjectionBreakdown } {
  const now = new Date()
  const isCurrentYear = now.getFullYear() === year
  const currentMonth = isCurrentYear ? now.getMonth() : 11
  const yearEnd = new Date(year, 11, 31)
  const daysLeft = Math.max(1, Math.round((yearEnd.getTime() - now.getTime()) / 86400000))

  // ── Consuntivo mensile (solo incassato nell'anno) ──
  const actuals = Array(12).fill(0)
  let ytdAgent = 0
  let ytdValue = 0
  let ytdOps = 0
  completedOps.forEach(o => {
    if (!o.sale_date) return
    const d = new Date(o.sale_date)
    if (d.getFullYear() !== year) return
    actuals[d.getMonth()] += o.gross_commission || 0
    ytdAgent += o.agent_commission || 0
    ytdValue += o.final_value || o.property_value || 0
    ytdOps++
  })
  const ytdActual = actuals.slice(0, currentMonth + 1).reduce((a, b) => a + b, 0)

  // ── Lead mediano storico: incarico (o inserimento) → incasso ──
  const leads = completedOps
    .filter(o => o.sale_date)
    .map(o => Math.round((new Date(o.sale_date!).getTime() - opStartDate(o).getTime()) / 86400000))
    .filter(d => d >= 0 && d <= 730)
  const medianLeadDays = leads.length >= 3 ? medianOf(leads)! : FALLBACK_LEAD_DAYS

  // ── Pipeline pesata + proposte accettate ──
  let acceptedGross = 0
  let acceptedWeighted = 0
  let pipelineGrossTotal = 0
  let pipelineWeightedByProb = 0
  let weightedAgent = 0
  let weightedMargin = 0
  let weightedValue = 0
  let weightedOps = 0
  let prudentePipeline = 0
  let discountedOpsCount = 0
  const futureMonthly = Array(12).fill(0)

  openOps.forEach(op => {
    const agent = agents.find(a => a.id === op.agent_id)
    const est = estimatePipelineCommission(op, agent)
    if (!est) return

    const isAccepted = op.status === 'proposta_accettata'
    const prob = isAccepted ? ACCEPTED_PROPOSAL_WEIGHT : getPipelineWeight(op)

    // Fattore tempo: quanto è realistico che chiuda entro il 31/12
    const ageDays = Math.max(0, Math.round((now.getTime() - opStartDate(op).getTime()) / 86400000))
    const expectedRemaining = isAccepted ? 0 : Math.max(0, medianLeadDays - ageDays)
    const timeFactor = expectedRemaining <= daysLeft ? 1 : daysLeft / expectedRemaining
    if (timeFactor < 1) discountedOpsCount++

    const weight = prob * timeFactor

    if (isAccepted) {
      acceptedGross += est.grossCommission
      acceptedWeighted += est.grossCommission * weight
    } else {
      pipelineGrossTotal += est.grossCommission
      pipelineWeightedByProb += est.grossCommission * weight
      if (prob >= 0.6) prudentePipeline += est.grossCommission * weight
    }

    weightedAgent += est.agentCommission * weight
    weightedMargin += est.agencyRevenue * weight
    weightedValue += (op.property_value || 0) * weight
    weightedOps += weight

    // Mese di chiusura atteso: oggi + tempo residuo atteso, mai oltre dicembre
    const expectedClose = new Date(now.getTime() + expectedRemaining * 86400000)
    const closeMonth = expectedClose.getFullYear() > year
      ? 11
      : Math.min(11, Math.max(currentMonth + 1, expectedClose.getMonth()))
    futureMonthly[closeMonth] += est.grossCommission * weight
  })

  // ── Curva mensile ──
  const monthly: MonthlyProjection[] = []
  let cumActual = 0
  let cumProjected = 0
  for (let m = 0; m < 12; m++) {
    const actual = actuals[m]
    const projected = m <= currentMonth ? 0 : futureMonthly[m]
    cumActual += actual
    cumProjected += m <= currentMonth ? actual : projected
    monthly.push({
      month: m,
      actual,
      projected,
      cumulative: cumActual,
      cumulativeProjected: cumProjected,
    })
  }

  const ytdMargin = ytdActual - ytdAgent
  const projectedTotal = ytdActual + acceptedWeighted + pipelineWeightedByProb
  const remainingMonths = Math.max(11 - currentMonth, 1)

  const breakdown: ProjectionBreakdown = {
    ytdActual,
    acceptedGross,
    acceptedWeighted,
    pipelineGrossTotal,
    pipelineWeightedByProb,
    medianLeadDays,
    discountedOpsCount,
    projectedTotal,
    projectedAgent: ytdAgent + weightedAgent,
    projectedMargin: ytdMargin + weightedMargin,
    projectedValue: ytdValue + weightedValue,
    projectedOps: ytdOps + weightedOps,
    projectedPrudente: ytdActual + acceptedWeighted + prudentePipeline,
    projectedOttimista: ytdActual + acceptedGross + pipelineGrossTotal,
    remainingMonths,
  }

  return { monthly, breakdown }
}
