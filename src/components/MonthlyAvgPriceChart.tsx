import { useEffect, useRef } from 'react'
import { Chart, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler } from 'chart.js'
import type { OperationWithAgent } from '../lib/supabase'

Chart.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler)

type Props = { operations: OperationWithAgent[]; year: number }

export default function MonthlyAvgPriceChart({ operations, year }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<any>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    const labels = Array.from({ length: 12 }, (_, i) =>
      new Date(year, i).toLocaleDateString('it-IT', { month: 'short' }).toUpperCase()
    )

    const completed = operations.filter(o => o.status === 'incassato' && o.sale_date)

    const monthData = Array.from({ length: 12 }, (_, m) => {
      const ops = completed.filter(o => {
        const d = new Date(o.sale_date!)
        return d.getFullYear() === year && d.getMonth() === m
      })
      const totalVal = ops.reduce((s, o) => s + (o.final_value || o.property_value || 0), 0)
      const totalComm = ops.reduce((s, o) => s + (o.gross_commission || 0), 0)
      return {
        avgPrice: ops.length > 0 ? totalVal / ops.length : 0,
        avgComm: ops.length > 0 ? totalComm / ops.length : 0,
        count: ops.length,
      }
    })

    if (chartRef.current) chartRef.current.destroy()

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Prezzo Medio',
            data: monthData.map(d => d.avgPrice || null),
            borderColor: '#0d3447',
            backgroundColor: 'rgba(13,52,71,0.08)',
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: '#0d3447',
            spanGaps: true,
          },
          {
            label: 'Comm. Media',
            data: monthData.map(d => d.avgComm || null),
            borderColor: '#1f6f8b',
            backgroundColor: 'rgba(31,111,139,0.08)',
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: '#1f6f8b',
            yAxisID: 'y1',
            spanGaps: true,
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
            callbacks: {
              label: (ctx: any) =>
                `${ctx.dataset.label}: ${new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(ctx.parsed.y)}`,
            },
          },
        },
        scales: {
          x: { ticks: { color: '#717171', font: { family: "'Montserrat', sans-serif", size: 10 } }, grid: { color: 'rgba(13,52,71,0.06)' } },
          y: {
            position: 'left',
            ticks: {
              color: '#717171', font: { family: "'Montserrat', sans-serif", size: 10 },
              callback: (v: string | number) => Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(0)}k` : v,
            },
            grid: { color: 'rgba(13,52,71,0.06)' },
          },
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
  }, [operations, year])

  return (
    <div style={{ height: 300 }}>
      <canvas ref={canvasRef} />
    </div>
  )
}
