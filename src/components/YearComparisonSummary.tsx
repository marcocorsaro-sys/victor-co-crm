import type { OperationWithAgent } from '../lib/supabase'
import { formatEur } from '../lib/calculations'

type Props = {
  operations: OperationWithAgent[]
  selectedYear: number
  referenceYear: number
}

function getYearStats(ops: OperationWithAgent[], year: number) {
  const completed = ops.filter(o => o.status === 'incassato' && o.sale_date && new Date(o.sale_date).getFullYear() === year)
  return {
    count: completed.length,
    grossCommission: completed.reduce((s, o) => s + (o.gross_commission || 0), 0),
    agentCommission: completed.reduce((s, o) => s + (o.agent_commission || 0), 0),
    totalValue: completed.reduce((s, o) => s + (o.final_value || 0), 0),
  }
}

function DeltaCard({ label, current, reference, format }: { label: string; current: number; reference: number; format: (n: number) => string }) {
  const delta = reference > 0 ? ((current - reference) / reference * 100) : current > 0 ? 100 : 0
  const positive = delta >= 0
  return (
    <div style={{
      background: 'var(--s1)', borderRadius: 12, padding: '16px 20px', border: '1px solid var(--bd)',
      flex: 1, minWidth: 160,
    }}>
      <div style={{ fontSize: 11, color: 'var(--g)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 18, color: 'var(--w)', fontWeight: 700 }}>
        {format(current)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
        <span style={{
          fontSize: 12, fontWeight: 600,
          color: positive ? 'var(--green)' : 'var(--red)',
        }}>
          {positive ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
        </span>
        <span style={{ fontSize: 11, color: 'var(--g)' }}>vs {format(reference)}</span>
      </div>
    </div>
  )
}

export default function YearComparisonSummary({ operations, selectedYear, referenceYear }: Props) {
  const cur = getYearStats(operations, selectedYear)
  const ref = getYearStats(operations, referenceYear)

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
      <DeltaCard label="Ops Chiuse" current={cur.count} reference={ref.count} format={n => String(n)} />
      <DeltaCard label="Commissioni Lorde" current={cur.grossCommission} reference={ref.grossCommission} format={formatEur} />
      <DeltaCard label="Provvigioni Agente" current={cur.agentCommission} reference={ref.agentCommission} format={formatEur} />
      <DeltaCard label="Valore Totale" current={cur.totalValue} reference={ref.totalValue} format={formatEur} />
    </div>
  )
}
