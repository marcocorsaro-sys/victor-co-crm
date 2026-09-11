import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useValuations } from '../hooks/useValuations'
import { useProfiles } from '../hooks/useProfiles'
import { formatEur, formatDate } from '../lib/calculations'
import KpiCard from '../components/KpiCard'
import type { ValutazioneWithAgent } from '../lib/supabase'

const PROB_LABELS: Record<string, string> = {
  '15_giorni': 'Entro 15 gg',
  '3_mesi': 'Entro 3 mesi',
  '6_mesi': 'Entro 6 mesi',
}

const PROB_COLORS: Record<string, { color: string; bg: string }> = {
  '15_giorni': { color: 'var(--lime)', bg: 'rgba(13,52,71,0.15)' },
  '3_mesi': { color: 'var(--teal)', bg: 'rgba(31,111,139,0.15)' },
  '6_mesi': { color: 'var(--g)', bg: 'rgba(128,128,128,0.2)' },
}

const TARGET_MENSILE = 4 // target visite/mese per agente

export default function AdminValutazioni() {
  const navigate = useNavigate()
  const { valutazioni, loading, year, setYear } = useValuations()
  const { activeAgents, loading: pLoading } = useProfiles()
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 3 + i)
  const [search, setSearch] = useState('')

  const isLoading = loading || pLoading

  // Global KPIs
  const totalVal = valutazioni.length
  const totalIncarichi = valutazioni.filter(v => v.incarico_preso).length
  const tassoGlobale = totalVal > 0 ? (totalIncarichi / totalVal * 100) : 0
  const last30 = valutazioni.filter(v => new Date(v.created_at) >= new Date(Date.now() - 30 * 86400000)).length

  // Agent-level aggregation
  const currentMonth = new Date().getMonth() + 1
  const monthsElapsed = year === currentYear ? currentMonth : 12
  const targetAnno = TARGET_MENSILE * monthsElapsed

  const agentStats = activeAgents.map(agent => {
    const agentVals = valutazioni.filter(v => v.agent_id === agent.id)
    const incarichi = agentVals.filter(v => v.incarico_preso).length
    const ultimi30 = agentVals.filter(v => new Date(v.created_at) >= new Date(Date.now() - 30 * 86400000)).length
    const tasso = agentVals.length > 0 ? (incarichi / agentVals.length * 100) : 0
    const progressPct = targetAnno > 0 ? (agentVals.length / targetAnno * 100) : 0
    return {
      agent,
      totale: agentVals.length,
      incarichi,
      tasso,
      ultimi30,
      progressPct,
    }
  }).sort((a, b) => b.totale - a.totale)

  // All valuations list filtered
  const filteredAll = search
    ? valutazioni.filter(v => {
        const q = search.toLowerCase()
        const agentName = (v as ValutazioneWithAgent).profiles?.full_name || ''
        return v.owner_name.toLowerCase().includes(q) || v.address.toLowerCase().includes(q) || agentName.toLowerCase().includes(q)
      })
    : valutazioni

  const mono = { fontFamily: "'Montserrat', sans-serif" } as const

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="section-heading" style={{ margin: 0 }}>Valutazioni Agenti</div>
        <select className="filter-select" value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 100 }}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Global KPIs */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <KpiCard value={totalVal.toString()} label={`Valutazioni ${year}`} loading={isLoading} />
        <KpiCard value={totalIncarichi.toString()} label="Incarichi presi" loading={isLoading} color="green" />
        <KpiCard value={`${tassoGlobale.toFixed(0)}%`} label="Tasso conversione" loading={isLoading} color="teal" />
        <KpiCard value={last30.toString()} label="Ultimi 30 giorni" loading={isLoading} color="amber" />
      </div>

      {/* Agent benchmark table */}
      <div style={{ ...mono, fontSize: 11, color: 'var(--ld)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
        // Performance per agente — Target: {TARGET_MENSILE} visite/mese
      </div>
      <div className="table-wrap" style={{ marginBottom: 24 }}>
        <table>
          <thead>
            <tr>
              <th>Agente</th>
              <th>Tot. valutazioni</th>
              <th>Incarichi presi</th>
              <th>% conversione</th>
              <th>Ultimi 30gg</th>
              <th>Progresso target</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}><td colSpan={6}><div className="skeleton skeleton-row" /></td></tr>
              ))
            ) : agentStats.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--g)', padding: 24 }}>Nessun agente attivo</td></tr>
            ) : (
              agentStats.map(({ agent, totale, incarichi, tasso, ultimi30, progressPct }) => (
                <tr key={agent.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="avatar" style={{ backgroundColor: agent.color, width: 28, height: 28, fontSize: 10 }}>
                        {agent.initials}
                      </div>
                      <span className="clickable-cell" onClick={() => navigate(`/admin/agent/${agent.id}`)}>
                        {agent.full_name}
                      </span>
                    </div>
                  </td>
                  <td style={mono}>{totale}</td>
                  <td style={{ ...mono, color: 'var(--green)' }}>{incarichi}</td>
                  <td style={{ ...mono, color: tasso > 0 ? 'var(--teal)' : 'var(--g)' }}>{tasso.toFixed(0)}%</td>
                  <td style={{ ...mono, color: ultimi30 >= TARGET_MENSILE ? 'var(--lime)' : 'var(--amber)' }}>{ultimi30}</td>
                  <td style={{ width: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="progress-bar" style={{ flex: 1, height: 6 }}>
                        <div className="progress-bar-fill" style={{
                          width: `${Math.min(progressPct, 100)}%`,
                          backgroundColor: progressPct >= 100 ? 'var(--green)' : agent.color || 'var(--lime)',
                        }} />
                      </div>
                      <span style={{ ...mono, fontSize: 11, color: progressPct >= 100 ? 'var(--green)' : 'var(--g)', minWidth: 35 }}>
                        {progressPct.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* All valuations table */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div className="section-heading" style={{ margin: 0 }}>Tutte le valutazioni ({filteredAll.length})</div>
        <input className="filter-input" placeholder="Cerca proprietario, indirizzo, agente..."
          value={search} onChange={e => setSearch(e.target.value)} style={{ width: 300 }} />
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Proprietario</th><th>Indirizzo</th><th>Agente</th><th>Prob.</th>
              <th>Stima</th><th>Data</th><th>Stato</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={7}><div className="skeleton skeleton-row" /></td></tr>
              ))
            ) : filteredAll.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--g)', padding: 24 }}>Nessuna valutazione trovata</td></tr>
            ) : (
              filteredAll.map(v => {
                const va = v as ValutazioneWithAgent
                return (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 600 }}>{v.owner_name}</td>
                    <td>
                      {v.address && (
                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.address)}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 12, color: 'var(--g)', textDecoration: 'none' }}>
                          {v.address}
                        </a>
                      )}
                    </td>
                    <td>
                      {va.profiles && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div className="avatar" style={{ backgroundColor: va.profiles.color, width: 22, height: 22, fontSize: 9 }}>
                            {va.profiles.initials}
                          </div>
                          <span className="clickable-cell" style={{ fontSize: 12 }}
                            onClick={() => navigate(`/admin/agent/${v.agent_id}`)}>
                            {va.profiles.full_name}
                          </span>
                        </div>
                      )}
                    </td>
                    <td>
                      {v.acquisition_probability && (() => {
                        const pc = PROB_COLORS[v.acquisition_probability]
                        return (
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 6, color: pc?.color, background: pc?.bg }}>
                            {PROB_LABELS[v.acquisition_probability]}
                          </span>
                        )
                      })()}
                    </td>
                    <td style={mono}>{v.estimated_price != null ? formatEur(v.estimated_price) : '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--gl)' }}>{formatDate(v.valuation_date)}</td>
                    <td>
                      {v.incarico_preso ? (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, color: 'var(--green)', background: 'rgba(29,143,95,0.15)' }}>
                          INCARICO ✓
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, color: 'var(--amber)', background: 'rgba(183,121,31,0.15)' }}>
                          In attesa
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
