// Vademecum Reels & Open House — pagina interna, identity Victor&Co Real Estate
const PDF_URL = '/docs/vademecum-reels-v1.pdf'
const PDF_NAME = 'VictorCo_Vademecum_Reels_OpenHouse_v1.pdf'
const VERSION = 'v1 · settembre 2026'

const RULES: [string, string][] = [
  ['Ogni affermazione è verificabile', 'Dati dal CRM, non a memoria. Senza dato, non si dice.'],
  ['Prezzo richiesto sempre visibile', 'Mai «prezzo su richiesta» per il residenziale.'],
  ['Classe energetica in ogni reel-annuncio', 'Overlay o caption: classe + IPE. Senza APE non è un annuncio.'],
  ['Marchio e ruolo dichiarati', '«Sono [nome], agente Victor&Co» — anche sui profili personali.'],
  ['Nessuna urgenza inventata', '«Già offerte», «ultimi giorni» solo se documentati in CRM.'],
  ['Nessuna promessa di rendimento', 'Niente «investimento sicuro», «si rivaluta».'],
  ['Urbanistica: rimandare, non garantire', '«Documentazione verificata, disponibile su richiesta».'],
  ['Il venditore è una persona', 'Mai motivi della vendita, margini, oggetti personali in video.'],
  ['Venduto = reel aggiornato entro 48h', '«Trattativa in corso» → «Venduto». Mai annunci-civetta.'],
  ['Il test del notaio', 'Se non lo diresti davanti al notaio, non lo dici nel reel.'],
]
const OPEN_HOUSE = [
  { fase: 'Prima', ok: 'Data, orario, zona, prezzo richiesto, classe energetica, accesso libero con registrazione.', ko: '«Vieni prima degli altri», liste d\'attesa inventate, posizione negoziale del venditore.' },
  { fase: 'Durante', ok: 'Riprendi l\'immobile, non le persone. Fatti (spese, riscaldamento). Iter proposta uguale per tutti.', ko: 'Volti, minori, targhe, vicini. «Guardate quanta gente, il prezzo salirà». Audio ambiente in live.' },
  { fase: 'Dopo', ok: '«L\'immobile resta in vendita» / «Trattativa in corso» / «Venduto». Contenuto educativo sull\'iter.', ko: 'Numero e importo delle proposte, «andata sopra il prezzo», clip con visitatori riconoscibili.' },
]
const SWAP: [string, string][] = [
  ['Il mio cliente', 'La proprietà / chi acquista / le parti'],
  ['Vi faccio ottenere il prezzo migliore', 'Vi seguo con trasparenza per entrambe le parti'],
  ['Il proprietario ha fretta', 'La proprietà valuta proposte scritte'],
  ['Già tante offerte / sta per andare', 'Immobile disponibile — oppure niente'],
  ['Tutto in regola, garantito', 'Documentazione verificata, disponibile su richiesta'],
  ['Perfetto per una famiglia italiana', 'Tre camere, doppi servizi, vicino a scuole e stazione'],
]
const CHECK = [
  'Ho detto chi sono e per chi lavoro',
  'Classe energetica e prezzo richiesto visibili (reel-annuncio)',
  'Nessuna frase mi schiera con venditore o compratore',
  'Nessuna urgenza, scarsità o promessa non documentabile',
  'Nessuna informazione personale o negoziale sul venditore',
  'Nessun volto, minore, targa, documento, civico senza consenso',
  'Musica con licenza commerciale',
  'Coerente con la scheda ufficiale in CRM',
  'So chi aggiornerà la caption quando l\'immobile cambia stato',
]

const card: React.CSSProperties = { background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: '14px 16px' }

export default function Vademecum() {
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <div className="section-heading" style={{ margin: '0 0 8px' }}>Vademecum agenti · Reels & Open House · {VERSION}</div>
          <h1 style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 30, fontWeight: 700, lineHeight: 1.15, color: 'var(--navy)', margin: 0 }}>
            Comunicare nei reel.<br /><span style={{ borderBottom: '4px solid var(--navy)' }}>Da intermediari</span>, sempre.
          </h1>
          <p style={{ color: 'var(--g)', marginTop: 12, maxWidth: 640 }}>
            Regole vincolanti per ogni contenuto pubblicato con il marchio Victor&Co: reel, stories, live e caption,
            su profilo agenzia e profili personali. Focus: open house.
          </p>
        </div>
        <a className="btn btn-primary" href={PDF_URL} download={PDF_NAME}>↓ Scarica il PDF completo</a>
      </div>

      <div className="kpi-grid">
        {[['1 ruolo', 'Mediatore imparziale per venditore e compratore'], ['4 leggi', 'Mediazione · Consumo · APE · Privacy'], ['3 fasi', 'Open house: prima · durante · dopo'], ['0 promesse', 'Niente garanzie su prezzo, rendimento, tempi']].map(([v, l]) => (
          <div key={v} className="kpi-card">
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 24, fontWeight: 700, color: 'var(--navy)' }}>{v}</div>
            <div style={{ fontSize: 11, color: 'var(--g)', marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--navy)', borderRadius: 10, padding: 24, textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 19, fontWeight: 700, color: '#fff' }}>«Accompagno chi vende e chi compra a chiudere un buon affare per entrambi.»</div>
        <div style={{ color: '#b9ccd6', fontSize: 13, marginTop: 8 }}>Frase-bussola. Se una frase del reel non è compatibile con questa, non va pubblicata.</div>
      </div>

      <div className="section-heading">Le 10 regole d'oro</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 10, marginBottom: 28 }}>
        {RULES.map(([t, d], i) => (
          <div key={t} style={{ ...card, display: 'grid', gridTemplateColumns: '36px 1fr', gap: 12 }}>
            <div style={{ fontFamily: "'Montserrat', sans-serif", color: 'var(--navy)', fontWeight: 700 }}>{String(i + 1).padStart(2, '0')}</div>
            <div><div style={{ fontWeight: 600 }}>{t}</div><div style={{ fontSize: 13, color: 'var(--gl)', marginTop: 2 }}>{d}</div></div>
          </div>
        ))}
      </div>

      <div className="section-heading">Open house — le tre fasi</div>
      {OPEN_HOUSE.map((f, i) => (
        <div key={f.fase} style={{ display: 'grid', gridTemplateColumns: '56px 1fr', margin: '10px 0', border: '1px solid var(--bd)', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
          <div style={{ background: 'var(--navy)', color: '#fff', display: 'flex', justifyContent: 'center', paddingTop: 16, fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>{String(i + 1).padStart(2, '0')}</div>
          <div style={{ padding: '14px 18px' }}>
            <div className="section-heading" style={{ margin: 0, fontSize: 12 }}>{f.fase}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, marginTop: 10 }}>
              <div style={{ background: 'rgba(29,143,95,0.10)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}><span style={{ color: 'var(--green)', fontWeight: 700 }}>✓ </span>{f.ok}</div>
              <div style={{ background: 'rgba(192,57,43,0.08)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}><span style={{ color: 'var(--red)', fontWeight: 700 }}>✕ </span>{f.ko}</div>
            </div>
          </div>
        </div>
      ))}

      <div className="section-heading" style={{ marginTop: 28 }}>Dizionario di sostituzione</div>
      <div className="table-wrap" style={{ marginBottom: 28 }}><table>
        <thead><tr><th>Non dire</th><th>Dire invece</th></tr></thead>
        <tbody>
          {SWAP.map(([a, b]) => (
            <tr key={a}>
              <td style={{ color: 'var(--red)' }}>«{a}»</td>
              <td style={{ color: 'var(--green)', fontWeight: 600 }}>«{b}»</td>
            </tr>
          ))}
        </tbody>
      </table></div>

      <div className="section-heading">Checklist prima di «Pubblica»</div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {CHECK.map((c) => (
          <li key={c} style={{ padding: '9px 0 9px 30px', position: 'relative', borderBottom: '1px solid var(--bd)' }}>
            <span style={{ position: 'absolute', left: 0, top: 11, width: 15, height: 15, border: '2px solid var(--navy)', borderRadius: 3 }} />
            {c}
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, color: 'var(--g)', maxWidth: 680 }}>
          La versione completa (quadro normativo, script, 6 casi pratici, workflow di pubblicazione) è nel PDF. Approvazione compliance: Victor. Documento interno — non sostituisce un parere legale.
        </div>
        <a className="btn btn-secondary" href={PDF_URL} download={PDF_NAME}>↓ PDF · {VERSION}</a>
      </div>
    </div>
  )
}
