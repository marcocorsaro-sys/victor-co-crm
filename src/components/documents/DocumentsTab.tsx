import { useRef, useState, useMemo } from 'react'
import type { Client, OperationWithAgent, OperationDocument, Profile } from '../../lib/supabase'
import { supabase } from '../../lib/supabase'
import { useOperationDocuments } from '../../hooks/useOperationDocuments'
import { useAgencySettings } from '../../hooks/useAgencySettings'
import { useClients } from '../../hooks/useClients'
import { useProfiles } from '../../hooks/useProfiles'
import { getTemplatesForOperation } from '../../lib/documents/templates'
import type { DocumentTemplate } from '../../lib/documents/types'
import { countMissingRequired, type ResolverContext } from '../../lib/documents/dataResolver'
import { renderDocument } from '../../lib/documents/renderers'
import { downloadPdf } from '../../lib/documents/pdfBuilder'
import { formatDate } from '../../lib/calculations'
import DocumentForm from './DocumentForm'

type Props = { operation: OperationWithAgent }

const statusBadge = (status: string) => {
  const map: Record<string, { color: string; bg: string; label: string }> = {
    missing: { color: 'var(--g)', bg: 'rgba(120,120,120,0.15)', label: 'Mancante' },
    draft: { color: 'var(--amber)', bg: 'rgba(245,158,11,0.15)', label: 'Bozza' },
    generated: { color: 'var(--teal)', bg: 'rgba(20,184,166,0.15)', label: 'Generato' },
    signed: { color: 'var(--green)', bg: 'rgba(34,197,94,0.15)', label: '✓ Firmato' },
    archived: { color: 'var(--g)', bg: 'rgba(120,120,120,0.1)', label: 'Archiviato' },
  }
  const cfg = map[status] || map.missing
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
      color: cfg.color, background: cfg.bg, whiteSpace: 'nowrap',
    }}>{cfg.label}</span>
  )
}

export default function DocumentsTab({ operation }: Props) {
  const { documents, loading, findOrCreate, updateDoc, uploadSignedPdf, getSignedUrl } = useOperationDocuments(operation.id)
  const { settings: agency } = useAgencySettings()
  const { clients } = useClients()
  const { agents } = useProfiles()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingUpload = useRef<{ template: DocumentTemplate; doc: OperationDocument } | null>(null)
  const [editing, setEditing] = useState<{ template: DocumentTemplate; doc: OperationDocument } | null>(null)

  const agent: Profile | null = useMemo(() => {
    return agents.find(a => a.id === operation.agent_id) || (operation.profiles as Profile | undefined) || null
  }, [agents, operation])

  // Cliente collegato all'operazione (per buyer/seller)
  // Per ora usiamo `client_id` se settato, altrimenti null
  const linkedClient: Client | null = useMemo(() => {
    if (!operation.client_id) return null
    return clients.find(c => c.id === operation.client_id) || null
  }, [clients, operation.client_id])

  // Per l'acquirente, se il cliente collegato è un venditore, cerchiamo un cliente acquirente
  // (semplificazione MVP: per ora assumiamo che linkedClient è il venditore, e l'acquirente è uno fittizio
  //  costruito dai campi buyer_first_name/last_name dell'operation)
  const buyerClient: Client | null = useMemo(() => {
    // se l'operazione ha buyer_first_name/last_name ma nessun client legato, costruiamo un Client minimale
    if (operation.buyer_first_name || operation.buyer_last_name) {
      return {
        id: 'inline-buyer',
        first_name: operation.buyer_first_name || '',
        last_name: operation.buyer_last_name || '',
        name: operation.buyer_name || `${operation.buyer_first_name || ''} ${operation.buyer_last_name || ''}`.trim(),
        phone: null, email: null, type: 'acquirente',
        address: null, notes: null, birth_date: null,
        company: null, source: null, linked_agent_id: null,
        date_added: '', updated_at: '',
        luogo_nascita: null, provincia_nascita: null, nazionalita: 'Italiana',
        professione: null, codice_fiscale: null,
        citta: null, cap: null, provincia: null,
        documento_tipo: null, documento_numero: null,
        documento_rilasciato_da: null, documento_rilascio_date: null, documento_scadenza: null,
        pep: false, pep_carica: null, provenienza_fondi: null,
        scopo_operazione: null, scopo_operazione_altro: null,
        privacy_diffusione_consenso: null, privacy_marketing_consenso: null,
        segment: null, tier: null, preferred_channel: null, rogito_date: null,
        contact_cadence_months: 12, last_contact_at: null, snooze_until: null, do_not_contact: false,
      }
    }
    return null
  }, [operation])

  const sellerClient: Client | null = useMemo(() => {
    // Se il cliente collegato è "venditore" o "entrambi", lo usiamo
    if (linkedClient && (linkedClient.type === 'venditore' || linkedClient.type === 'entrambi')) return linkedClient
    return null
  }, [linkedClient])

  const hasBuyer = !!buyerClient
  const hasSeller = !!sellerClient
  const templates = getTemplatesForOperation(operation.type, hasBuyer || true, hasSeller || true)

  const docByTemplate = (template: DocumentTemplate) =>
    documents.find(d => d.template_id === template.id && d.party === template.party)

  const buildContext = (template: DocumentTemplate, manualOverrides: Record<string, unknown> = {}): ResolverContext => {
    const client = template.party === 'buyer' ? buyerClient : template.party === 'seller' ? sellerClient : null
    return { operation, agent, agency, client, manualOverrides }
  }

  // ── Azioni ──────────────────────────────────────────────────────────────

  const handleEdit = async (template: DocumentTemplate) => {
    const doc = await findOrCreate(template.id, template.party)
    if (!doc) return
    setEditing({ template, doc })
  }

  const handleSaveDraft = async (overrides: Record<string, unknown>) => {
    if (!editing) return
    await updateDoc(editing.doc.id, { data: overrides, status: 'draft' })
    setEditing(null)
  }

  const handleGeneratePdf = async (overrides: Record<string, unknown>) => {
    if (!editing) return
    const { template, doc } = editing
    const ctx = buildContext(template, overrides)
    // Risolvi tutti i campi (auto + override)
    const resolved: Record<string, unknown> = {}
    for (const f of template.fields) {
      const v = (Object.prototype.hasOwnProperty.call(overrides, f.key)
        ? overrides[f.key]
        : (() => {
            const tmp: Record<string, unknown> = {}
            for (const ff of template.fields) {
              const src = ff.source
              switch (src.kind) {
                case 'client':
                  if (ctx.client) {
                    const path = src.path.split('.')
                    let cur: unknown = ctx.client
                    for (const p of path) cur = (cur as Record<string, unknown> | null)?.[p]
                    tmp[ff.key] = cur
                  }
                  break
                case 'operation': {
                  const path = src.path.split('.')
                  let cur: unknown = ctx.operation
                  for (const p of path) cur = (cur as Record<string, unknown> | null)?.[p]
                  tmp[ff.key] = cur
                  break
                }
                case 'agent':
                  if (ctx.agent) tmp[ff.key] = (ctx.agent as unknown as Record<string, unknown>)[src.path]
                  break
                case 'agency':
                  if (ctx.agency) tmp[ff.key] = (ctx.agency as unknown as Record<string, unknown>)[src.path]
                  break
                case 'computed':
                  tmp[ff.key] = src.compute === 'today'
                    ? new Date().toISOString().split('T')[0]
                    : ctx.agent?.full_name
                  break
                case 'manual': break
              }
            }
            return tmp[f.key]
          })())
      resolved[f.key] = v
    }

    const bytes = await renderDocument({ template, data: resolved, agency })
    // Upload to Storage
    const path = `operations/${operation.id}/${template.id}_${template.party}_generated.pdf`
    const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' })
    const { error: upErr } = await supabase.storage.from('documents').upload(path, blob, {
      upsert: true, cacheControl: '3600', contentType: 'application/pdf',
    })
    if (upErr) {
      alert(`Errore upload Storage: ${upErr.message}\n\nIl PDF verrà comunque scaricato.`)
    }
    await updateDoc(doc.id, {
      data: overrides, status: upErr ? 'draft' : 'generated',
      pdf_storage_path: upErr ? null : path,
      generated_at: new Date().toISOString(),
    })
    // Download diretto al browser
    downloadPdf(bytes, `${template.id}_${template.party}_${operation.property_name.replace(/[^a-z0-9]/gi, '_')}.pdf`)
    setEditing(null)
  }

  const handleUploadClick = async (template: DocumentTemplate) => {
    const doc = await findOrCreate(template.id, template.party)
    if (!doc) return
    pendingUpload.current = { template, doc }
    fileInputRef.current?.click()
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !pendingUpload.current) return
    const { template, doc } = pendingUpload.current
    pendingUpload.current = null
    await uploadSignedPdf(doc.id, file, template.id, template.party)
  }

  const handleDownload = async (path: string) => {
    const url = await getSignedUrl(path)
    if (url) window.open(url, '_blank')
  }

  const handleRegenerate = async (template: DocumentTemplate, doc: OperationDocument) => {
    setEditing({ template, doc })
  }

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) return <div className="skeleton" style={{ height: 200, borderRadius: 8 }} />

  if (editing) {
    const ctx = buildContext(editing.template)
    const initialOverrides = (editing.doc.data || {}) as Record<string, unknown>
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setEditing(null)}>← Indietro</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--w)' }}>{editing.template.title}</div>
            <div style={{ fontSize: 11, color: 'var(--g)' }}>{editing.template.description}</div>
          </div>
        </div>
        <DocumentForm
          template={editing.template}
          ctx={ctx}
          initialOverrides={initialOverrides}
          onCancel={() => setEditing(null)}
          onSave={handleSaveDraft}
          onSaveAndGenerate={handleGeneratePdf}
        />
      </div>
    )
  }

  const renderRow = (template: DocumentTemplate) => {
    const doc = docByTemplate(template)
    const status = doc?.status || 'missing'
    const ctx = buildContext(template, (doc?.data || {}) as Record<string, unknown>)
    const missing = countMissingRequired(template, ctx)

    return (
      <div key={`${template.id}_${template.party}`} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px', borderBottom: '1px solid var(--bd)', gap: 10,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--w)' }}>{template.title}</div>
          <div style={{ fontSize: 11, color: 'var(--g)', marginTop: 2 }}>{template.description}</div>
          {missing > 0 && status !== 'signed' && (
            <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 2 }}>
              ⚠ {missing} {missing === 1 ? 'campo obbligatorio' : 'campi obbligatori'} mancante/i
            </div>
          )}
          {doc?.generated_at && (
            <div style={{ fontSize: 10, color: 'var(--teal)', marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
              Generato il {formatDate(doc.generated_at)}
            </div>
          )}
          {doc?.signed_at && (
            <div style={{ fontSize: 10, color: 'var(--green)', marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
              Firmato il {formatDate(doc.signed_at)}
            </div>
          )}
        </div>
        <div>{statusBadge(status)}</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {doc?.pdf_storage_path && (
            <button className="btn btn-secondary btn-sm"
              onClick={() => handleDownload(doc.pdf_storage_path!)} title="Apri PDF generato">📥</button>
          )}
          {doc?.pdf_signed_storage_path && (
            <button className="btn btn-secondary btn-sm"
              onClick={() => handleDownload(doc.pdf_signed_storage_path!)} title="Apri PDF firmato">📄</button>
          )}
          <button className="btn btn-primary btn-sm"
            onClick={() => doc ? handleRegenerate(template, doc) : handleEdit(template)} title="Compila e genera">
            ✏ Compila
          </button>
          <button className="btn btn-secondary btn-sm"
            onClick={() => handleUploadClick(template)} title="Carica PDF firmato">⬆</button>
        </div>
      </div>
    )
  }

  const sellerTemplates = templates.filter(t => t.party === 'seller')
  const buyerTemplates = templates.filter(t => t.party === 'buyer')

  return (
    <div>
      <input ref={fileInputRef} type="file" accept="application/pdf" style={{ display: 'none' }}
        onChange={handleFileSelected} />

      {sellerTemplates.length > 0 && (
        <div style={{ marginBottom: 16, background: 'var(--s2)', borderRadius: 8, border: '1px solid var(--bd)' }}>
          <div style={{ padding: '8px 12px', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--ld)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--bd)' }}>
            // Documenti Venditore {!hasSeller && <span style={{ color: 'var(--amber)', textTransform: 'none', marginLeft: 6 }}>(cliente venditore non collegato — i campi dovranno essere inseriti a mano)</span>}
          </div>
          {sellerTemplates.map(renderRow)}
        </div>
      )}

      <div style={{ marginBottom: 16, background: 'var(--s2)', borderRadius: 8, border: '1px solid var(--bd)' }}>
        <div style={{ padding: '8px 12px', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--ld)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--bd)' }}>
          // Documenti Acquirente {!hasBuyer && <span style={{ color: 'var(--amber)', textTransform: 'none', marginLeft: 6 }}>(acquirente non ancora associato)</span>}
        </div>
        {buyerTemplates.map(renderRow)}
      </div>

      <div style={{ fontSize: 11, color: 'var(--g)', marginTop: 12, padding: '8px 12px', background: 'var(--s3)', borderRadius: 6, lineHeight: 1.5 }}>
        💡 <b>Flow</b>: <b>Compila</b> precompila il form da scheda cliente / operazione / agenzia. Modifica i campi mancanti, poi <b>Genera PDF</b>.
        Il PDF viene scaricato sul tuo PC e archiviato sul Storage Supabase. Per i documenti firmati a mano usa <b>⬆</b> per caricare la versione scansionata.
      </div>
    </div>
  )
}
