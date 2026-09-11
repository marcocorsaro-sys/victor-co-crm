import { useEffect, useRef } from 'react'
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js'
import type { OperationWithAgent } from '../lib/supabase'

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const MONTHS = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']

type Props = {
  operations: OperationWithAgent[]
  selectedYear: number
  referenceYear: number
}

function getMonthlyData(ops: OperationWithAgent[], year: number) {
  const monthly = Array(12).fill(0) as number[]
  ops.forEach(o => {
    if (o.status !== 'incassato' || !o.sale_date) return
    const d = new Date(o.sale_date)
    if (d.getFullYear() !== year) return
    monthly[d.getMonth()] += o.gross_commission || 0
  })
  return monthly
}

export default function YearComparisonChart({ operations, selectedYear, referenceYear }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    const current = getMonthlyData(operations, selectedYear)
    const reference = getMonthlyData(operations, referenceYear)

    if (chartRef.current) chartRef.current.destroy()

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: MONTHS,
        datasets: [
          {
            label: `${selectedYear} Commissioni`,
            data: current,
            backgroundColor: 'rgba(13,52,71,0.85)',
            borderRadius: 4,
            barPercentage: 0.4,
            categoryPercentage: 0.7,
          },
          {
            label: `${referenceYear} Commissioni`,
            data: reference,
            backgroundColor: 'rgba(31,111,139,0.45)',
            borderRadius: 4,
            barPercentage: 0.4,
            categoryPercentage: 0.7,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#4f5560', font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const v = ctx.parsed?.y ?? 0
                const lbl = ctx.dataset.label || ''
                return `${lbl}: €${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0)}`
              },
              afterLabel: (ctx) => {
                if (ctx.datasetIndex !== 0) return ''
                const curVal = current[ctx.dataIndex]
                const refVal = reference[ctx.dataIndex]
                if (refVal > 0) {
                  const delta = ((curVal - refVal) / refVal * 100).toFixed(1)
                  return `Delta: ${Number(delta) >= 0 ? '+' : ''}${delta}%`
                }
                return ''
              },
            },
          },
        },
        scales: {
          x: { ticks: { color: '#717171' }, grid: { color: 'rgba(13,52,71,0.06)' } },
          y: {
            ticks: {
              color: '#717171',
              callback: (v) => Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(0)}k` : String(v),
            },
            grid: { color: 'rgba(13,52,71,0.06)' },
          },
        },
      },
    })

    return () => { chartRef.current?.destroy() }
  }, [operations, selectedYear, referenceYear])

  return (
    <div style={{ height: 320 }}>
      <canvas ref={canvasRef} />
    </div>
  )
}
