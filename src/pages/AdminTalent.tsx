import { useMemo, useState } from 'react'
import { useTalent, talentScore, TALENT_STAGES } from '../hooks/useTalent'
import type { TalentProspect, MatchStatus } from '../hooks/useTalent'

const MATCH_LABEL: Record<MatchStatus, string> = {
  confermato: 'Confermato',
  possibile: 'Da verificare',
  non_trovato: 'Non trovato',
  scartato: 'Scartato',
}
const MATCH_COLOR: Record<MatchStatus, string> = {
  confermato: 'var(--green)',
  possibile: 'var(--amber)',
  non_trovato: 'var(--g)',
  scartato: 'var(--red)',
}
const PART_LABEL: Record<string, string> = {
  digitale: 'Presenza digitale',
  esperienza: 'Esperienza',
  contendibilita: 'Contendibilità',
  fit: 'Fit Victor&Co',
}

function MatchBadge({ m }: { m: MatchStatus }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: MATCH_COLOR[m], border: `1px solid ${MATCH_COLOR[m]}`, borderRadius: 10, padding: '1px 8px' }}>
      {MATCH_LABEL[m]}
    </span>
  )
}

function Stat({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div style={{ minWidth: 90 }}>
      <div style={{ fontSize: 11, color: 'var(--g)' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy)' }}>{value}</div>
    </div>
  )
}

function Card({ p, onUpdate }: { p: TalentProspect; onUpdate: (patch: Partial<TalentProspect>) => void }) {
  const { score, coverage } = talentScore(p.score_breakdown)
  const li = p.linkedin_data || {}
  const ig = p.instagram_data || {}
  const box = { background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 8, padding: 14 } as const

  return (
    <div style={{ background: '#fff', border: '1px solid var(--bd)', borderRadius: 10, padding: 18, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--navy)' }}>{p.full_name}</div>
          <div style={{ fontSize: 13, color: 'var(--gl)', marginTop: 2 }}>
            {[p.agency, p.regime, p.activity, p.patentino === 'no' ? 'senza patentino' : null].filter(Boolean).join(' · ') || 'Agenzia n/d'}
          </div>
          {p.phone && <div style={{ fontSize: 13, marginTop: 2 }}><a href={`tel:${p.phone.replace(/\s/g, '')}`}>{p.phone}</a></div>}
          {p.data_flag && <div style={{ fontSize: 12, color: 'var(--amber)', marginTop: 4 }}>⚠ {p.data_flag}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: score === null ? 'var(--g)' : 'var(--navy)', lineHeight: 1 }}>
            {score === null ? 'n/d' : score}
          </div>
          <div style={{ fontSize: 11, color: 'var(--g)' }}>
            {score === null ? 'dati insufficienti' : `indicativo · ${coverage}/4 componenti`}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginTop: 14 }}>
        <div style={box}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <strong>LinkedIn</strong><MatchBadge m={p.linkedin_match} />
          </div>
          {p.linkedin_url ? (
            <>
              <a href={p.linkedin_url} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>Apri profilo</a>
              {li.headline && <div style={{ fontSize: 13, marginTop: 6 }}>{li.headline}</div>}
              <div style={{ display: 'flex', gap: 12, margin: '8px 0', flexWrap: 'wrap' }}>
                <Stat label="Follower" value={li.followers} />
                <Stat label="Contatti" value={li.connections} />
                <Stat label="Sede" value={li.location} />
              </div>
              {li.current && <div style={{ fontSize: 13 }}><strong>Ruolo:</strong> {li.current}</div>}
              {li.about && <div style={{ fontSize: 12, color: 'var(--gl)', marginTop: 6 }}>{li.about}</div>}
              {Array.isArray(li.experience) && li.experience.length > 0 && (
                <ul style={{ margin: '8px 0 0 16px', padding: 0, fontSize: 12 }}>
                  {li.experience.map((e: string) => <li key={e}>{e}</li>)}
                </ul>
              )}
              {Array.isArray(li.skills) && li.skills.length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--g)', marginTop: 6 }}>Competenze: {li.skills.join(', ')}</div>
              )}
              {li.warning && <div style={{ fontSize: 12, color: 'var(--amber)', marginTop: 6 }}>{li.warning}</div>}
              {p.linkedin_match === 'possibile' && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button className="btn" onClick={() => onUpdate({ linkedin_match: 'confermato' })}>Conferma</button>
                  <button className="btn" onClick={() => onUpdate({ linkedin_match: 'scartato' })}>Scarta</button>
                </div>
              )}
            </>
          ) : <div style={{ fontSize: 13, color: 'var(--g)' }}>Nessun profilo riconducibile con certezza.</div>}
        </div>

        <div style={box}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <strong>Instagram</strong><MatchBadge m={p.instagram_match} />
          </div>
          {p.instagram_handle ? (
            <>
              <a href={ig.url || `https://www.instagram.com/${p.instagram_handle}`} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>@{p.instagram_handle}</a>
              {ig.bio && <div style={{ fontSize: 13, marginTop: 6 }}>{ig.bio}</div>}
              <div style={{ display: 'flex', gap: 12, margin: '8px 0', flexWrap: 'wrap' }}>
                <Stat label="Follower" value={ig.followers} />
                <Stat label="Seguiti" value={ig.following} />
                <Stat label="Post" value={ig.posts} />
              </div>
              {ig.category && <div style={{ fontSize: 12, color: 'var(--g)' }}>Categoria: {ig.category}</div>}
              {ig.warning && <div style={{ fontSize: 12, color: 'var(--amber)', marginTop: 6 }}>{ig.warning}</div>}
              {p.instagram_match === 'possibile' && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button className="btn" onClick={() => onUpdate({ instagram_match: 'confermato' })}>Conferma</button>
                  <button className="btn" onClick={() => onUpdate({ instagram_match: 'scartato' })}>Scarta</button>
                </div>
              )}
            </>
          ) : <div style={{ fontSize: 13, color: 'var(--g)' }}>Nessun account riconducibile con certezza.</div>}
        </div>

        <div style={box}>
          <strong>Perché è interessante</strong>
          <div style={{ marginTop: 8 }}>
            {Object.entries(p.score_breakdown).map(([k, part]) => part && (
              <div key={k} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span>{PART_LABEL[k] || k}</span>
                  <span style={{ color: 'var(--g)' }}>{part.v === null ? 'n/d' : `${part.v}/${part.max}`}</span>
                </div>
                <div style={{ height: 5, background: 'var(--s3)', borderRadius: 3 }}>
                  <div style={{ width: `${part.v === null ? 0 : (part.v / part.max) * 100}%`, height: '100%', background: 'var(--teal)', borderRadius: 3 }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--g)', marginTop: 2 }}>{part.note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {p.approach_angle && (
        <div style={{ ...box, marginTop: 12, borderLeft: '3px solid var(--navy)' }}>
          <strong>Angolo di approccio</strong>
          <div style={{ fontSize: 13, marginTop: 4 }}>{p.approach_angle}</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
        <select value={p.stage} onChange={e => onUpdate({ stage: e.target.value as TalentProspect['stage'], contacted_at: p.contacted_at ?? (e.target.value !== 'da_contattare' ? new Date().toISOString() : null) })}>
          {TALENT_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select value={p.owner || ''} onChange={e => onUpdate({ owner: e.target.value || null })}>
          <option value="">Chi lo segue</option>
          <option value="Marco">Marco</option>
          <option value="Victor">Victor</option>
        </select>
        <input
          style={{ flex: 1, minWidth: 220 }}
          placeholder="Note"
          defaultValue={p.notes || ''}
          onBlur={e => { if ((e.target.value || null) !== p.notes) onUpdate({ notes: e.target.value || null }) }}
        />
      </div>
      {p.enriched_at && <div style={{ fontSize: 11, color: 'var(--g)', marginTop: 8 }}>Dati pubblici raccolti con Apify il {new Date(p.enriched_at).toLocaleDateString('it-IT')}</div>}
    </div>
  )
}

export default function AdminTalent() {
  const { prospects, loading, update } = useTalent()
  const [stage, setStage] = useState('')
  const [onlyEnriched, setOnlyEnriched] = useState(false)

  const sorted = useMemo(() => {
    return prospects
      .filter(p => (!stage || p.stage === stage))
      .filter(p => !onlyEnriched || p.linkedin_match === 'confermato' || p.instagram_match === 'confermato')
      .sort((a, b) => (talentScore(b.score_breakdown).score ?? -1) - (talentScore(a.score_breakdown).score ?? -1) || a.position - b.position)
  }, [prospects, stage, onlyEnriched])

  const counts = TALENT_STAGES.map(s => ({ ...s, n: prospects.filter(p => p.stage === s.id).length }))
  const enriched = prospects.filter(p => p.linkedin_match === 'confermato' || p.instagram_match === 'confermato').length

  if (loading) return <div>Caricamento…</div>

  return (
    <div>
      <div className="section-heading">// Talent</div>
      <p style={{ fontSize: 13, color: 'var(--gl)', maxWidth: 760 }}>
        Agenti esterni da attrarre in Victor&Co, arricchiti con dati pubblici professionali di LinkedIn e Instagram.
        Il punteggio è indicativo e conta solo le componenti con un dato disponibile.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '12px 0' }}>
        <button className="btn" onClick={() => setStage('')} style={{ fontWeight: stage === '' ? 700 : 400 }}>Tutti ({prospects.length})</button>
        {counts.map(c => (
          <button key={c.id} className="btn" onClick={() => setStage(c.id)} style={{ fontWeight: stage === c.id ? 700 : 400 }}>{c.label} ({c.n})</button>
        ))}
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={onlyEnriched} onChange={e => setOnlyEnriched(e.target.checked)} />
          Solo con profili confermati ({enriched})
        </label>
      </div>
      {sorted.map(p => <Card key={p.id} p={p} onUpdate={patch => update(p.id, patch)} />)}
      {sorted.length === 0 && <div style={{ color: 'var(--g)' }}>Nessun agente in questo stato.</div>}
    </div>
  )
}
