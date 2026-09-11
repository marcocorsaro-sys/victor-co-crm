import { useEffect, useRef } from 'react'
import { Chart, BarController, LineController, BarElement, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js'
import type { OperationWithAgent } from '../lib/supabase'

Chart.register(BarController, LineController, BarElement, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend)

const BANDS = [
  { label: '< 100k', min: 0, max: 100000 },
  { label: '100–200k', min: 100000, max: 200000 },
  { label: '200–350k', min: 200000, max: 350000 },
  { label: '350–500k', min: 350000, max: 500000 },
  { label: '500k–1M', min: 500000, max: 1000000 },
  { label: '> 1M', min: 1000000, max: Infinity },
]

type Props = { operations: OperationWithAgent[] }

export default function PriceDistributionChart({ operations }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<any>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    const counts = BANDS.map(() => 0)
    const commTotals = BANDS.map(() => 0)

    operations.forEach(op => {
      const val = op.final_value || op.property_value || 0
      if (val <= 0) return
      for (let i = 0; i < BANDS.length; i++) {
        if (val >= BANDS[i].min && val < BANDS[i].max) {
          counts[i]++
          commTotals[i] += op.gross_commission || 0
          break
        }
      }
    })

    const avgComm = counts.map((c, i) => c > 0 ? commTotals[i] / c : 0)

    if (chartRef.current) chartRef.current.destroy()

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: BANDS.map(b => b.label),
        datasets: [
          {
            label: 'N. Operazioni',
            data: counts,
            backgroundColor: '#0d3447',
            borderRadius: 4,
            order: 2,
          },
          {
            label: 'Comm. Media',
            data: avgComm,
            type: 'line',
            borderColor: '#1f6f8b',
            backgroundColor: 'rgba(31,111,139,0.1)',
            yAxisID: 'y1',
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: '#1f6f8b',
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#4f5560', font: { family: "'Montserrat', sans-serif", size: 11 }, padding: 16, usePointStyle: true, pointStyleWidth: 12 },
          },
          tooltip: {
            backgroundColor: '#ffffff', titleColor: '#181a20', bodyColor: '#4f5560',
            borderColor: '#dddddd', borderWidth: 1, padding: 10,
            titleFont: { family: "'Montserrat', sans-serif", size: 12 },
            bodyFont: { family: "'Poppins', sans-serif", size: 12 },
            callbacks: {
              label: (ctx: any) => {
                if (ctx.dataset.yAxisID === 'y1')
                  return `${ctx.dataset.label}: ${new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(ctx.parsed.y)}`
                return `${ctx.dataset.label}: ${ctx.parsed.y}`
              },
            },
          },
        },
        scales: {
          x: { ticks: { color: '#717171', font: { family: "'Montserrat', sans-serif", size: 10 } }, grid: { color: 'rgba(13,52,71,0.06)' } },
          y: { position: 'left', ticks: { color: '#717171', font: { family: "'Montserrat', sans-serif", size: 10 }, stepSize: 1 }, grid: { color: 'rgba(13,52,71,0.06)' } },
          y1: {
            position: 'right',
            ticks: {
              color: '#717171', font: { family: "'Montserrat', sans-serif", size: 10 },
              callback: (v: string | number) => Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(0)}k` : v,
            },
            grid: { display: false },
          },
        },
      },
    })

    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [operations])

  return (
    <div style={{ height: 300 }}>
      <canvas ref={canvasRef} />
    </div>
  )
}
