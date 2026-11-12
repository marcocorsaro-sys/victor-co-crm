import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

/* ───────────────────────── definizione questionario ───────────────────────── */

type Opt = { v: string; l: string }
type Q =
  | { id: string; t: 'num'; label: string; hint?: string; unit?: string }
  | { id: string; t: 'text'; label: string; hint?: string }
  | { id: string; t: 'long'; label: string; hint?: string }
  | { id: string; t: 'one'; label: string; hint?: string; opts: Opt[] }

type Section = { id: string; title: string; questions: Q[] }

const o = (...items: string[]): Opt[] => items.map(s => ({ v: s, l: s }))

const RISK_OPTS: Opt[] = [
  { v: 'nulla', l: 'Non succede niente' },
  { v: 'ritardi', l: 'Si accumulano ritardi, ma si recupera' },
  { v: 'problemi', l: 'Problemi seri con clienti, agenti o commercialista' },
  { v: 'danno', l: 'Danno economico o sanzioni' },
]
const risk = (id: string, what: string): Q => ({ id, t: 'one', label: `${what}: se per una settimana nessuno lo facesse, cosa succede?`, opts: RISK_OPTS })

const SECTIONS: Section[] = [
  {
    id: 'peso', title: 'Quanto pesa oggi',
    questions: [
      { id: 'n_reg', t: 'num', label: 'Preliminari e locazioni da registrare in un mese normale', unit: 'al mese' },
      { id: 'n_pag', t: 'num', label: 'Pagamenti che disponi in un mese normale', unit: 'al mese' },
      { id: 'n_prof', t: 'num', label: 'Proforma emesse in un mese normale', unit: 'al mese' },
      { id: 'n_ritardo', t: 'one', label: 'Quante proforma vengono pagate oltre i 7 giorni?', opts: o('Quasi nessuna', 'Circa un quarto', 'Circa la metà', 'Quasi tutte') },
      { id: 'n_portali', t: 'num', label: 'Richieste dai portali a settimana', unit: 'a settimana' },
      { id: 'n_ore', t: 'num', label: 'Ore a settimana che dedichi tu oggi all’amministrazione', unit: 'ore/sett' },
    ],
  },
  {
    id: 'risk', title: 'Se nessuno lo fa per una settimana',
    questions: [
      risk('r_reg', 'Registrazioni all’Agenzia delle Entrate'),
      risk('r_pag', 'Pagamenti'),
      risk('r_doc', 'Controllo documenti e antiriciclaggio'),
      risk('r_comm', 'Rapporti con il commercialista'),
      risk('r_portali', 'Richieste dai portali agli agenti'),
      risk('r_proforma', 'Proforma, fatture e solleciti'),
    ],
  },
  {
    id: 'regole', title: 'Le tue regole',
    questions: [
      { id: 'g_soglia', t: 'num', label: 'Sopra quale importo approvi tu ogni pagamento?', hint: 'Sotto questa soglia può procedere l’impiegata.', unit: '€' },
      { id: 'g_open', t: 'one', label: 'Colleghiamo il conto al CRM in sola lettura, per vedere i movimenti senza poter pagare?', opts: o('Sì', 'No', 'Da valutare con il commercialista') },
      { id: 'g_aml', t: 'text', label: 'Chi è il responsabile antiriciclaggio dell’agenzia?' },
      { id: 'g_firma', t: 'one', label: 'Come far firmare i moduli antiriciclaggio?', opts: o('Firma digitale via link', 'Firma con codice SMS', 'Con SPID', 'Cartacea come oggi', 'Non so, consigliami') },
      { id: 'g_moroso', t: 'one', label: 'Chi telefona al cliente che non paga dopo i solleciti?', opts: o('Io', 'L’agente', 'L’impiegata', 'Nessuno') },
      { id: 'g_iva', t: 'one', label: 'Le provvigioni sono soggette a IVA al 22%?', opts: o('Sì', 'No', 'Dipende dal caso') },
    ],
  },
  {
    id: 'persona', title: 'La persona che assumi',
    questions: [
      { id: 'p_impegno', t: 'one', label: 'Impegno che hai in mente', opts: o('Part-time mattina', 'Part-time pomeriggio', 'Tempo pieno', 'Non lo so ancora') },
      { id: 'p_mai', t: 'long', label: 'Cosa non deve mai fare senza il tuo ok?' },
      { id: 'p_ruba', t: 'long', label: 'Cosa oggi ti ruba più tempo o ti dà più fastidio?' },
    ],
  },
]

type Answers = Record<string, string | string[]>
type Loaded = { title: string; recipient: string | null; answers: Answers; status: 'aperto' | 'inviato'; submitted_at: string | null }

type Step = { q: Q; section: string }

const CSS = `
.qa{min-height:100dvh;background:#0d3447;color:#fff;font-family:'Montserrat',system-ui,sans-serif;display:flex;flex-direction:column}
.qa-top{padding:14px 18px 0}
.qa-prog{height:5px;background:rgba(255,255,255,.18);border-radius:4px;overflow:hidden}
.qa-prog>i{display:block;height:100%;background:#7bd3a8;transition:width .3s}
.qa-meta{display:flex;justify-content:space-between;font-size:12px;opacity:.75;margin-top:8px}
.qa-main{flex:1;display:flex;flex-direction:column;justify-content:center;max-width:640px;width:100%;margin:0 auto;padding:18px 20px 110px}
.qa-chip{font-size:11px;letter-spacing:.06em;text-transform:uppercase;opacity:.65;margin-bottom:10px}
.qa-q{font-size:24px;line-height:1.3;font-weight:700;margin-bottom:8px}
.qa-h{font-size:13px;opacity:.7;margin-bottom:16px;line-height:1.45}
.qa-in{width:100%;font:inherit;font-size:20px;padding:14px 14px;border:2px solid rgba(255,255,255,.3);border-radius:12px;background:rgba(255,255,255,.08);color:#fff;margin-top:14px}
.qa-in::placeholder{color:rgba(255,255,255,.4)}
.qa-in:focus{outline:none;border-color:#7bd3a8}
textarea.qa-in{font-size:17px;min-height:130px;resize:vertical}
.qa-row{display:flex;gap:10px;align-items:center}
.qa-unit{font-size:14px;opacity:.75;white-space:nowrap;margin-top:14px}
.qa-opts{display:flex;flex-direction:column;gap:10px;margin-top:16px}
.qa-opt{padding:15px 16px;border:2px solid rgba(255,255,255,.25);border-radius:12px;font:inherit;font-size:16px;text-align:left;background:rgba(255,255,255,.06);color:#fff;cursor:pointer;line-height:1.35}
.qa-opt.on{border-color:#7bd3a8;background:rgba(123,211,168,.18);font-weight:700}
.qa-nav{position:fixed;left:0;right:0;bottom:0;background:#0a2a39;border-top:1px solid rgba(255,255,255,.12);padding:12px 18px calc(12px + env(safe-area-inset-bottom))}
.qa-nav-in{max-width:640px;margin:0 auto;display:flex;gap:10px}
.qa-b{flex:1;padding:15px;border-radius:12px;border:2px solid rgba(255,255,255,.3);background:transparent;color:#fff;font:inherit;font-size:16px;font-weight:700;cursor:pointer}
.qa-b.pri{background:#7bd3a8;border-color:#7bd3a8;color:#0d3447;flex:2}
.qa-b.skip{background:transparent;opacity:.85}
.qa-b:disabled{opacity:.35}
.qa-big{font-size:42px;line-height:1.1;font-weight:800;margin-bottom:18px}
.qa-big em{font-style:normal;color:#7bd3a8}
.qa-lead{font-size:18px;line-height:1.5;opacity:.92;margin-bottom:10px}
.qa-start{margin-top:26px;padding:18px;border-radius:14px;border:0;background:#7bd3a8;color:#0d3447;font:inherit;font-size:18px;font-weight:800;cursor:pointer;width:100%}
.qa-link{margin-top:14px;background:none;border:0;color:#fff;opacity:.8;font:inherit;font-size:14px;text-decoration:underline;cursor:pointer;text-align:center;width:100%}
.qa-save{font-size:12px;opacity:.6;margin-top:18px}
.qa-err{color:#ffb4a8;font-size:13px;margin-top:10px}
@media(max-width:420px){.qa-big{font-size:34px}.qa-q{font-size:21px}}
`

function hasValue(v: string | string[] | undefined) {
  return Array.isArray(v) ? v.length > 0 : !!(v && v.trim())
}

export default function QuestionarioAmministrazione({ token }: { token: string }) {
  const [data, setData] = useState<Loaded | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'notfound'>('loading')
  const [answers, setAnswers] = useState<Answers>({})
  const [pos, setPos] = useState(-1) // -1 intro, 0..n-1 domande, n fine
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const ref = useRef<Answers>({})
  const timer = useRef<number | null>(null)
  const dirty = useRef(false)

  useEffect(() => {
    let alive = true
    supabase.rpc('adm_q_get', { p_token: token }).then(({ data: d, error }) => {
      if (!alive) return
      if (error || !d) { setState('notfound'); return }
      const l = d as Loaded
      setData(l)
      setAnswers(l.answers || {})
      ref.current = l.answers || {}
      setDone(l.status === 'inviato')
      setState('ok')
    })
    return () => { alive = false }
  }, [token])

  const persist = useCallback(async (submit = false) => {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null }
    const { error } = await supabase.rpc('adm_q_save', { p_token: token, p_answers: ref.current, p_submit: submit })
    if (error) { setErr('Non sono riuscito a salvare. Controlla la connessione.'); return false }
    setErr(null); dirty.current = false
    setSavedAt(new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }))
    return true
  }, [token])

  const schedule = useCallback(() => {
    dirty.current = true
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => { void persist() }, 500)
  }, [persist])

  const set = (id: string, v: string | string[]) => {
    const next = { ...ref.current, [id]: v }
    ref.current = next
    setAnswers(next)
    schedule()
  }

  const steps: Step[] = useMemo(() => {
    if (!data) return []
    return SECTIONS.flatMap(sec => sec.questions.map(q => ({ q, section: sec.title })))
  }, [data])

  const n = steps.length
  const minutes = Math.max(3, Math.round((n * 10) / 60))

  const goto = (p: number) => {
    const clamped = Math.max(-1, Math.min(n, p))
    ref.current = { ...ref.current, _pos: String(clamped) }
    setPos(clamped)
    if (dirty.current || clamped >= 0) void persist()
    window.scrollTo({ top: 0 })
  }

  const answeredCount = steps.filter(st => hasValue(answers[st.q.id])).length

  const submit = async () => {
    setSending(true)
    const ok = await persist(true)
    setSending(false)
    if (ok) { setDone(true); window.scrollTo({ top: 0 }) }
  }

  if (state === 'loading') return <div className="qa"><style>{CSS}</style><div className="qa-main" style={{ textAlign: 'center', opacity: .7 }}>Carico…</div></div>
  if (state === 'notfound' || !data) return <div className="qa"><style>{CSS}</style><div className="qa-main" style={{ textAlign: 'center' }}>Questo link non è valido. Chiedi a Marco di mandartene uno nuovo.</div></div>

  const first = (data.recipient || '').split(' ')[0]
  const hasProgress = answeredCount > 0
  const savedPos = parseInt((answers._pos as string) || '-1', 10)

  /* ── intro ── */
  if (pos === -1 && !done) {
    return (
      <div className="qa"><style>{CSS}</style>
        <div className="qa-main">
          <div className="qa-chip">Victor&Co Real Estate</div>
          <div className="qa-big">Marco ti ruba <em>{minutes} minuti.</em></div>
          <div className="qa-lead">{first ? `${first}, ` : ''}una domanda alla volta. Salta tutto quello che non sai o ritieni irrilevante e stima il resto: non serve esattezza.</div>
          <div className="qa-lead" style={{ fontSize: 15, opacity: .75 }}>Ogni risposta si salva da sola. Anche se ne dai solo tre, a Marco arrivano.</div>
          {hasProgress && savedPos >= 0 ? (
            <>
              <button className="qa-start" onClick={() => goto(Math.min(savedPos, n))}>Riprendi da dove eri ({answeredCount} di {n})</button>
              <button className="qa-link" onClick={() => goto(0)}>Ricomincia dall’inizio</button>
            </>
          ) : (
            <button className="qa-start" onClick={() => goto(0)}>Cominciamo</button>
          )}
        </div>
      </div>
    )
  }

  /* ── grazie ── */
  if (done) {
    return (
      <div className="qa"><style>{CSS}</style>
        <div className="qa-main">
          <div className="qa-big">Fatto, <em>grazie{first ? ` ${first}` : ''}.</em></div>
          <div className="qa-lead">Marco guarda le risposte e torna da te con una proposta concreta: cosa automatizzare e dove serve una persona.</div>
          <button className="qa-link" style={{ textAlign: 'left' }} onClick={() => { setDone(false); goto(0) }}>Voglio rivedere o aggiungere qualcosa</button>
        </div>
      </div>
    )
  }

  /* ── fine ── */
  if (pos >= n) {
    const skipped = n - answeredCount
    return (
      <div className="qa"><style>{CSS}</style>
        <div className="qa-top"><div className="qa-prog"><i style={{ width: '100%' }} /></div></div>
        <div className="qa-main">
          <div className="qa-big">Finito.</div>
          <div className="qa-lead">Hai risposto a <b>{answeredCount}</b> domande{skipped > 0 ? ` e ne hai saltate ${skipped}` : ''}. Va benissimo così.</div>
          <button className="qa-start" disabled={sending} onClick={submit}>{sending ? 'Invio…' : 'Invia a Marco'}</button>
          <button className="qa-link" onClick={() => goto(n - 1)}>Torna indietro a rivedere</button>
          {err && <div className="qa-err">{err}</div>}
        </div>
      </div>
    )
  }

  /* ── domanda ── */
  const st = steps[pos]
  const next = () => goto(pos + 1)
  const back = () => goto(pos - 1)
  const q = st.q
  const answered = hasValue(answers[q.id])
  const onEnter = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); next() } }
  const pick = (id: string, v: string) => { set(id, v); window.setTimeout(() => goto(pos + 1), 220) }

  return (
    <div className="qa" onKeyDown={onEnter}><style>{CSS}</style>
      <div className="qa-top">
        <div className="qa-prog"><i style={{ width: `${Math.round(((pos + 1) / n) * 100)}%` }} /></div>
        <div className="qa-meta"><span>{pos + 1} di {n}</span><span>{err ? 'Non salvato' : savedAt ? `Salvato ${savedAt}` : ''}</span></div>
      </div>

      <div className="qa-main" key={q.id}>
        <div className="qa-chip">{st.section}</div>
        <div className="qa-q">{q.label}</div>
        {q.hint && <div className="qa-h">{q.hint}</div>}
        {q.t === 'num' && (
          <div className="qa-row">
            <input className="qa-in" autoFocus inputMode="decimal" placeholder="una stima va bene" value={(answers[q.id] as string) || ''} onChange={e => set(q.id, e.target.value)} />
            {q.unit && <span className="qa-unit">{q.unit}</span>}
          </div>
        )}
        {q.t === 'text' && <input className="qa-in" autoFocus value={(answers[q.id] as string) || ''} onChange={e => set(q.id, e.target.value)} />}
        {q.t === 'long' && <textarea className="qa-in" autoFocus value={(answers[q.id] as string) || ''} onChange={e => set(q.id, e.target.value)} />}
        {q.t === 'one' && (
          <div className="qa-opts">
            {q.opts.map(op => (
              <button key={op.v} className={'qa-opt' + (answers[q.id] === op.v ? ' on' : '')} onClick={() => pick(q.id, op.v)}>{op.l}</button>
            ))}
          </div>
        )}
        {err && <div className="qa-err">{err}</div>}
      </div>

      <div className="qa-nav"><div className="qa-nav-in">
        <button className="qa-b" onClick={back} disabled={pos === 0}>Indietro</button>
        <button className={'qa-b ' + (answered ? 'pri' : 'skip')} onClick={next}>{answered ? 'Avanti' : 'Salta'}</button>
      </div></div>
    </div>
  )
}
