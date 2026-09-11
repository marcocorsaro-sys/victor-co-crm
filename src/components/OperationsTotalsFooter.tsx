import type { OperationWithAgent, Profile } from '../lib/supabase'
import { formatEur, estimatePipelineCommission, getPipelineWeight, PIPELINE_FORMULAS, ACCEPTED_PROPOSAL_WEIGHT } from '../lib/calculations'
import FormulaTip from './FormulaTip'

type Props = {
  /** Le operazioni su cui calcolare i totali (già filtrate dalla tabella). */
  operations: OperationWithAgent[]
  /**
   * Risolutore agente per ogni operazione.
   * - In viste admin globali: passa i Profile e cerca per agent_id.
   * - In viste agente singolo: ritorna sempre lo stesso profilo.
   * - Se profile === null/undefined, l'operazione viene ignorata nel calcolo pipeline.
   */
  resolveAgent: (op: OperationWithAgent) => Profile | null | undefined
  /** Etichetta dell'anno mostrata nel titolo (default: anno corrente). */
  yearLabel?: number | string
  /**
   * Se valorizzato, le completate vengono filtrate per `sale_date` in quell'anno.
   * Se assente, somma tutte le completate del set passato (stato del filtro).
   */
  completedYearFilter?: number
  /** Override testuale della label "Completate" (es. quando non si vincola l'anno). */
  completedLabel?: string
}

/**
 * Footer riassuntivo standard per ogni tabella di operazioni.
 *
 * Mostra 4 metriche fisse:
 *   1) Totale Completate (Σ gross_commission delle ops `completata` nel set)
 *   2) Totale Proposte Accettate (Σ stima lorda, pesate 90% nella stima)
 *   3) Totale Pipeline 100% (Σ stima lorda delle ops `pipeline`, senza pesi)
 *   4) Totale Stima (1 + 2 × 90% + pipeline × probabilità, scenario realistico)
 *
 * Tutti i calcoli usano `estimatePipelineCommission` (corretto per modalità fissa
 * e quote collaboratore) e `getPipelineWeight` (50% di fallback).
 */
export default function OperationsTotalsFooter({ operations, resolveAgent, yearLabel, completedYearFilter, completedLabel }: Props) {
  const year = yearLabel ?? new Date().getFullYear()

  // Optional sale_date year filter for completed
  const yStart = completedYearFilter != null ? new Date(completedYearFilter, 0, 1) : null
  const yEnd = completedYearFilter != null ? new Date(completedYearFilter + 1, 0, 1) : null

  let completedGross = 0
  let completedCount = 0
  let pipelineGross = 0
  let pipelineWeighted = 0
  let pipelineCount = 0
  // Proposta accettata = soldi attesi quasi certi (peso 90% nella stima), separati da pipeline
  let propostaGross = 0
  let propostaCount = 0

  operations.forEach(op => {
    if (op.status === 'incassato') {
      if (yStart && yEnd) {
        if (!op.sale_date) return
        const d = new Date(op.sale_date)
        if (d < yStart || d >= yEnd) return
      }
      completedGross += Number(op.gross_commission) || 0
      completedCount++
    } else if (op.status === 'pipeline') {
      const agent = resolveAgent(op)
      const est = estimatePipelineCommission(op, agent)
      if (!est) return
      pipelineGross += est.grossCommission
      pipelineWeighted += est.grossCommission * getPipelineWeight(op)
      pipelineCount++
    } else if (op.status === 'proposta_accettata') {
      const agent = resolveAgent(op)
      const est = estimatePipelineCommission(op, agent)
      if (!est) return
      propostaGross += est.grossCommission
      propostaCount++
    }
    // 'terminato' → escluso da tutti i totali (mandato chiuso senza incasso)
  })

  // Stima totale realistica = incassate + proposte accettate × 90% + pipeline pesate
  const totalCompletedPlusWeighted = completedGross + propostaGross * ACCEPTED_PROPOSAL_WEIGHT + pipelineWeighted

  const cellStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderRadius: 10,
    background: 'var(--s2)',
    border: '1px solid var(--bd)',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    color: 'var(--g)',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    marginBottom: 6,
    display: 'inline-flex',
    alignItems: 'center',
  }
  const valueStyle: React.CSSProperties = {
    fontFamily: "'Montserrat', sans-serif",
    fontSize: 16,
    fontWeight: 700,
  }

  const completedLbl = completedLabel ?? `Tot. Completate ${year}`
  const countStyle: React.CSSProperties = { fontSize: 10, color: 'var(--g)', marginTop: 2, fontFamily: "'Montserrat', sans-serif" }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: 10,
      marginTop: 12,
      marginBottom: 24,
    }}>
      <div style={cellStyle}>
        <div style={labelStyle}>
          <span>{completedLbl}</span>
          <FormulaTip title={completedLbl}
            formula={completedYearFilter != null
              ? `Σ gross_commission delle operazioni 'completata' con sale_date nel ${completedYearFilter}`
              : "Σ gross_commission delle operazioni 'completata' nel set filtrato"} />
        </div>
        <div style={{ ...valueStyle, color: 'var(--w)' }}>{formatEur(completedGross)}</div>
        <div style={countStyle}>{completedCount} {completedCount === 1 ? 'operazione' : 'operazioni'}</div>
      </div>
      <div style={cellStyle}>
        <div style={labelStyle}>
          <span>Tot. Proposte Accettate</span>
          <FormulaTip title="Tot. Proposte Accettate"
            formula="Σ stima lorda delle ops in stato 'proposta accettata' (proposta firmata, soldi non ancora incassati)"
            note={PIPELINE_FORMULAS.acceptedWeight} />
        </div>
        <div style={{ ...valueStyle, color: 'var(--amber)' }}>{formatEur(propostaGross)}</div>
        <div style={countStyle}>{propostaCount} {propostaCount === 1 ? 'operazione' : 'operazioni'}</div>
      </div>
      <div style={cellStyle}>
        <div style={labelStyle}>
          <span>Tot. Pipeline (100%)</span>
          <FormulaTip title="Tot. Pipeline (100%)"
            formula={PIPELINE_FORMULAS.pipelineGross}
            note="Scenario ottimistico: tutte le pipeline chiudono." />
        </div>
        <div style={{ ...valueStyle, color: 'var(--amber)' }}>{formatEur(pipelineGross)}</div>
        <div style={countStyle}>{pipelineCount} {pipelineCount === 1 ? 'operazione' : 'operazioni'}</div>
      </div>
      <div style={cellStyle}>
        <div style={labelStyle}>
          <span>Tot. Stima {year}</span>
          <FormulaTip title={`Tot. Stima ${year}`}
            formula={`(${completedLbl}) + (Proposte Accettate × 90%) + (Pipeline × probabilità)`}
            note="Scenario realistico: incassi effettivi + proposte accettate × 90% + pipeline ponderate per probabilità." />
        </div>
        <div style={{ ...valueStyle, color: 'var(--green)' }}>{formatEur(totalCompletedPlusWeighted)}</div>
        <div style={countStyle}>{completedCount + propostaCount + pipelineCount} {completedCount + propostaCount + pipelineCount === 1 ? 'operazione' : 'operazioni'} totali</div>
      </div>
    </div>
  )
}
