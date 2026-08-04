import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import KpiCard from '../components/KpiCard'

/** ─── Types ─────────────────────────────────────────────────────────── */
type Agency = {
  id: string
  name: string
  city: string
  immobiliare_query: string | null
  immobiliare_url: string | null
  notes: string | null
  active: boolean
  position: number | null
}

type WeeklyListing = {
  id: string
  agency_id: string
  iso_year: number
  iso_week: number
  week_start: string
  listings_count: number
  source: string
  recorded_at: string
}

type OmiQuarter = {
  id: string
  city: string
  province_code: string
  year: number
  quarter: number
  ntn_residential: number | null
  ntn_non_residential: number | null
  ntn_total: number | null
  imi_residential: number | null
  source: string
  notes: string | null
}

/** ─── ISO week helpers (same logic as AdminWeekly) ─────────────────── */
function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return { year: d.getUTCFullYear(), week }
}

function getWeekRange(year: number, week: number): { start: Date; end: Date } {
  const jan4 = new Date(year, 0, 4)
  const dayOfWeek = jan4.getDay() || 7
  const week1Monday = new Date(jan4)
  week1Monday.setDate(jan4.getDate() - dayOfWeek + 1)
  const start = new Date(week1Monday)
  start.setDate(week1Monday.getDate() + (week - 1) * 7)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { start, end }
}

/** ─── Component ─────────────────────────────────────────────────────── */
export default function AdminMercato() {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [listings, setListings] = useState<WeeklyListing[]>([])
  const [omi, setOmi] = useState<OmiQuarter[]>([])
  const [loading, setLoading] = useState(true)
  const [editingCell, setEditingCell] = useState<{ agencyId: string; week: number } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showAddAgency, setShowAddAgency] = useState(false)
  const [showOmiUpload, setShowOmiUpload] = useState(false)

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 3 + i)
  const today = new Date()
  const todayWeek = today.getFullYear() === selectedYear ? getISOWeek(today).week : -1

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [aRes, lRes, oRes] = await Promise.all([
      supabase.from('competitor_agencies').select('*').eq('active', true).order('position', { ascending: true }),
      supabase.from('market_weekly_listings').select('*').eq('iso_year', selectedYear),
      supabase.from('market_omi_quarterly').select('*').eq('city', 'Novara').gte('year', currentYear - 2).order('year').order('quarter'),
    ])
    setAgencies(aRes.data || [])
    setListings(lRes.data || [])
    setOmi(oRes.data || [])
    setLoading(false)
  }, [selectedYear, currentYear])

  useEffect(() => { fetchData() }, [fetchData])

  // Build lookup: agency_id+week → { count, source } (priority: immobiliare > manual > wayback)
  const listingsMap = useMemo(() => {
    const priority: Record<string, number> = { immobiliare: 3, manual: 2, wayback: 1 }
    const m = new Map<string, { count: number; source: string }>()
    listings.forEach(l => {
      const key = `${l.agency_id}-${l.iso_week}`
      const existing = m.get(key)
      const newPri = priority[l.source] || 0
      const exPri = existing ? (priority[existing.source] || 0) : -1
      if (newPri > exPri) m.set(key, { count: l.listings_count, source: l.source })
    })
    return m
  }, [listings])

  const getCount = (agencyId: string, week: number): number | null => {
    return listingsMap.get(`${agencyId}-${week}`)?.count ?? null
  }

  const getSource = (agencyId: string, week: number): string | null => {
    return listingsMap.get(`${agencyId}-${week}`)?.source ?? null
  }

  const getDelta = (agencyId: string, week: number): number | null => {
    if (week <= 1) return null
    const cur = getCount(agencyId, week)
    const prev = getCount(agencyId, week - 1)
    if (cur === null || prev === null) return null
    return cur - prev
  }

  // Save edited cell
  const saveCount = async (agencyId: string, week: number, count: number) => {
    const range = getWeekRange(selectedYear, week)
    const { error } = await supabase
      .from('market_weekly_listings')
      .upsert({
        agency_id: agencyId,
        iso_year: selectedYear,
        iso_week: week,
        week_start: range.start.toISOString().split('T')[0],
        listings_count: count,
        source: 'manual',
      }, { onConflict: 'agency_id,iso_year,iso_week,source' })
    if (!error) fetchData()
  }

  // KPIs
  const kpis = useMemo(() => {
    const currentWeekCounts = agencies.map(a => getCount(a.id, todayWeek)).filter((v): v is number => v !== null)
    const totalCurrent = currentWeekCounts.reduce((s, c) => s + c, 0)
    const prevWeekCounts = agencies.map(a => getCount(a.id, todayWeek - 1)).filter((v): v is number => v !== null)
    const totalPrev = prevWeekCounts.reduce((s, c) => s + c, 0)
    const delta = totalCurrent - totalPrev
    return {
      totalAgencies: agencies.length,
      totalListings: totalCurrent,
      delta,
      omiLastQuarter: omi[omi.length - 1] || null,
    }
  }, [agencies, listings, listingsMap, todayWeek, omi])

  const mono = { fontFamily: "'JetBrains Mono', monospace" } as const

  // T0 = 2026-W19 (settimana di partenza tracciamento mercato)
  const T0_YEAR = 2026
  const T0_WEEK = 19

  // Settimana di partenza per la griglia (T0 se anno = 2026, altrimenti W1)
  const startWeek = selectedYear === T0_YEAR ? T0_WEEK : 1

  // Settimana di fine: settimana corrente o ultima con dati (whichever later)
  const lastWeekWithData = useMemo(() => {
    let max = startWeek
    listings.forEach(l => { if (l.iso_week > max) max = l.iso_week })
    return Math.max(max, todayWeek > 0 ? todayWeek : startWeek)
  }, [listings, todayWeek, startWeek])

  // Show weeks from startWeek to lastWeek + 4 future weeks ahead for planning
  const displayWeeks = useMemo(() => {
    const weeks: number[] = []
    for (let w = startWeek; w <= Math.min(lastWeekWithData + 4, 53); w++) weeks.push(w)
    return weeks
  }, [startWeek, lastWeekWithData])

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div className="section-heading" style={{ margin: 0 }}>Mercato — Novara</div>
          <div style={{ fontSize: 12, color: 'var(--g)', marginTop: 4 }}>
            Top 10 agenzie su Immobiliare.it · Compravendite OMI Agenzia Entrate
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="filter-select" value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))} style={{ width: 100 }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowAddAgency(true)}>
            + Agenzia
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ marginBottom: 16 }}>
        <KpiCard value={kpis.totalAgencies.toString()} label="Agenzie tracciate" loading={loading} />
        <KpiCard value={kpis.totalListings.toString()} label={`Immobili in vendita W${todayWeek}`} loading={loading} color="amber" />
        <KpiCard
          value={kpis.delta === 0 ? '—' : `${kpis.delta > 0 ? '+' : ''}${kpis.delta}`}
          label="Δ vs sett. prec."
          loading={loading}
          color={kpis.delta > 0 ? 'green' : kpis.delta < 0 ? 'red' : 'lime'}
        />
        <KpiCard
          value={kpis.omiLastQuarter ? Math.round(kpis.omiLastQuarter.ntn_total || kpis.omiLastQuarter.ntn_residential || 0).toString() : '—'}
          label={kpis.omiLastQuarter ? `OMI Q${kpis.omiLastQuarter.quarter} ${kpis.omiLastQuarter.year}` : 'OMI (no data)'}
          loading={loading} color="teal"
        />
      </div>

      {/* Weekly grid */}
      <div style={{ ...mono, fontSize: 11, color: 'var(--ld)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
        // Immobili in vendita per agenzia · settimane ISO {selectedYear}
      </div>
      <div style={{ fontSize: 11, color: 'var(--g)', marginBottom: 10, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span>T0 = W{T0_WEEK} {T0_YEAR}. Scraping live ogni lunedì 06:00.</span>
        <span>Click cella per modificare manualmente.</span>
        <span style={{ color: 'var(--green)' }}>▲ aumento</span>
        <span style={{ color: 'var(--red)' }}>▼ diminuzione</span>
      </div>

      <div className="table-wrap" style={{ marginBottom: 24, overflow: 'auto', maxHeight: 600 }}>
        <table style={{ minWidth: 800 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg)' }}>
            <tr>
              <th style={{ position: 'sticky', left: 0, background: 'var(--bg)', minWidth: 200, zIndex: 3 }}>Agenzia</th>
              {displayWeeks.map(w => (
                <th key={w} style={{
                  textAlign: 'center', minWidth: 56,
                  color: w === todayWeek ? 'var(--lime)' : 'var(--g)',
                  fontWeight: w === todayWeek ? 700 : 500,
                  background: w === todayWeek ? 'rgba(200,230,74,0.1)' : undefined,
                }}>W{w}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={displayWeeks.length + 1}><div className="skeleton skeleton-row" /></td></tr>
            ) : agencies.length === 0 ? (
              <tr><td colSpan={displayWeeks.length + 1} style={{ textAlign: 'center', color: 'var(--g)', padding: 24 }}>Nessuna agenzia tracciata</td></tr>
            ) : (
              agencies.map(a => {
                const isVictor = a.name.toLowerCase().includes('victor')
                return (
                  <tr key={a.id} style={isVictor ? { background: 'rgba(200,230,74,0.05)' } : undefined}>
                    <td style={{
                      position: 'sticky', left: 0, background: isVictor ? 'rgba(200,230,74,0.05)' : 'var(--bg)',
                      fontWeight: 600, fontSize: 13, color: isVictor ? 'var(--lime)' : 'var(--w)',
                      borderRight: '1px solid var(--bd)',
                    }}>
                      {a.name}
                      {isVictor && <span style={{ marginLeft: 6, fontSize: 9, color: 'var(--lime)' }}>(noi)</span>}
                    </td>
                    {displayWeeks.map(w => {
                      const count = getCount(a.id, w)
                      const source = getSource(a.id, w)
                      const delta = getDelta(a.id, w)
                      const isEditing = editingCell?.agencyId === a.id && editingCell?.week === w
                      const isCurrent = w === todayWeek
                      const isFuture = w > todayWeek
                      const isEstimate = source === 'wayback'
                      return (
                        <td key={w} style={{
                          textAlign: 'center', minWidth: 56,
                          background: isCurrent ? 'rgba(200,230,74,0.04)' : undefined,
                          padding: 4,
                          cursor: isEditing ? 'text' : 'pointer',
                          opacity: isFuture ? 0.4 : 1,
                        }}
                          onClick={() => {
                            if (!isEditing) {
                              setEditingCell({ agencyId: a.id, week: w })
                              setEditValue(count !== null ? count.toString() : '')
                            }
                          }}
                        >
                          {isEditing ? (
                            <input
                              type="number"
                              autoFocus
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={async () => {
                                const n = parseInt(editValue)
                                if (!isNaN(n) && n >= 0) await saveCount(a.id, w, n)
                                setEditingCell(null)
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur()
                                } else if (e.key === 'Escape') {
                                  setEditingCell(null)
                                }
                              }}
                              style={{
                                width: '100%', padding: 4, textAlign: 'center',
                                background: 'var(--bg2)', border: '1px solid var(--lime)', borderRadius: 4,
                                color: 'var(--w)', fontSize: 12,
                              }}
                            />
                          ) : count === null ? (
                            <span style={{ color: 'var(--g)', fontSize: 11 }}>—</span>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }} title={source ? `Fonte: ${source}` : ''}>
                              <span style={{
                                ...mono, fontSize: 12,
                                color: isEstimate ? 'var(--g)' : 'var(--w)',
                                fontWeight: 600,
                                fontStyle: isEstimate ? 'italic' : 'normal',
                              }}>
                                {count}{isEstimate ? '~' : ''}
                              </span>
                              {delta !== null && delta !== 0 && (
                                <span style={{
                                  ...mono, fontSize: 9, fontWeight: 700,
                                  color: delta > 0 ? 'var(--green)' : 'var(--red)',
                                }}>
                                  {delta > 0 ? '▲' : '▼'}{Math.abs(delta)}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* OMI Quarterly section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 10 }}>
        <div style={{ ...mono, fontSize: 11, color: 'var(--ld)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          // Compravendite OMI · Provincia di Novara · ultimi 2 anni
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowOmiUpload(true)} style={{ fontSize: 11 }}>
          + Inserisci dato OMI
        </button>
      </div>
      <div style={{ background: 'var(--s1)', borderRadius: 12, padding: 16, border: '1px solid var(--bd)', marginBottom: 24 }}>
        {omi.length === 0 ? (
          <div style={{ color: 'var(--g)', fontSize: 13, textAlign: 'center', padding: 12 }}>
            Nessun dato OMI inserito. Carica i volumi trimestrali dall'Agenzia delle Entrate (NTN — Numero Transazioni Normalizzate).
            <div style={{ fontSize: 11, color: 'var(--gl)', marginTop: 6 }}>
              Fonte ufficiale: <a href="https://www.agenziaentrate.gov.it/portale/web/guest/schede/fabbricatiterreni/omi/pubblicazioni/statistiche-trimestrali"
                target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal)' }}>
                agenziaentrate.gov.it · Statistiche Trimestrali OMI
              </a>
            </div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Trimestre</th>
                <th style={{ textAlign: 'right' }}>NTN Residenziali</th>
                <th style={{ textAlign: 'right' }}>NTN Non residenziali</th>
                <th style={{ textAlign: 'right' }}>NTN Totale</th>
                <th style={{ textAlign: 'right' }}>IMI Residenziale</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {omi.map(o => (
                <tr key={o.id}>
                  <td style={mono}>Q{o.quarter} {o.year}</td>
                  <td style={{ ...mono, textAlign: 'right' }}>{o.ntn_residential != null ? o.ntn_residential.toFixed(0) : '—'}</td>
                  <td style={{ ...mono, textAlign: 'right' }}>{o.ntn_non_residential != null ? o.ntn_non_residential.toFixed(0) : '—'}</td>
                  <td style={{ ...mono, textAlign: 'right', color: 'var(--lime)' }}>{o.ntn_total != null ? o.ntn_total.toFixed(0) : '—'}</td>
                  <td style={{ ...mono, textAlign: 'right' }}>{o.imi_residential != null ? `${(o.imi_residential * 100).toFixed(2)}%` : '—'}</td>
                  <td style={{ fontSize: 11, color: 'var(--g)' }}>{o.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modali */}
      {showAddAgency && (
        <AddAgencyModal onClose={() => setShowAddAgency(false)} onSaved={() => { setShowAddAgency(false); fetchData() }} />
      )}
      {showOmiUpload && (
        <AddOmiModal onClose={() => setShowOmiUpload(false)} onSaved={() => { setShowOmiUpload(false); fetchData() }} />
      )}
    </div>
  )
}

/** ─── Sub: aggiungi agenzia ─────────────────────────────────────────── */
function AddAgencyModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [query, setQuery] = useState('')
  const [url, setUrl] = useState('')

  const save = async () => {
    if (!name.trim()) return
    await supabase.from('competitor_agencies').insert({
      name: name.trim(), city: 'Novara',
      immobiliare_query: query.trim() || null,
      immobiliare_url: url.trim() || null,
    })
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-title">Aggiungi Agenzia</div>
        <div className="form-group">
          <label className="form-label">Nome agenzia *</label>
          <input className="form-input" value={name} onChange={e => setName(e.target.value)} autoFocus
            placeholder="Es. Tecnocasa Novara" />
        </div>
        <div className="form-group">
          <label className="form-label">Query Immobiliare.it (per ricerca)</label>
          <input className="form-input" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Es. Tecnocasa" />
        </div>
        <div className="form-group">
          <label className="form-label">URL pagina agenzia (se noto)</label>
          <input className="form-input" value={url} onChange={e => setUrl(e.target.value)}
            placeholder="https://www.immobiliare.it/agenzia/..." />
        </div>
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onClose}>Annulla</button>
          <button className="btn btn-primary" onClick={save} disabled={!name.trim()}>Aggiungi</button>
        </div>
      </div>
    </div>
  )
}

/** ─── Sub: inserisci dato OMI ───────────────────────────────────────── */
function AddOmiModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const cy = new Date().getFullYear()
  const [year, setYear] = useState(cy)
  const [quarter, setQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3))
  const [ntnRes, setNtnRes] = useState('')
  const [ntnNonRes, setNtnNonRes] = useState('')
  const [imiRes, setImiRes] = useState('')
  const [notes, setNotes] = useState('')

  const save = async () => {
    const r = parseFloat(ntnRes) || null
    const nr = parseFloat(ntnNonRes) || null
    const total = (r || 0) + (nr || 0) || null
    const imi = imiRes ? parseFloat(imiRes) / 100 : null
    await supabase.from('market_omi_quarterly').upsert({
      city: 'Novara', province_code: 'NO',
      year, quarter,
      ntn_residential: r, ntn_non_residential: nr, ntn_total: total,
      imi_residential: imi,
      source: 'manual',
      notes: notes.trim() || null,
    }, { onConflict: 'city,year,quarter' })
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-title">Inserisci Dato OMI Trimestrale</div>
        <div style={{ fontSize: 12, color: 'var(--g)', marginBottom: 12 }}>
          Dati pubblici dell'Agenzia delle Entrate (Banca Dati OMI). NTN = Numero Transazioni Normalizzate. IMI = Intensità del Mercato Immobiliare (%).
        </div>
        <div className="form-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Anno</label>
            <input className="form-input" type="number" value={year} onChange={e => setYear(parseInt(e.target.value) || cy)} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Trimestre</label>
            <select className="form-select" value={quarter} onChange={e => setQuarter(parseInt(e.target.value))}>
              <option value={1}>Q1 (gen-mar)</option>
              <option value={2}>Q2 (apr-giu)</option>
              <option value={3}>Q3 (lug-set)</option>
              <option value={4}>Q4 (ott-dic)</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">NTN Residenziali</label>
            <input className="form-input" type="number" step="0.01" value={ntnRes} onChange={e => setNtnRes(e.target.value)} placeholder="Es. 412.5" />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">NTN Non Residenziali</label>
            <input className="form-input" type="number" step="0.01" value={ntnNonRes} onChange={e => setNtnNonRes(e.target.value)} placeholder="Es. 88.1" />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">IMI Residenziale (%)</label>
          <input className="form-input" type="number" step="0.001" value={imiRes} onChange={e => setImiRes(e.target.value)} placeholder="Es. 1.85" />
        </div>
        <div className="form-group">
          <label className="form-label">Note</label>
          <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Eventuali note" />
        </div>
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onClose}>Annulla</button>
          <button className="btn btn-primary" onClick={save}>Salva</button>
        </div>
      </div>
    </div>
  )
}
