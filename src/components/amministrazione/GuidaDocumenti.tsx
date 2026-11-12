import { useState } from 'react'
import docs from '../../content/amministrazione-docs.json'
import { Head } from './ui'

type Block =
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'table'; head: string[]; rows: string[][] }
type Doc = { title: string; subtitle: string; pdf: string; sections: { h: string; blocks: Block[] }[] }

const DOCS: { key: 'analisi' | 'jobdesc'; label: string }[] = [
  { key: 'analisi', label: 'Analisi e migliorie' },
  { key: 'jobdesc', label: 'Job description' },
]

/** Analisi dell'amministrazione e job description, consultabili e scaricabili in PDF. */
export default function GuidaDocumenti() {
  const [sel, setSel] = useState<'analisi' | 'jobdesc'>('analisi')
  const doc = docs[sel] as Doc

  return (
    <div>
      <Head
        title="Analisi e job description"
        hint="Documenti nati dal questionario amministrazione. Il contenuto è lo stesso dei PDF scaricabili."
        action={<a className="btn btn-primary" href={doc.pdf} target="_blank" rel="noreferrer">Scarica PDF</a>}
      />
      <div className="tabs" style={{ flexWrap: 'wrap' }}>
        {DOCS.map(d => (
          <button key={d.key} className={`tab ${sel === d.key ? 'active' : ''}`} onClick={() => setSel(d.key)}>{d.label}</button>
        ))}
      </div>

      <div style={{ maxWidth: 920, background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: 10, padding: '20px 24px' }}>
        <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 20, fontWeight: 700, color: 'var(--navy)' }}>{doc.title}</div>
        <p style={{ fontSize: 12, color: 'var(--gl)', margin: '4px 0 12px 0' }}>{doc.subtitle}</p>
        {doc.sections.map(sec => (
          <div key={sec.h} style={{ marginTop: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>{sec.h}</div>
            {sec.blocks.map((b, i) => {
              if (b.type === 'p') return <p key={i} style={{ fontSize: 13, lineHeight: 1.55, margin: '0 0 8px 0' }}>{b.text}</p>
              if (b.type === 'ul') {
                return (
                  <ul key={i} style={{ fontSize: 13, lineHeight: 1.55, margin: '0 0 8px 18px' }}>
                    {b.items.map(it => <li key={it}>{it}</li>)}
                  </ul>
                )
              }
              return (
                <div key={i} style={{ overflowX: 'auto', margin: '0 0 10px 0' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr>
                        {b.head.map(h => (
                          <th key={h} style={{ background: 'var(--navy)', color: '#fff', textAlign: 'left', padding: '7px 9px', fontWeight: 700 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {b.rows.map((r, ri) => (
                        <tr key={ri} style={{ background: ri % 2 ? 'var(--s1)' : 'transparent' }}>
                          {r.map((c, ci) => (
                            <td key={ci} style={{ padding: '7px 9px', borderBottom: '1px solid var(--bd)', verticalAlign: 'top' }}>{c}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
