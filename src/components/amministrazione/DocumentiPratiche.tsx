import { useEffect, useMemo, useState } from 'react'
import type { OperationWithAgent } from '../../lib/supabase'
import { supabase } from '../../lib/supabase'
import { useAdmTable } from '../../hooks/useAdm'
import {
  EXTRA_DOCS, STAGES, STAGE_LABELS, TEMPLATE_DOCS, fmtDate,
  type DocItem, type DocItemStatus,
} from '../../lib/amministrazione'
import { Empty, FileCell, Head, Kpi, Pill, SetupNotice, type Tone } from './ui'

type Props = { operations: OperationWithAgent[]; toast: (m: string, t?: 'success' | 'error' | 'info') => void }
type TplRow = { operation_id: string; template_id: string; status: string }

const RENT_KEYS = new Set(['contratto_locazione', 'ricevuta_registrazione_loc'])
const SELL_TEMPLATES = new Set(['tpl_incarico_vendita', 'tpl_proposta_acquisto', 'tpl_dich_provvigionale'])

function extraApplies(op: OperationWithAgent, key: string, sellOnly?: boolean): boolean {
  if (RENT_KEYS.has(key)) return op.type === 'locazione'
  if (sellOnly) return op.type === 'vendita'
  return true
}

const STATUS_LABEL: Record<DocItemStatus, string> = {
  mancante: 'Mancante', caricato: 'Da verificare', verificato: 'Verificato', non_applicabile: 'Non applicabile',
}
const STATUS_TONE: Record<DocItemStatus, Tone> = { mancante: 'red', caricato: 'amber', verificato: 'green', non_applicabile: 'g' }

export default function DocumentiPratiche({ operations, toast }: Props) {
  const items = useAdmTable<DocItem>('adm_doc_items', { orderBy: 'created_at', ascending: true })
  const [tpl, setTpl] = useState<TplRow[]>([])
  const [tplError, setTplError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('operation_documents').select('operation_id, template_id, status').then(({ data, error }) => {
      if (error) setTplError(error.message)
      else setTpl((data ?? []) as TplRow[])
    })
  }, [])

  const tplStatus = (opId: string, templateId: string) =>
    tpl.find(t => t.operation_id === opId && t.template_id === templateId)?.status ?? 'missing'

  const summary = useMemo(() => {
    return operations.map(op => {
      const own = items.rows.filter(i => i.operation_id === op.id)
      const tplList = TEMPLATE_DOCS.filter(t => op.type === 'vendita' || !SELL_TEMPLATES.has(t.key))
      let total = 0, ok = 0, toVerify = 0
      const missingCritical: string[] = []
      for (const t of tplList) {
        total++
        const s = tplStatus(op.id, t.templateId)
        if (s === 'signed' || s === 'archived') ok++
        else if (t.critical) missingCritical.push(t.label)
      }
      for (const i of own) {
        if (!i.required || i.status === 'non_applicabile') continue
        total++
        if (i.status === 'verificato') ok++
        else if (i.status === 'caricato') { ok++; toVerify++ }
      }
      return { op, total, ok, toVerify, missingCritical, hasChecklist: own.length > 0 }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operations, items.rows, tpl])

  const list = summary.filter(s => showAll || s.op.status !== 'terminato')
  const blocked = list.filter(s => s.missingCritical.length > 0)

  const generate = async (op: OperationWithAgent) => {
    const existing = new Set(items.rows.filter(i => i.operation_id === op.id).map(i => i.doc_key))
    const toCreate = EXTRA_DOCS
      .filter(d => extraApplies(op, d.key, d.sellOnly) && !existing.has(d.key))
      .map(d => ({ operation_id: op.id, stage: d.stage, doc_key: d.key, label: d.label, required: d.required ?? true }))
    if (!toCreate.length) { toast('La checklist e\' gia\' completa', 'info'); return }
    const { error } = await supabase.from('adm_doc_items').insert(toCreate)
    if (error) toast(error.message, 'error')
    else { toast(`${toCreate.length} voci aggiunte`); items.refetch() }
  }

  const setStatus = async (i: DocItem, status: DocItemStatus, extra: Partial<DocItem> = {}) => {
    const patch: Partial<DocItem> = { status, ...extra }
    if (status === 'verificato') patch.verified_at = new Date().toISOString()
    const res = await items.update(i.id, patch)
    if (res.error) toast(res.error, 'error')
  }

  return (
    <div>
      <Head
        title="Controllo documentale pratiche"
        hint="Per ogni pratica, dall'incarico al rogito: i documenti generati dal crm (modulistica FIAIP firmata, antiriciclaggio incluso) e quelli da caricare a mano. Verifica anche che l'originale cartaceo sia in archivio."
        action={
          <label style={{ fontSize: 12, color: 'var(--gl)', display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} /> Includi pratiche terminate
          </label>
        }
      />
      <SetupNotice error={items.error ?? tplError} />
      <div className="kpi-grid" style={{ marginBottom: 16 }}>
        <Kpi label="Pratiche seguite" value={list.length} />
        <Kpi label="Antiriciclaggio mancante" value={blocked.length} tone={blocked.length ? 'red' : 'green'} />
        <Kpi label="Documenti da verificare" value={list.reduce((s, x) => s + x.toVerify, 0)} tone="amber" />
      </div>

      {list.length === 0 ? <Empty text="Nessuna pratica da controllare." /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Pratica</th><th>Tipo</th><th>Stato</th><th>Completezza</th><th>Alert</th><th></th></tr></thead>
            <tbody>
              {list.map(({ op, total, ok, toVerify, missingCritical, hasChecklist }) => {
                const pct = total ? Math.round((ok / total) * 100) : 0
                const open = openId === op.id
                return (
                  <tr key={op.id} style={{ verticalAlign: 'top' }}>
                    <td colSpan={open ? 6 : 1} style={open ? { whiteSpace: 'normal', padding: 0 } : undefined}>
                      {!open ? (
                        <div><div style={{ fontWeight: 600 }}>{op.property_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--g)' }}>{op.profiles?.full_name ?? ''}</div></div>
                      ) : (
                        <PracticePanel
                          op={op} items={items.rows.filter(i => i.operation_id === op.id)}
                          tplStatus={(k: string) => tplStatus(op.id, k)}
                          onClose={() => setOpenId(null)} onGenerate={() => generate(op)}
                          setStatus={setStatus} update={items.update} toast={toast}
                        />
                      )}
                    </td>
                    {!open && <>
                      <td>{op.type}</td>
                      <td>{op.status.replace('_', ' ')}</td>
                      <td style={{ minWidth: 150 }}>
                        <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${pct}%` }} /></div>
                        <div style={{ fontSize: 11, color: 'var(--g)', marginTop: 2 }}>{ok}/{total} · {hasChecklist ? `${toVerify} da verificare` : 'checklist non generata'}</div>
                      </td>
                      <td>{missingCritical.length ? <Pill tone="red">Antiriciclaggio mancante</Pill> : <Pill tone="green">OK</Pill>}</td>
                      <td><button className="btn btn-secondary btn-sm" onClick={() => setOpenId(op.id)}>Apri</button></td>
                    </>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

type PanelProps = {
  op: OperationWithAgent
  items: DocItem[]
  tplStatus: (key: string) => string
  onClose: () => void
  onGenerate: () => void
  setStatus: (i: DocItem, s: DocItemStatus, extra?: Partial<DocItem>) => Promise<void>
  update: (id: string, patch: Partial<DocItem>) => Promise<{ error?: string }>
  toast: Props['toast']
}

function PracticePanel({ op, items, tplStatus, onClose, onGenerate, setStatus, update, toast }: PanelProps) {
  const tplMap: Record<string, { tone: Tone; text: string }> = {
    signed: { tone: 'green', text: 'Firmato' },
    archived: { tone: 'green', text: 'Archiviato' },
    generated: { tone: 'amber', text: 'Generato, manca la firma' },
    draft: { tone: 'amber', text: 'Bozza' },
    missing: { tone: 'red', text: 'Mancante' },
  }
  return (
    <div style={{ padding: 16, background: 'var(--bg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 700 }}>{op.property_name}</div>
          <div style={{ fontSize: 11, color: 'var(--g)' }}>{op.type} · {op.address ?? ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-secondary btn-sm" onClick={onGenerate}>Genera checklist</button>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Chiudi</button>
        </div>
      </div>

      {STAGES.map(stage => {
        const tpls = TEMPLATE_DOCS.filter(t => t.stage === stage && (op.type === 'vendita' || !SELL_TEMPLATES.has(t.key)))
        const extras = items.filter(i => i.stage === stage)
        if (!tpls.length && !extras.length) return null
        return (
          <div key={stage} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ld)', marginBottom: 6 }}>{STAGE_LABELS[stage]}</div>
            <table>
              <tbody>
                {tpls.map(t => {
                  const s = tplMap[tplStatus(t.templateId)] ?? tplMap.missing
                  return (
                    <tr key={t.key}>
                      <td style={{ whiteSpace: 'normal' }}>{t.label}{t.critical && <span style={{ color: 'var(--red)', fontWeight: 700 }}> · obbligatorio a tutela dell'agenzia</span>}</td>
                      <td><Pill tone={s.tone}>{s.text}</Pill></td>
                      <td style={{ fontSize: 11, color: 'var(--g)' }}>Si gestisce dalla scheda documenti dell'operazione</td>
                    </tr>
                  )
                })}
                {extras.map(i => (
                  <tr key={i.id}>
                    <td style={{ whiteSpace: 'normal' }}>{i.label}{i.verified_at && <span style={{ color: 'var(--g)', fontSize: 11 }}> · verificato il {fmtDate(i.verified_at)}</span>}</td>
                    <td><Pill tone={STATUS_TONE[i.status]}>{STATUS_LABEL[i.status]}</Pill></td>
                    <td style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <FileCell path={i.digital_path} prefix={`operations/${op.id}/admin`}
                        onUploaded={async p => { await setStatus(i, 'caricato', { digital_path: p }) }} />
                      <label style={{ fontSize: 11, display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input type="checkbox" checked={i.paper_filed}
                          onChange={async e => { const r = await update(i.id, { paper_filed: e.target.checked }); if (r.error) toast(r.error, 'error') }} />
                        Cartaceo in archivio
                      </label>
                      {i.status === 'caricato' && <button className="btn btn-success btn-sm" onClick={() => setStatus(i, 'verificato')}>Verifica</button>}
                      {i.status !== 'non_applicabile'
                        ? <button className="btn btn-secondary btn-sm" onClick={() => setStatus(i, 'non_applicabile')}>N/A</button>
                        : <button className="btn btn-secondary btn-sm" onClick={() => setStatus(i, 'mancante')}>Ripristina</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
      {items.length === 0 && <div style={{ fontSize: 12, color: 'var(--g)' }}>Nessun documento aggiuntivo: premi "Genera checklist" per aggiungere quelli standard.</div>}
    </div>
  )
}
