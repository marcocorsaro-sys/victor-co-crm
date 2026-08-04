/**
 * Sanity check del modello di proiezione (pipeline pesata).
 * Esegui con: npx tsx scripts/test-projections.ts
 */
import { calculateProjectedTrajectory } from '../src/lib/projections'
import type { Operation, Profile } from '../src/lib/supabase'

const agent = {
  id: 'a1', comm_pct_agency: 20, comm_pct_agent: 50, active: true,
} as unknown as Profile

const year = new Date().getFullYear()

function op(partial: Partial<Operation>): Operation {
  return {
    id: Math.random().toString(36).slice(2),
    agent_id: 'a1',
    type: 'vendita',
    origin: 'agente',
    comm_pct_seller: 4,
    comm_pct_buyer: 3,
    comm_mode_seller: 'pct',
    comm_mode_buyer: 'pct',
    comm_fixed_seller: 0,
    comm_fixed_buyer: 0,
    collaborator_comm_pct: 0,
    date_added: `${year}-01-10`,
    mandate_start_date: null,
    sale_probability: null,
    property_value: null,
    sale_date: null,
    final_value: null,
    gross_commission: null,
    agent_commission: null,
    status: 'pipeline',
    ...partial,
  } as Operation
}

// 2 incassate (per YTD e lead mediano), 1 proposta accettata, 2 pipeline
const completed = [
  op({ status: 'incassato', sale_date: `${year}-03-15`, date_added: `${year}-01-10`, gross_commission: 10000, agent_commission: 5000, final_value: 150000 }),
  op({ status: 'incassato', sale_date: `${year}-05-20`, date_added: `${year}-02-01`, gross_commission: 20000, agent_commission: 10000, final_value: 300000 }),
  op({ status: 'incassato', sale_date: `${year}-06-10`, date_added: `${year}-03-01`, gross_commission: 5000, agent_commission: 2500, final_value: 80000 }),
]
const open = [
  op({ status: 'proposta_accettata', property_value: 100000, sale_probability: 60 }), // 7000 lordi → ×0.9 = 6300 (prob ignorata)
  op({ status: 'pipeline', property_value: 200000, sale_probability: 90 }),           // 14000 → ×0.9
  op({ status: 'pipeline', property_value: 100000, sale_probability: null }),         // 7000 → ×0.5 fallback
]

const { monthly, breakdown: bd } = calculateProjectedTrajectory(completed, open, [agent], year)

const approx = (a: number, b: number, eps = 1) => Math.abs(a - b) < eps
let failures = 0
function check(label: string, ok: boolean) {
  if (!ok) failures++
  console.log(`${ok ? 'OK ' : 'FAIL'} ${label}`)
}

check(`YTD = 35000 (got ${bd.ytdActual})`, approx(bd.ytdActual, 35000))
check(`proposta accettata lorda = 7000 (got ${bd.acceptedGross})`, approx(bd.acceptedGross, 7000))
check(`proposta accettata pesata = 6300, prob. ignorata (got ${bd.acceptedWeighted})`, approx(bd.acceptedWeighted, 6300))
check(`pipeline lorda = 21000 (got ${bd.pipelineGrossTotal})`, approx(bd.pipelineGrossTotal, 21000))
// pesata: 14000×0.9 + 7000×0.5 = 16100 (fattore tempo = 1: op vecchie, tanti giorni residui)
check(`pipeline pesata = 16100 (got ${bd.pipelineWeightedByProb})`, approx(bd.pipelineWeightedByProb, 16100))
check(`totale = YTD + PA + pipe (got ${bd.projectedTotal})`, approx(bd.projectedTotal, bd.ytdActual + bd.acceptedWeighted + bd.pipelineWeightedByProb))
check(`prudente esclude prob<60: 35000+6300+12600 (got ${bd.projectedPrudente})`, approx(bd.projectedPrudente, 35000 + 6300 + 12600))
check(`ottimista tutto lordo: 35000+7000+21000 (got ${bd.projectedOttimista})`, approx(bd.projectedOttimista, 63000))
check(`nessun trend: proiezione futura totale = PA + pipe pesata`, approx(monthly.reduce((s, m) => s + m.projected, 0), bd.acceptedWeighted + bd.pipelineWeightedByProb))
check(`cumulata dicembre = projectedTotal (got ${monthly[11].cumulativeProjected})`, approx(monthly[11].cumulativeProjected, bd.projectedTotal))
check(`margine proiettato < lordo proiettato`, bd.projectedMargin < bd.projectedTotal)

process.exit(failures ? 1 : 0)
