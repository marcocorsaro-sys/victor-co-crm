export interface CommissionResult {
  grossCommission: number
  agentCommission: number
  agencyRevenue: number
  collaboratorCommission: number
  breakdown: {
    seller: number
    buyer: number
  }
}

export interface CommissionOptions {
  commModeSeller?: 'pct' | 'fixed'
  commModeBuyer?: 'pct' | 'fixed'
  commFixedSeller?: number
  commFixedBuyer?: number
  collaboratorCommPct?: number
}

/**
 * Fallback weight when sale_probability is null.
 * 50% = neutral stance (neither assumes certain nor impossible close).
 */
export const PIPELINE_WEIGHT_FALLBACK = 0.5

/**
 * Peso delle proposte accettate nelle stime: la trattativa è chiusa,
 * resta solo il rischio che non si arrivi al rogito.
 */
export const ACCEPTED_PROPOSAL_WEIGHT = 0.9

/**
 * Human-readable formula text for tooltips/legends.
 * Keep in sync with getPipelineWeight + estimatePipelineCommission.
 */
export const PIPELINE_FORMULAS = {
  weight: 'peso = sale_probability / 100 (30% / 60% / 90%); 50% se non specificata',
  acceptedWeight: 'Proposte accettate: peso fisso 90% (resta solo il rischio rogito)',
  pipelineGross: 'Comm. lorda pipeline = somma commissioni lorde di tutte le operazioni in pipeline (non pesata)',
  pipelineWeighted: 'Comm. pipeline pesata = Σ (comm. lorda operazione × peso probabilità)',
  estimatedTotal: 'Stima Tot. anno = Comm. chiuse nell\'anno + proposte accettate + Comm. lorda pipeline (scenario ottimistico)',
  estimatedWeighted: 'Stima Pesata anno = Comm. chiuse nell\'anno + proposte accettate × 90% + Comm. pipeline pesata (scenario realistico)',
  agentShare: 'Quota agente = Comm. lorda × (% agenzia se origine agenzia/valutazione, % agente se origine agente)',
  agencyMargin: 'Margine agenzia = Comm. lorda - Quota agente - Quota collaboratore',
}

/** Returns weight for an operation based on its sale_probability (0..1). */
export function getPipelineWeight(op: { sale_probability: number | null }): number {
  return op.sale_probability != null ? op.sale_probability / 100 : PIPELINE_WEIGHT_FALLBACK
}

/**
 * Minimal shape needed to compute pipeline commissions for an operation.
 * Accepts both Operation and OperationWithAgent.
 */
export type PipelineOpLike = {
  property_value: number | null
  comm_pct_seller: number
  comm_pct_buyer: number
  origin: 'agente' | 'agenzia' | 'valutazione'
  comm_mode_seller?: 'pct' | 'fixed' | null
  comm_mode_buyer?: 'pct' | 'fixed' | null
  comm_fixed_seller?: number | null
  comm_fixed_buyer?: number | null
  collaborator_comm_pct?: number | null
  sale_probability: number | null
}

export type AgentRateLike = {
  comm_pct_agency: number
  comm_pct_agent: number
}

/**
 * Central estimator for pipeline commissions.
 * Always passes `opts` so fixed-mode commissions + collaborator share are correct.
 *
 * Returns null if agent is missing, OR if BOTH sides are in % mode and there's
 * no property_value (impossible to compute). When at least one side is in
 * fixed mode, can compute even without property_value.
 */
export function estimatePipelineCommission(op: PipelineOpLike, agent: AgentRateLike | null | undefined): CommissionResult | null {
  if (!agent) return null
  const modeS = op.comm_mode_seller || 'pct'
  const modeB = op.comm_mode_buyer || 'pct'
  // Senza property_value, possiamo calcolare solo se ALMENO una commissione è fissa.
  // Se entrambe pct e value mancante → tutto 0, ritorna null perché significherebbe nulla.
  if (!op.property_value && modeS === 'pct' && modeB === 'pct') return null
  return calculateCommissions(
    op.property_value || 0,
    op.comm_pct_seller,
    op.comm_pct_buyer,
    op.origin,
    agent.comm_pct_agency,
    agent.comm_pct_agent,
    {
      commModeSeller: modeS,
      commModeBuyer: modeB,
      commFixedSeller: op.comm_fixed_seller || 0,
      commFixedBuyer: op.comm_fixed_buyer || 0,
      collaboratorCommPct: op.collaborator_comm_pct || 0,
    }
  )
}

export function calculateCommissions(
  finalValue: number,
  commPctSeller: number,
  commPctBuyer: number,
  origin: 'agente' | 'agenzia' | 'valutazione',
  agentCommPctAgency: number,
  agentCommPctAgent: number,
  opts?: CommissionOptions
): CommissionResult {
  const modeSeller = opts?.commModeSeller || 'pct'
  const modeBuyer = opts?.commModeBuyer || 'pct'

  const seller = modeSeller === 'fixed' ? (opts?.commFixedSeller || 0) : finalValue * (commPctSeller / 100)
  const buyer = modeBuyer === 'fixed' ? (opts?.commFixedBuyer || 0) : finalValue * (commPctBuyer / 100)
  const grossCommission = seller + buyer

  // Quota agenzia / agente sul lordo (non dipende dalla collaborazione)
  const agentPct = origin === 'agente' ? agentCommPctAgent : agentCommPctAgency
  const agentGrossCommission = grossCommission * (agentPct / 100)
  const agencyRevenue = grossCommission - agentGrossCommission

  // ───────────────────────────────────────────────────────────────────────
  // LOGICA COLLABORAZIONE (richiesta team meeting 28-04-2026):
  // La quota del collaboratore esce SEMPRE dalla quota dell'agente principale,
  // mai dal monte agenzia. Es: agente principale al 50%, collab interno 50%
  // → 50% agenzia / 25% agente / 25% collaboratore (non 50/40/10 come prima).
  // ───────────────────────────────────────────────────────────────────────
  const collabPct = opts?.collaboratorCommPct || 0
  const collaboratorCommission = collabPct > 0 ? agentGrossCommission * (collabPct / 100) : 0
  const agentCommission = agentGrossCommission - collaboratorCommission

  return {
    grossCommission: Number(grossCommission.toFixed(2)),
    agentCommission: Number(agentCommission.toFixed(2)),
    collaboratorCommission: Number(collaboratorCommission.toFixed(2)),
    agencyRevenue: Number(agencyRevenue.toFixed(2)),
    breakdown: {
      seller: Number(seller.toFixed(2)),
      buyer: Number(buyer.toFixed(2)),
    },
  }
}

const eurFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
})

export function formatEur(value: number): string {
  return eurFormatter.format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('it-IT').format(value)
}

/**
 * Format an operation's buyers list with retro-compat fallback.
 * Returns a comma-separated list of full names, or null if no buyer/s.
 */
export function getBuyersDisplay(op: {
  buyers?: Array<{ first_name: string; last_name: string }> | null
  buyer_first_name?: string | null
  buyer_last_name?: string | null
  buyer_name?: string | null
}): string | null {
  if (op.buyers && op.buyers.length > 0) {
    return op.buyers
      .map(b => [b.first_name, b.last_name].filter(Boolean).join(' ').trim())
      .filter(Boolean)
      .join(', ') || null
  }
  if (op.buyer_first_name || op.buyer_last_name) {
    return [op.buyer_first_name, op.buyer_last_name].filter(Boolean).join(' ').trim() || null
  }
  return op.buyer_name || null
}

/**
 * Format an operation's sellers list. Returns null if no sellers.
 */
export function getSellersDisplay(op: {
  sellers?: Array<{ first_name: string; last_name: string }> | null
}): string | null {
  if (op.sellers && op.sellers.length > 0) {
    return op.sellers
      .map(s => [s.first_name, s.last_name].filter(Boolean).join(' ').trim())
      .filter(Boolean)
      .join(', ') || null
  }
  return null
}

/** "16/03/2026" */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT')
}

/** "16/03/2026 14:32" */
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('it-IT') + ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

/** "14:32" */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

/** Format number for EUR input display: 250000 → "250.000,00" */
export function toEurInput(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return ''
  return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Parse Italian-formatted EUR string back to number: "250.000,00" → 250000 */
export function parseEurInput(s: string): number {
  const cleaned = s.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}
