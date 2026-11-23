import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import KpiCard from '../components/KpiCard'

type Property = {
  property_key: string
  comune: string
  title: string | null
  ptype: string | null
  rooms: number | null
  surface: number | null
  bathrooms: number | null
  floor: string | null
  zone: string | null
  address: string | null
  agency: string | null
  is_private: boolean | null
  thumb: string | null
  description: string | null
  condition: string | null
  energy: string | null
  price: number | null
  price_max: number | null
  old_price: number | null
  portals: string[]
  portal_urls: Record<string, string>
  n_portals: number | null
  est_listed_date: string | null
  certain_since: string | null
  first_seen: string
  last_seen: string
  active: boolean
  price_changes: number
  last_price_change: string | null
  status: string
  owner: string | null
  notes: string | null
}

type Run = { run_date: string; portal: string | null; listings_count: number | null; new_count: number | null; removed_count: number | null; price_changes: number | null }

const STATUSES = [
  { id: 'da_valutare', label: 'Da valutare' },
  { id: 'da_contattare', label: 'Da contattare' },
  { id: 'contattato', label: 'Contattato' },
  { id: 'appuntamento', label: 'Appuntamento' },
  { id: 'incarico', label: 'Incarico preso' },
  { id: 'non_interessante', label: 'Non interessante' },
]

const PORTAL_LABEL: Record<string, string> = { immobiliare: 'Immobiliare.it', idealista: 'Idealista', casa: 'Casa.it', subito: 'Subito' }

function daysSince(d: string | null): number | null {
  if (!d) return null
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
}
function fmtDays(n: number | null): string {
  if (n == null) return 'n.d.'
  if (n < 45) return `${n} gg`
  if (n < 365) return `${Math.round(n / 30)} mesi`
  const y = n / 365
  return y >= 3 ? 'oltre 3 anni' : `${y.toFixed(1).replace('.0', '')} anni`
}
function eur(n: number | null): string {
  return n == null ? 'Prezzo su richiesta' : '€ ' + n.toLocaleString('it-IT')
}
function ageColor(n: number | null): string {
  if (n == null) return 'var(--g)'
  if (n > 365) return 'var(--red)'
  if (n > 180) return 'var(--amber)'
  return 'var(--green)'
}

export default function MarketMonitor() {
  const [props, setProps] = useState<Property[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [bucket, setBucket] = useState<'all' | 'gt365' | '180_365' | 'lt180' | 'drops' | 'private' | 'multi'>('all')
  const [status, setStatus] = useState('')
  const [agency, setAgency] = useState('')
  const [ptype, setPtype] = useState('')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<'age' | 'price_asc' | 'price_desc' | 'surface'>('age')

  useEffect(() => {
    (async () => {
      const [p, r] = await Promise.all([
        supabase.from('market_properties').select('*').eq('active', true).order('est_listed_date', { ascending: true, nullsFirst: false }),
        supabase.from('market_runs').select('run_date, portal, listings_count, new_count, removed_count, price_changes').order('run_date', { ascending: false }).limit(20),
      ])
      setProps((p.data || []) as Property[])
      setRuns((r.data || []) as Run[])
      setLoading(false)
    })()
  }, [])

  async function update(key: string, patch: Partial<Property>) {
    setProps(ps => ps.map(p => p.property_key === key ? { ...p, ...patch } : p))
    await supabase.from('market_properties').update({ ...patch, status_updated_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('property_key', key)
  }

  const agencies = useMemo(() => Array.from(new Set(props.map(p => p.agency || 'n.d.'))).sort((a, b) => a.localeCompare(b)), [props])
  const ptypes = useMemo(() => Array.from(new Set(props.map(p => p.ptype || 'n.d.'))).sort((a, b) => a.localeCompare(b)), [props])

  const kpi = useMemo(() => {
    const age = (p: Property) => daysSince(p.est_listed_date)
    return {
      total: props.length,
      gt365: props.filter(p => (age(p) ?? 0) > 365).length,
      mid: props.filter(p => { const a = age(p); return a != null && a > 180 && a <= 365 }).length,
      drops: props.filter(p => p.old_price != null || p.price_changes > 0).length,
      priv: props.filter(p => p.is_private).length,
      multi: props.filter(p => (p.n_portals || 1) > 1).length,
      listings: runs.filter(r => r.run_date === runs[0]?.run_date).reduce((s, r) => s + (r.listings_count || 0), 0),
    }
  }, [props, runs])

  const filtered = useMemo(() => {
    let list = props.filter(p => {
      const a = daysSince(p.est_listed_date)
      if (bucket === 'gt365' && !(a != null && a > 365)) return false
      if (bucket === '180_365' && !(a != null && a > 180 && a <= 365)) return false
      if (bucket === 'lt180' && !(a != null && a <= 180)) return false
      if (bucket === 'drops' && !(p.old_price != null || p.price_changes > 0)) return false
      if (bucket === 'private' && !p.is_private) return false
      if (bucket === 'multi' && !((p.n_portals || 1) > 1)) return false
      if (status && p.status !== status) return false
      if (agency && (p.agency || 'n.d.') !== agency) return false
      if (ptype && (p.ptype || 'n.d.') !== ptype) return false
      if (q) {
        const s = `${p.title} ${p.address} ${p.zone} ${p.agency} ${p.description} ${p.notes}`.toLowerCase()
        if (!s.includes(q.toLowerCase())) return false
      }
      return true
    })
    const age = (p: Property) => daysSince(p.est_listed_date) ?? -1
    if (sort === 'age') list = list.sort((a, b) => age(b) - age(a))
    if (sort === 'price_asc') list = list.sort((a, b) => (a.price ?? 1e12) - (b.price ?? 1e12))
    if (sort === 'price_desc') list = list.sort((a, b) => (b.price ?? -1) - (a.price ?? -1))
    if (sort === 'surface') list = list.sort((a, b) => (b.surface ?? 0) - (a.surface ?? 0))
    return list
  }, [props, bucket, status, agency, ptype, q, sort])

  const lastRun = runs[0]?.run_date
  const box: React.CSSProperties = { background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 8, padding: '10px 12px' }

  if (loading) return <div>Caricamento…</div>

  return (
    <div>
      <div className="section-heading">// Monitor annunci Oleggio</div>
      <p style={{ fontSize: 13, color: 'var(--gl)', maxWidth: 820 }}>
        Tutte le case in vendita a Oleggio su Immobiliare.it, Idealista, Casa.it e Subito, raggruppate per immobile (lo stesso immobile pubblicato su più portali conta una volta).
        L'anzianità è stimata dalla numerazione degli annunci, calibrata su istantanee storiche dei portali: quando c'è il dato certo («online almeno dal…») viene mostrato.
        Da oggi ogni rilevazione settimanale registra nuovi inserimenti, ritiri e variazioni di prezzo.
        {lastRun && <> Ultima rilevazione: {new Date(lastRun).toLocaleDateString('it-IT')} ({kpi.listings} annunci letti).</>}
      </p>

      <div className="kpi-grid">
        <KpiCard value={String(kpi.total)} label="Immobili in vendita" onClick={() => setBucket('all')} />
        <KpiCard value={String(kpi.gt365)} label="Online da oltre 1 anno" color="red" onClick={() => setBucket('gt365')} />
        <KpiCard value={String(kpi.mid)} label="Online da 6-12 mesi" color="amber" onClick={() => setBucket('180_365')} />
        <KpiCard value={String(kpi.drops)} label="Con ribasso di prezzo" color="teal" onClick={() => setBucket('drops')} />
        <KpiCard value={String(kpi.priv)} label="Venduti da privati" color="green" onClick={() => setBucket('private')} />
        <KpiCard value={String(kpi.multi)} label="Su più portali" onClick={() => setBucket('multi')} />
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '12px 0', alignItems: 'center' }}>
        <select className="filter-select" value={bucket} onChange={e => setBucket(e.target.value as typeof bucket)}>
          <option value="all">Tutti gli immobili</option>
          <option value="gt365">Online da oltre 1 anno</option>
          <option value="180_365">Online da 6-12 mesi</option>
          <option value="lt180">Online da meno di 6 mesi</option>
          <option value="drops">Con ribasso di prezzo</option>
          <option value="private">Venduti da privati</option>
          <option value="multi">Su più portali</option>
        </select>
        <select className="filter-select" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Ogni stato</option>
          {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select className="filter-select" value={agency} onChange={e => setAgency(e.target.value)}>
          <option value="">Ogni agenzia</option>
          {agencies.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="filter-select" value={ptype} onChange={e => setPtype(e.target.value)}>
          <option value="">Ogni tipologia</option>
          {ptypes.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="filter-select" value={sort} onChange={e => setSort(e.target.value as typeof sort)}>
          <option value="age">Prima i più vecchi</option>
          <option value="price_asc">Prezzo crescente</option>
          <option value="price_desc">Prezzo decrescente</option>
          <option value="surface">Superficie</option>
        </select>
        <input className="filter-select" style={{ minWidth: 220 }} placeholder="Cerca via, zona, agenzia, note…" value={q} onChange={e => setQ(e.target.value)} />
        <span style={{ fontSize: 12, color: 'var(--g)' }}>{filtered.length} immobili</span>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {filtered.map(p => {
          const age = daysSince(p.est_listed_date)
          const certain = daysSince(p.certain_since)
          const pm2 = p.price && p.surface ? Math.round(p.price / p.surface) : null
          const drop = p.old_price && p.price ? Math.round((1 - p.price / p.old_price) * 100) : null
          return (
            <div key={p.property_key} className="card-2col" style={{ ...box, display: 'grid', gridTemplateColumns: '140px 1fr', gap: 14 }}>
              <div>
                <div style={{ width: 140, height: 105, borderRadius: 6, overflow: 'hidden', background: 'var(--s2)', flex: '0 0 auto' }}>
                  {p.thumb && <img src={p.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                </div>
                <div>
                  <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: ageColor(age) }}>
                    {age != null ? `online da ~${fmtDays(age)}` : 'anzianità n.d.'}
                  </div>
                  {certain != null && <div style={{ fontSize: 11, color: 'var(--g)' }}>certo: almeno {fmtDays(certain)} (dal {new Date(p.certain_since!).toLocaleDateString('it-IT')})</div>}
                  {p.price_changes > 0 && <div style={{ fontSize: 11, color: 'var(--teal)' }}>{p.price_changes} variazion{p.price_changes === 1 ? 'e' : 'i'} di prezzo</div>}
                </div>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{p.title}</div>
                  <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}>
                    {eur(p.price)}{p.price_max && p.price && p.price_max !== p.price ? ` – ${eur(p.price_max)}` : ''}
                    {drop != null && drop > 0 && <span style={{ marginLeft: 8, fontSize: 11, color: '#fff', background: 'var(--teal)', borderRadius: 4, padding: '1px 6px' }}>−{drop}% (era {eur(p.old_price)})</span>}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--gl)', marginTop: 2 }}>
                  {[p.ptype, p.rooms ? `${p.rooms} locali` : null, p.surface ? `${p.surface} m²` : null, pm2 ? `${pm2.toLocaleString('it-IT')} €/m²` : null, p.bathrooms ? `${p.bathrooms} bagn${p.bathrooms === 1 ? 'o' : 'i'}` : null, p.floor, p.condition, p.energy ? `classe ${p.energy}` : null].filter(Boolean).join(' · ')}
                </div>
                <div style={{ fontSize: 12, marginTop: 2 }}>
                  <span style={{ color: p.is_private ? 'var(--green)' : 'var(--w)', fontWeight: p.is_private ? 700 : 500 }}>{p.is_private ? 'Privato' : p.agency || 'Agenzia n.d.'}</span>
                  {p.zone ? ` · ${p.zone}` : ''}{p.address ? ` · ${p.address}` : ''}
                </div>
                {p.description && <div style={{ fontSize: 12, color: 'var(--g)', marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.description}</div>}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6, fontSize: 12 }}>
                  {Object.entries(p.portal_urls || {}).map(([k, u]) => (
                    <a key={k} href={u} target="_blank" rel="noreferrer" style={{ padding: '2px 8px', border: '1px solid var(--bd)', borderRadius: 4, textDecoration: 'none' }}>{PORTAL_LABEL[k] || k} ↗</a>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
                  <select className="filter-select" value={p.status} onChange={e => update(p.property_key, { status: e.target.value })}>
                    {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                  <select className="filter-select" value={p.owner || ''} onChange={e => update(p.property_key, { owner: e.target.value || null })}>
                    <option value="">Chi lo segue</option>
                    <option value="Federico">Federico</option>
                    <option value="Victor">Victor</option>
                    <option value="Marco">Marco</option>
                  </select>
                  <input className="filter-select" style={{ flex: 1, minWidth: 200 }} placeholder="Note (proprietario, contatti presi, esito…)" defaultValue={p.notes || ''}
                    onBlur={e => { if ((e.target.value || null) !== p.notes) update(p.property_key, { notes: e.target.value || null }) }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: 11, color: 'var(--g)', marginTop: 14 }}>
        Fonte: annunci pubblici dei portali letti con Firecrawl. L'anzianità stimata ha un margine di circa ±1 mese; i prezzi "era" vengono dai portali (Idealista) o dalle rilevazioni successive. Nessun dato personale dei proprietari è raccolto qui: le note sono vostre.
      </div>
    </div>
  )
}
