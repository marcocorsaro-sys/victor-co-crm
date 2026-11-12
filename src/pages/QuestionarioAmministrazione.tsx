import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

/* ───────────────────────── definizione questionario ───────────────────────── */

type Opt = { v: string; l: string }
type Q =
  | { id: string; t: 'num'; label: string; hint?: string; unit?: string }
  | { id: string; t: 'text'; label: string; hint?: string }
  | { id: string; t: 'long'; label: string; hint?: string }
  | { id: string; t: 'one'; label: string; hint?: string; opts: Opt[] }
  | { id: string; t: 'multi'; label: string; hint?: string; opts: Opt[] }
  | { id: string; t: 'risk'; label: string }

type Section = { id: string; title: string; intro?: string; questions: Q[]; crm?: boolean }

const o = (...items: string[]): Opt[] => items.map(s => ({ v: s, l: s }))

const RISK_OPTS: Opt[] = [
  { v: 'nulla', l: 'Non succede niente' },
  { v: 'ritardi', l: 'Si accumulano ritardi, ma si recupera' },
  { v: 'problemi', l: 'Problemi seri (clienti, agenti, commercialista)' },
  { v: 'danno', l: 'Danno economico o sanzioni' },
]

const SECTIONS: Section[] = [
  {
    id: 'a1', title: '1. registrazioni all’agenzia delle entrate',
    intro: 'Preliminari e contratti di locazione da registrare sul portale.',
    questions: [
      { id: 'a1_prelim', t: 'num', label: 'Preliminari da registrare in un mese normale', unit: 'al mese' },
      { id: 'a1_loc', t: 'num', label: 'Contratti di locazione da registrare in un mese normale', unit: 'al mese' },
      { id: 'a1_chi', t: 'one', label: 'Chi li registra oggi?', opts: o('Io', 'Un agente', 'Il notaio', 'Il commercialista', 'Altro') },
      { id: 'a1_ritardi', t: 'one', label: 'Ti è mai successo di registrare fuori termine?', opts: o('Mai', 'Qualche volta', 'Spesso') },
      { id: 'a1_ore', t: 'num', label: 'Quante ore a settimana ci va?', unit: 'ore/sett' },
      { id: 'a1_risk', t: 'risk', label: 'Se per una settimana nessuno lo facesse, cosa succede?' },
    ],
  },
  {
    id: 'a2', title: '2. pagamenti',
    intro: 'Tutto quello che l’agenzia paga: fornitori, portali, collaboratori, imposte.',
    questions: [
      { id: 'a2_num', t: 'num', label: 'Quanti pagamenti in un mese normale', unit: 'al mese' },
      { id: 'a2_ricorrenti', t: 'num', label: 'Di questi, quanti sono sempre uguali (abbonamenti, affitti, utenze)', unit: 'al mese' },
      { id: 'a2_tot', t: 'num', label: 'Importo totale pagato in un mese normale', unit: '€', hint: 'Anche a occhio.' },
      { id: 'a2_tipi', t: 'multi', label: 'Cosa si paga', opts: o('Portali immobiliari', 'Fornitori e servizi', 'Collaboratori e agenti', 'Imposte e F24', 'Affitto sede e utenze', 'Marketing e pubblicità', 'Altro') },
      { id: 'a2_come', t: 'multi', label: 'Come si paga', opts: o('Bonifico da home banking', 'Carta aziendale', 'Addebito diretto', 'F24 tramite commercialista', 'Contanti') },
      { id: 'a2_chi', t: 'one', label: 'Chi dispone oggi i pagamenti in banca?', opts: o('Solo io', 'Io e un collaboratore', 'Il commercialista', 'Altro') },
      { id: 'a2_soglia', t: 'num', label: 'Sopra quale importo vuoi approvare tu ogni pagamento?', unit: '€', hint: 'Sotto questa soglia può procedere l’impiegata.' },
      { id: 'a2_banca', t: 'text', label: 'Con quale banca lavori?' },
      { id: 'a2_open', t: 'one', label: 'Se tecnicamente si può, collegheresti il conto al CRM in sola lettura (per vedere i movimenti senza pagare)?', opts: o('Sì', 'No', 'Da valutare con il commercialista') },
      { id: 'a2_ore', t: 'num', label: 'Quante ore a settimana ci va?', unit: 'ore/sett' },
      { id: 'a2_risk', t: 'risk', label: 'Se per una settimana nessuno lo facesse, cosa succede?' },
    ],
  },
  {
    id: 'a3', title: '3. documenti delle pratiche e antiriciclaggio',
    intro: 'Controllo che ogni pratica abbia i documenti giusti prima di andare avanti.',
    questions: [
      { id: 'a3_pratiche', t: 'num', label: 'Quante pratiche in corso contemporaneamente, in media', unit: 'pratiche' },
      { id: 'a3_dove', t: 'multi', label: 'Dove stanno oggi i documenti', opts: o('Google Drive', 'Cartaceo in agenzia', 'Gestionale AGIM', 'Mail e WhatsApp degli agenti', 'Non c’è un posto unico') },
      { id: 'a3_chi', t: 'one', label: 'Chi controlla oggi che i documenti siano completi?', opts: o('Io', 'Gli agenti da soli', 'Una persona dedicata', 'Nessuno in modo sistematico') },
      { id: 'a3_manca', t: 'one', label: 'Quante volte arrivi al rogito o al preliminare con documenti mancanti?', opts: o('Mai', 'Raramente', 'Spesso') },
      { id: 'a3_aml_resp', t: 'text', label: 'Chi è il responsabile antiriciclaggio dell’agenzia?', hint: 'Nome e cognome.' },
      { id: 'a3_aml_quando', t: 'one', label: 'Quando si fa oggi l’adeguata verifica del cliente?', opts: o('Alla firma dell’incarico', 'Alla proposta', 'Al preliminare', 'Non in modo sistematico') },
      { id: 'a3_firma', t: 'one', label: 'Come vuoi far firmare i moduli antiriciclaggio?', opts: o('Firma digitale semplice via link', 'Firma avanzata con codice SMS', 'Con SPID', 'Cartacea come oggi', 'Non so, consigliami') },
      { id: 'a3_ore', t: 'num', label: 'Quante ore a settimana ci va?', unit: 'ore/sett' },
      { id: 'a3_risk', t: 'risk', label: 'Se per una settimana nessuno lo facesse, cosa succede?' },
    ],
  },
  {
    id: 'a4', title: '4. rapporti con il commercialista',
    intro: 'Quello che devi passargli ogni mese e quello che ti chiede.',
    questions: [
      { id: 'a4_studio', t: 'text', label: 'Nome dello studio e referente', hint: 'Meglio con mail e telefono.' },
      { id: 'a4_volte', t: 'num', label: 'Quante volte al mese ti chiede qualcosa', unit: 'al mese' },
      { id: 'a4_cosa', t: 'multi', label: 'Cosa ti chiede di solito', opts: o('Estratti conto', 'Fatture emesse e ricevute', 'Scontrini e ricevute', 'Chiarimenti su movimenti', 'Documenti dei collaboratori', 'Altro') },
      { id: 'a4_scad', t: 'text', label: 'Scadenze fisse (esempio: chiusura mese entro il 10)' },
      { id: 'a4_sw', t: 'text', label: 'Che programma usa per la contabilità?', hint: 'Se non lo sai, va bene così.' },
      { id: 'a4_ore', t: 'num', label: 'Quante ore a settimana ci va?', unit: 'ore/sett' },
      { id: 'a4_risk', t: 'risk', label: 'Se per una settimana nessuno lo facesse, cosa succede?' },
    ],
  },
  {
    id: 'a5', title: '5. richieste dai portali agli agenti',
    intro: 'Le mail di Immobiliare.it, Casa.it e simili da girare all’agente giusto.',
    questions: [
      { id: 'a5_portali', t: 'multi', label: 'Da quali canali arrivano', opts: o('Immobiliare.it', 'Casa.it', 'Idealista', 'Sito Victor&Co', 'Telefono', 'Altro') },
      { id: 'a5_sett', t: 'num', label: 'Quante richieste arrivano a settimana', unit: 'a settimana' },
      { id: 'a5_dove', t: 'one', label: 'A quale indirizzo arrivano?', opts: o('Una casella unica dell’agenzia', 'La tua mail personale', 'Direttamente agli agenti', 'Altro') },
      { id: 'a5_criterio', t: 'long', label: 'Come decidi a quale agente va una richiesta?', hint: 'Per immobile, per zona, a rotazione, altro.' },
      { id: 'a5_tempo', t: 'one', label: 'Entro quanto tempo deve ricevere risposta una richiesta?', opts: o('Entro 1 ora', 'Entro la giornata', 'Entro 24 ore', 'Non c’è una regola') },
      { id: 'a5_perse', t: 'one', label: 'Quante richieste restano senza risposta?', opts: o('Quasi nessuna', 'Qualcuna', 'Molte', 'Non lo so') },
      { id: 'a5_ore', t: 'num', label: 'Quante ore a settimana ci va?', unit: 'ore/sett' },
      { id: 'a5_risk', t: 'risk', label: 'Se per una settimana nessuno lo facesse, cosa succede?' },
    ],
  },
  {
    id: 'a6', title: '6. proforma, fatture e incassi',
    intro: 'Note proforma agli acquirenti e ai venditori, fatture elettroniche, solleciti.',
    questions: [
      { id: 'a6_proforma', t: 'num', label: 'Proforma emesse in un mese normale', unit: 'al mese' },
      { id: 'a6_fatture', t: 'num', label: 'Fatture elettroniche emesse in un mese normale', unit: 'al mese' },
      { id: 'a6_sw', t: 'text', label: 'Con che programma emetti le fatture oggi?' },
      { id: 'a6_iva', t: 'one', label: 'Le provvigioni sono soggette a IVA al 22%?', opts: o('Sì', 'No', 'Dipende dal caso') },
      { id: 'a6_ritardo', t: 'one', label: 'Quante proforma vengono pagate oltre i 7 giorni?', opts: o('Quasi nessuna', 'Circa un quarto', 'Circa la metà', 'Quasi tutte') },
      { id: 'a6_chi', t: 'one', label: 'Chi sollecita oggi i pagamenti in ritardo?', opts: o('Io', 'L’agente della pratica', 'Nessuno, aspettiamo', 'Altro') },
      { id: 'a6_giorni', t: 'text', label: 'Dopo quanti giorni parte il primo sollecito, e dopo quanti il secondo?', hint: 'Anche solo come lo faresti.' },
      { id: 'a6_ore', t: 'num', label: 'Quante ore a settimana ci va?', unit: 'ore/sett' },
      { id: 'a6_risk', t: 'risk', label: 'Se per una settimana nessuno lo facesse, cosa succede?' },
    ],
  },
  {
    id: 'dec', title: '7. le tue regole',
    intro: 'Le scelte che solo tu puoi fare, così il CRM le applica da solo.',
    questions: [
      { id: 'd_agenti', t: 'multi', label: 'Cosa deve vedere ogni agente delle sue pratiche', opts: o('Le sue proforma', 'Lo stato degli incassi', 'I documenti mancanti', 'Le sue provvigioni maturate', 'Niente di tutto questo') },
      { id: 'd_incassi', t: 'one', label: 'Quando riconosci la provvigione all’agente?', opts: o('Alla firma del preliminare', 'Quando incassiamo', 'Al rogito', 'Altro') },
      { id: 'd_telefono', t: 'one', label: 'Chi telefona al cliente che non paga dopo i solleciti?', opts: o('Io', 'L’agente', 'L’impiegata', 'Nessuno') },
      { id: 'd_urgenze', t: 'long', label: 'Cosa deve arrivarti subito, anche di sera o nel weekend?', hint: 'Esempio: un cliente che non paga da 30 giorni, un documento antiriciclaggio mancante.' },
    ],
  },
  {
    id: 'imp', title: '8. la persona che assumi',
    questions: [
      { id: 'i_ore', t: 'one', label: 'Impegno che hai in mente', opts: o('Part-time mattina', 'Part-time pomeriggio', 'Tempo pieno', 'Non lo so ancora') },
      { id: 'i_tempo', t: 'num', label: 'Quante ore a settimana dedichi tu oggi all’amministrazione?', unit: 'ore/sett' },
      { id: 'i_mai', t: 'long', label: 'Cosa non vuoi che faccia mai, senza il tuo ok?' },
      { id: 'i_ruba', t: 'long', label: 'Cosa oggi ti ruba più tempo o ti dà più fastidio?' },
      { id: 'i_finalmente', t: 'long', label: 'Cosa dovrebbe succedere perché tra tre mesi tu dica “finalmente”?' },
    ],
  },
  {
    id: 'mat', title: '9. cosa mandare a Marco',
    intro: 'Segna cosa gli mandi e come: lo trovi su WhatsApp, basta una foto o un PDF.',
    questions: [
      { id: 'm_lista', t: 'multi', label: 'Ti preparo e mando', opts: o('Estratti conto di 1-2 mesi (anche con i nomi oscurati)', 'Un esempio di proforma', 'Un esempio di fattura', 'Una pratica completa (carta e digitale)', '3-4 mail vere dei portali', 'Contatto del commercialista') },
      { id: 'm_note', t: 'long', label: 'Altro che vuoi dire a Marco', hint: 'Dubbi, paure, cose che non abbiamo considerato.' },
    ],
  },
]

/* ───────────────────────── dati dal CRM da battezzare ───────────────────────── */

type Facts = {
  vendite_chiuse_6m: number
  locazioni_chiuse_6m: number
  vendite_in_pipeline: number
  proposte_accettate: number
  mandati_attivi: number
  mandati_in_scadenza_60gg: number
  provvigioni_maturate_12m: number
  provvigioni_incassate_12m: number
  operazioni_con_incasso_parziale: number
  richieste_portali_90gg: number
  contatti_sito_90gg: number
  agenti_attivi: number
  operazioni_per_mese: { mese: string; vendite: number; locazioni: number }[]
}

type CrmItem = { id: string; text: string; fix: string; unit?: string }

function crmItems(f: Facts): CrmItem[] {
  const eur = (n: number) => n.toLocaleString('it-IT') + ' €'
  const n = f.operazioni_per_mese.length || 6
  return [
    { id: 'c_vendite', text: `Negli ultimi 6 mesi hai chiuso ${f.vendite_chiuse_6m} vendite, circa ${(f.vendite_chiuse_6m / n).toFixed(1).replace('.', ',')} al mese.`, fix: 'Quante sono in realtà al mese?', unit: 'al mese' },
    { id: 'c_loc', text: `E ${f.locazioni_chiuse_6m} locazioni nello stesso periodo.`, fix: 'Quante sono in realtà al mese?', unit: 'al mese' },
    { id: 'c_pipeline', text: `Hai ${f.vendite_in_pipeline} vendite in pipeline e ${f.proposte_accettate} proposte accettate, cioè prossime a preliminare.`, fix: 'Cosa non torna?' },
    { id: 'c_mandati', text: `Risultano ${f.mandati_attivi} mandati attivi, ${f.mandati_in_scadenza_60gg} in scadenza entro 60 giorni.`, fix: 'Quanti sono in realtà?', unit: 'mandati' },
    { id: 'c_prov', text: `Negli ultimi 12 mesi le provvigioni maturate sono ${eur(f.provvigioni_maturate_12m)} e quelle incassate ${eur(f.provvigioni_incassate_12m)}, con ${f.operazioni_con_incasso_parziale} operazioni non ancora incassate per intero.`, fix: 'Cosa non torna?' },
    { id: 'c_portali', text: `Nel CRM ci sono ${f.richieste_portali_90gg} richieste dai portali e ${f.contatti_sito_90gg} contatti dal sito negli ultimi 90 giorni, ma il CRM le registra solo da poco.`, fix: 'Quante ne arrivano davvero a settimana?', unit: 'a settimana' },
    { id: 'c_agenti', text: `Gli agenti attivi sono ${f.agenti_attivi}.`, fix: 'Quanti sono, contando anche chi collabora a progetto?', unit: 'agenti' },
  ]
}

/* ───────────────────────── pagina ───────────────────────── */

type Answers = Record<string, string | string[]>
type Loaded = { title: string; recipient: string | null; answers: Answers; status: 'aperto' | 'inviato'; submitted_at: string | null; crm: Facts }

type Step =
  | { kind: 'crm'; item: CrmItem; section: string }
  | { kind: 'q'; q: Q; section: string; intro?: string }

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
    const crm: Step[] = crmItems(data.crm).map(item => ({ kind: 'crm', item, section: 'I numeri che ho già dal CRM' }))
    const qs: Step[] = SECTIONS.flatMap(sec => sec.questions.map(q => ({ kind: 'q' as const, q, section: sec.title, intro: sec.intro })))
    return [...crm, ...qs]
  }, [data])

  const n = steps.length
  const minutes = Math.max(5, Math.round((n * 9) / 60))

  const goto = (p: number) => {
    const clamped = Math.max(-1, Math.min(n, p))
    ref.current = { ...ref.current, _pos: String(clamped) }
    setPos(clamped)
    if (dirty.current || clamped >= 0) void persist()
    window.scrollTo({ top: 0 })
  }

  const answeredCount = steps.filter(st => st.kind === 'crm' ? hasValue(answers[st.item.id + '_ok']) : hasValue(answers[st.q.id])).length

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
  const valueKey = st.kind === 'crm' ? st.item.id + '_ok' : st.q.id
  const answered = st.kind === 'crm'
    ? hasValue(answers[st.item.id + '_ok'])
    : hasValue(answers[st.q.id])
  const onEnter = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); next() } }
  const pick = (id: string, v: string) => { set(id, v); window.setTimeout(() => goto(pos + 1), 220) }

  return (
    <div className="qa" onKeyDown={onEnter}><style>{CSS}</style>
      <div className="qa-top">
        <div className="qa-prog"><i style={{ width: `${Math.round(((pos + 1) / n) * 100)}%` }} /></div>
        <div className="qa-meta"><span>{pos + 1} di {n}</span><span>{err ? 'Non salvato' : savedAt ? `Salvato ${savedAt}` : ''}</span></div>
      </div>

      <div className="qa-main" key={valueKey}>
        <div className="qa-chip">{st.section}</div>

        {st.kind === 'crm' ? (
          <>
            <div className="qa-q" style={{ fontWeight: 600 }}>{st.item.text}</div>
            <div className="qa-opts">
              <button className={'qa-opt' + (answers[st.item.id + '_ok'] === 'si' ? ' on' : '')} onClick={() => pick(st.item.id + '_ok', 'si')}>Giusto</button>
              <button className={'qa-opt' + (answers[st.item.id + '_ok'] === 'no' ? ' on' : '')} onClick={() => set(st.item.id + '_ok', 'no')}>Non torna</button>
            </div>
            {answers[st.item.id + '_ok'] === 'no' && (
              <>
                <div className="qa-h" style={{ marginTop: 16, marginBottom: 0 }}>{st.item.fix} Una stima va bene.</div>
                <div className="qa-row">
                  <input className="qa-in" autoFocus value={(answers[st.item.id + '_fix'] as string) || ''} onChange={e => set(st.item.id + '_fix', e.target.value)} />
                  {st.item.unit && <span className="qa-unit">{st.item.unit}</span>}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <div className="qa-q">{st.q.label}</div>
            {'hint' in st.q && st.q.hint && <div className="qa-h">{st.q.hint}</div>}
            {st.q.t === 'num' && (
              <div className="qa-row">
                <input className="qa-in" autoFocus inputMode="decimal" placeholder="una stima va bene" value={(answers[st.q.id] as string) || ''} onChange={e => set(st.q.id, e.target.value)} />
                {st.q.unit && <span className="qa-unit">{st.q.unit}</span>}
              </div>
            )}
            {st.q.t === 'text' && <input className="qa-in" autoFocus value={(answers[st.q.id] as string) || ''} onChange={e => set(st.q.id, e.target.value)} />}
            {st.q.t === 'long' && <textarea className="qa-in" autoFocus value={(answers[st.q.id] as string) || ''} onChange={e => set(st.q.id, e.target.value)} />}
            {(st.q.t === 'one' || st.q.t === 'risk') && (
              <div className="qa-opts">
                {(st.q.t === 'risk' ? RISK_OPTS : st.q.opts).map(op => (
                  <button key={op.v} className={'qa-opt' + (answers[st.q.id] === op.v ? ' on' : '')} onClick={() => pick((st.q as Q).id, op.v)}>{op.l}</button>
                ))}
              </div>
            )}
            {st.q.t === 'multi' && (
              <div className="qa-opts">
                {st.q.opts.map(op => {
                  const arr = (Array.isArray(answers[st.q.id]) ? answers[st.q.id] : []) as string[]
                  const on = arr.includes(op.v)
                  return <button key={op.v} className={'qa-opt' + (on ? ' on' : '')} onClick={() => set((st.q as Q).id, on ? arr.filter(x => x !== op.v) : [...arr, op.v])}>{on ? '✓ ' : ''}{op.l}</button>
                })}
              </div>
            )}
          </>
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
