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

const CSS = `
.qa{min-height:100vh;background:#f4f6f8;color:#181a20;font-family:'Montserrat',system-ui,sans-serif;padding:0 0 96px}
.qa-wrap{max-width:720px;margin:0 auto;padding:0 16px}
.qa-top{background:#0d3447;color:#fff;padding:28px 0 22px}
.qa-top small{opacity:.7;letter-spacing:.08em;font-size:11px}
.qa-top h1{font-size:24px;line-height:1.25;margin:8px 0 8px;font-weight:700}
.qa-top p{font-size:14px;opacity:.9;line-height:1.5}
.qa-bar{position:sticky;top:0;z-index:5;background:#fff;border-bottom:1px solid #dde2e7;padding:10px 0}
.qa-bar-in{display:flex;align-items:center;gap:12px;font-size:12px;color:#4f5560}
.qa-prog{flex:1;height:6px;background:#e2e7eb;border-radius:4px;overflow:hidden}
.qa-prog>i{display:block;height:100%;background:#1d8f5f;transition:width .3s}
.qa-card{background:#fff;border:1px solid #dde2e7;border-radius:12px;padding:20px 18px;margin-top:16px}
.qa-card h2{font-size:17px;margin-bottom:4px;color:#0d3447}
.qa-intro{font-size:13px;color:#717171;margin-bottom:14px;line-height:1.5}
.qa-q{padding:14px 0;border-top:1px solid #eef1f4}
.qa-q:first-of-type{border-top:0}
.qa-l{font-size:14px;font-weight:600;line-height:1.4;margin-bottom:8px}
.qa-h{font-size:12px;color:#717171;margin:-4px 0 8px}
.qa-in{width:100%;font:inherit;font-size:15px;padding:11px 12px;border:1px solid #cfd6dc;border-radius:8px;background:#fff;color:#181a20}
.qa-in:focus{outline:2px solid #1f6f8b;border-color:#1f6f8b}
textarea.qa-in{min-height:84px;resize:vertical}
.qa-row{display:flex;gap:8px;align-items:center}
.qa-unit{font-size:12px;color:#717171;white-space:nowrap}
.qa-opts{display:flex;flex-direction:column;gap:8px}
.qa-opt{display:flex;gap:10px;align-items:flex-start;padding:11px 12px;border:1px solid #cfd6dc;border-radius:8px;font-size:14px;cursor:pointer;background:#fff;line-height:1.35}
.qa-opt.on{border-color:#0d3447;background:#eaf1f5;font-weight:600}
.qa-opt input{margin-top:2px}
.qa-crm{background:#f7f9fb;border:1px solid #dde2e7;border-left:4px solid #1f6f8b;border-radius:8px;padding:12px 14px;margin-top:12px}
.qa-crm p{font-size:14px;line-height:1.45;margin-bottom:10px}
.qa-btns{display:flex;gap:8px}
.qa-btn{flex:1;padding:11px 12px;border-radius:8px;border:1px solid #cfd6dc;background:#fff;font:inherit;font-size:14px;font-weight:600;cursor:pointer}
.qa-btn.on{background:#0d3447;color:#fff;border-color:#0d3447}
.qa-btn.no.on{background:#b7791f;border-color:#b7791f}
.qa-fix{margin-top:10px}
.qa-send{margin-top:20px;width:100%;padding:15px;border:0;border-radius:10px;background:#0d3447;color:#fff;font:inherit;font-size:16px;font-weight:700;cursor:pointer}
.qa-send:disabled{opacity:.6}
.qa-save{font-size:12px;color:#717171;text-align:center;margin-top:10px}
.qa-done{text-align:center;padding:40px 16px}
.qa-done h2{font-size:22px;color:#0d3447;margin-bottom:8px}
`

function hasValue(v: string | string[] | undefined) {
  return Array.isArray(v) ? v.length > 0 : !!(v && v.trim())
}

export default function QuestionarioAmministrazione({ token }: { token: string }) {
  const [data, setData] = useState<Loaded | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'notfound'>('loading')
  const [answers, setAnswers] = useState<Answers>({})
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState<string | null>(null)
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
      setDone(l.status === 'inviato')
      setState('ok')
    })
    return () => { alive = false }
  }, [token])

  const persist = useCallback(async (a: Answers, submit = false) => {
    setSaving(true); setErr(null)
    const { error } = await supabase.rpc('adm_q_save', { p_token: token, p_answers: a, p_submit: submit })
    setSaving(false)
    if (error) { setErr('Non sono riuscito a salvare. Controlla la connessione e riprova.'); return false }
    dirty.current = false
    setSavedAt(new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }))
    return true
  }, [token])

  const set = (id: string, v: string | string[]) => {
    setAnswers(prev => {
      const next = { ...prev, [id]: v }
      dirty.current = true
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => { void persist(next) }, 900)
      return next
    })
  }

  const items = useMemo(() => (data ? crmItems(data.crm) : []), [data])

  const total = useMemo(() => {
    const q = SECTIONS.flatMap(s => s.questions).length + items.length
    return q
  }, [items])
  const answered = useMemo(() => {
    const q = SECTIONS.flatMap(s => s.questions).filter(x => hasValue(answers[x.id])).length
    const c = items.filter(x => hasValue(answers[x.id + '_ok'])).length
    return q + c
  }, [answers, items])

  const submit = async () => {
    setSending(true)
    if (timer.current) window.clearTimeout(timer.current)
    const ok = await persist(answers, true)
    setSending(false)
    if (ok) { setDone(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  }

  if (state === 'loading') return <div className="qa"><style>{CSS}</style><div className="qa-wrap" style={{ paddingTop: 80, textAlign: 'center', color: '#717171' }}>Carico il questionario…</div></div>
  if (state === 'notfound' || !data) return <div className="qa"><style>{CSS}</style><div className="qa-wrap" style={{ paddingTop: 80, textAlign: 'center' }}>Questo link non è valido. Chiedi a Marco di mandartene uno nuovo.</div></div>

  const first = (data.recipient || '').split(' ')[0]

  if (done) {
    return (
      <div className="qa"><style>{CSS}</style>
        <div className="qa-top"><div className="qa-wrap"><small>VICTOR&CO REAL ESTATE</small><h1>Fatto, grazie {first}.</h1></div></div>
        <div className="qa-wrap"><div className="qa-card qa-done">
          <h2>Risposte ricevute</h2>
          <p style={{ fontSize: 14, color: '#4f5560', lineHeight: 1.5 }}>Marco le guarda e torna da te con una proposta concreta su cosa automatizzare e dove serve una persona.</p>
          <button className="qa-btn" style={{ marginTop: 18, flex: 'none' }} onClick={() => setDone(false)}>Voglio modificare qualcosa</button>
        </div></div>
      </div>
    )
  }

  return (
    <div className="qa"><style>{CSS}</style>
      <div className="qa-top"><div className="qa-wrap">
        <small>VICTOR&CO REAL ESTATE</small>
        <h1>{data.title}</h1>
        <p>{first ? `Ciao ${first}, ` : ''}servono 10-12 minuti. Ho già messo i numeri che trovo nel CRM: tu dimmi solo se sono giusti. Si salva da solo, puoi chiudere e riprendere dallo stesso link.</p>
      </div></div>

      <div className="qa-bar"><div className="qa-wrap qa-bar-in">
        <div className="qa-prog"><i style={{ width: `${Math.round((answered / total) * 100)}%` }} /></div>
        <span>{answered} di {total}</span>
      </div></div>

      <div className="qa-wrap">
        <div className="qa-card">
          <h2>0. i numeri che ho già dal crm</h2>
          <p className="qa-intro">Per ognuno: confermi o correggi.</p>
          {items.map(it => {
            const ok = answers[it.id + '_ok']
            return (
              <div className="qa-crm" key={it.id}>
                <p>{it.text}</p>
                <div className="qa-btns">
                  <button className={'qa-btn' + (ok === 'si' ? ' on' : '')} onClick={() => set(it.id + '_ok', 'si')}>Giusto</button>
                  <button className={'qa-btn no' + (ok === 'no' ? ' on' : '')} onClick={() => set(it.id + '_ok', 'no')}>Non torna</button>
                </div>
                {ok === 'no' && (
                  <div className="qa-fix">
                    <div className="qa-h" style={{ margin: '0 0 6px' }}>{it.fix}</div>
                    <div className="qa-row">
                      <input className="qa-in" inputMode={it.unit ? 'decimal' : 'text'} value={(answers[it.id + '_fix'] as string) || ''} onChange={e => set(it.id + '_fix', e.target.value)} />
                      {it.unit && <span className="qa-unit">{it.unit}</span>}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {SECTIONS.map(s => (
          <div className="qa-card" key={s.id}>
            <h2>{s.title}</h2>
            {s.intro && <p className="qa-intro">{s.intro}</p>}
            {s.questions.map(q => <Question key={q.id} q={q} value={answers[q.id]} onChange={v => set(q.id, v)} />)}
          </div>
        ))}

        {err && <div style={{ color: '#c0392b', fontSize: 13, marginTop: 14 }}>{err}</div>}
        <button className="qa-send" disabled={sending} onClick={submit}>{sending ? 'Invio…' : 'Invia a Marco'}</button>
        <div className="qa-save">
          {saving ? 'Salvo…' : savedAt ? `Salvato alle ${savedAt}` : 'Le risposte si salvano da sole'}
          {' · puoi inviare anche se non hai risposto a tutto'}
        </div>
      </div>
    </div>
  )
}

function Question({ q, value, onChange }: { q: Q; value: string | string[] | undefined; onChange: (v: string | string[]) => void }) {
  const label = q.t === 'risk' ? q.label : q.label
  return (
    <div className="qa-q">
      <div className="qa-l">{label}</div>
      {'hint' in q && q.hint && <div className="qa-h">{q.hint}</div>}
      {q.t === 'num' && (
        <div className="qa-row">
          <input className="qa-in" inputMode="decimal" value={(value as string) || ''} onChange={e => onChange(e.target.value)} />
          {q.unit && <span className="qa-unit">{q.unit}</span>}
        </div>
      )}
      {q.t === 'text' && <input className="qa-in" value={(value as string) || ''} onChange={e => onChange(e.target.value)} />}
      {q.t === 'long' && <textarea className="qa-in" value={(value as string) || ''} onChange={e => onChange(e.target.value)} />}
      {(q.t === 'one' || q.t === 'risk') && (
        <div className="qa-opts">
          {(q.t === 'risk' ? RISK_OPTS : q.opts).map(op => (
            <label key={op.v} className={'qa-opt' + (value === op.v ? ' on' : '')}>
              <input type="radio" name={q.id} checked={value === op.v} onChange={() => onChange(op.v)} />
              <span>{op.l}</span>
            </label>
          ))}
        </div>
      )}
      {q.t === 'multi' && (
        <div className="qa-opts">
          {q.opts.map(op => {
            const arr = (Array.isArray(value) ? value : []) as string[]
            const on = arr.includes(op.v)
            return (
              <label key={op.v} className={'qa-opt' + (on ? ' on' : '')}>
                <input type="checkbox" checked={on} onChange={() => onChange(on ? arr.filter(x => x !== op.v) : [...arr, op.v])} />
                <span>{op.l}</span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
