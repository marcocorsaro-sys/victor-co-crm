import { useMemo, useState } from 'react'
import type { DocumentTemplate, FieldDef } from '../../lib/documents/types'
import { describeFieldSource } from '../../lib/documents/dataResolver'
import type { ResolverContext } from '../../lib/documents/dataResolver'
import { resolveTemplateData } from '../../lib/documents/dataResolver'

type Props = {
  template: DocumentTemplate
  ctx: ResolverContext
  /** Valori già inseriti manualmente (override). */
  initialOverrides: Record<string, unknown>
  onCancel: () => void
  /** Salva gli override; il caller persiste in DB. */
  onSave: (overrides: Record<string, unknown>) => Promise<void> | void
  /** Salva e genera PDF. */
  onSaveAndGenerate: (overrides: Record<string, unknown>) => Promise<void> | void
}

/**
 * Form auto-generato dai field defs del template.
 * - Mostra il valore auto-resolved (se c'è) come placeholder
 * - L'utente può sovrascrivere a mano (l'override prevale e viene salvato in JSONB)
 * - Sezioni raggruppate, campi mancanti evidenziati
 */
export default function DocumentForm({ template, ctx, initialOverrides, onCancel, onSave, onSaveAndGenerate }: Props) {
  const [overrides, setOverrides] = useState<Record<string, unknown>>(initialOverrides || {})
  const [saving, setSaving] = useState(false)

  // Calcolo i valori auto-resolved (senza override)
  const autoResolved = useMemo(
    () => resolveTemplateData(template, { ...ctx, manualOverrides: {} }),
    [template, ctx]
  )

  const setField = (key: string, value: unknown) => {
    setOverrides(prev => {
      const next = { ...prev }
      if (value === '' || value === null || value === undefined) {
        delete next[key]
      } else {
        next[key] = value
      }
      return next
    })
  }

  const valueFor = (field: FieldDef): unknown => {
    if (Object.prototype.hasOwnProperty.call(overrides, field.key)) return overrides[field.key]
    return autoResolved[field.key]
  }

  // Raggruppa i campi per sezione
  const sections = useMemo(() => {
    const map = new Map<string, FieldDef[]>()
    for (const f of template.fields) {
      const sec = f.section || 'Altri dati'
      if (!map.has(sec)) map.set(sec, [])
      map.get(sec)!.push(f)
    }
    return Array.from(map.entries())
  }, [template])

  const renderField = (field: FieldDef) => {
    const v = valueFor(field)
    const auto = autoResolved[field.key]
    const isOverridden = Object.prototype.hasOwnProperty.call(overrides, field.key)
    const isAutoFilled = !isOverridden && auto !== undefined && auto !== null && auto !== ''
    const isMissing = field.required && (v === undefined || v === null || v === '')

    const labelEl = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>{field.label}</span>
        {field.required && <span style={{ color: 'var(--red)' }}>*</span>}
        {isAutoFilled && (
          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(31,111,139,0.15)', color: 'var(--teal)' }}
            title={describeFieldSource(field.source)}>auto</span>
        )}
        {isOverridden && (
          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(183,121,31,0.15)', color: 'var(--amber)' }}>override</span>
        )}
        {isMissing && (
          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(192,57,43,0.15)', color: 'var(--red)' }}>mancante</span>
        )}
      </div>
    )

    const baseProps = {
      className: 'form-input',
      value: (v as string) ?? '',
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setField(field.key, e.target.value),
      style: isMissing ? { borderColor: 'var(--red)' } : undefined,
    }

    let input: React.ReactNode
    switch (field.type) {
      case 'textarea':
        input = <textarea {...baseProps} rows={3} />
        break
      case 'date':
        input = <input type="date" {...baseProps} />
        break
      case 'eur':
      case 'number':
        input = <input type="number" step={field.type === 'eur' ? '0.01' : 'any'} {...baseProps}
          value={typeof v === 'number' ? v : (v as string) ?? ''} />
        break
      case 'percent':
        input = <input type="number" step="0.01" min="0" max="100" {...baseProps}
          value={typeof v === 'number' ? v : (v as string) ?? ''} />
        break
      case 'checkbox':
        input = (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 6 }}>
            <input type="checkbox" checked={Boolean(v)}
              onChange={e => setField(field.key, e.target.checked)} />
            <span style={{ fontSize: 12, color: 'var(--g)' }}>{Boolean(v) ? 'Sì' : 'No'}</span>
          </label>
        )
        break
      case 'select':
        input = (
          <select className="form-select" value={(v as string) ?? ''}
            onChange={e => setField(field.key, e.target.value)}
            style={isMissing ? { borderColor: 'var(--red)' } : undefined}>
            <option value="">— seleziona —</option>
            {(field.options || []).map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )
        break
      default:
        input = <input type="text" {...baseProps} />
    }

    return (
      <div key={field.key} className="form-group" style={{ marginBottom: 12 }}>
        <label className="form-label" style={{ fontSize: 11 }}>{labelEl}</label>
        {input}
        {field.hint && <div style={{ fontSize: 10, color: 'var(--g)', marginTop: 2 }}>{field.hint}</div>}
      </div>
    )
  }

  const handleSave = async () => {
    setSaving(true)
    await onSave(overrides)
    setSaving(false)
  }
  const handleSaveAndGenerate = async () => {
    setSaving(true)
    await onSaveAndGenerate(overrides)
    setSaving(false)
  }

  const missingRequired = template.fields.filter(f =>
    f.required && (valueFor(f) === undefined || valueFor(f) === null || valueFor(f) === '')
  ).length

  return (
    <div>
      <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--s3)', borderRadius: 6, fontSize: 11, color: 'var(--gl)' }}>
        ⓘ I campi <span style={{ color: 'var(--teal)' }}>auto</span> sono pre-popolati da scheda cliente / operazione / agenzia.
        Puoi sovrascrivere a mano (diventa <span style={{ color: 'var(--amber)' }}>override</span>).
        I campi <span style={{ color: 'var(--red)' }}>mancanti</span> obbligatori vanno compilati prima di generare il PDF.
      </div>

      {sections.map(([sec, fields]) => (
        <div key={sec} style={{ marginBottom: 16 }}>
          <div style={{
            fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: 'var(--ld)',
            textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8,
          }}>
            // {sec}
          </div>
          {fields.map(renderField)}
        </div>
      ))}

      <div style={{
        display: 'flex', gap: 8, justifyContent: 'flex-end',
        paddingTop: 12, borderTop: '1px solid var(--bd)', marginTop: 16,
      }}>
        {missingRequired > 0 && (
          <span style={{ fontSize: 11, color: 'var(--red)', alignSelf: 'center', marginRight: 'auto' }}>
            {missingRequired} {missingRequired === 1 ? 'campo' : 'campi'} obbligatori mancanti
          </span>
        )}
        <button className="btn btn-secondary" onClick={onCancel} disabled={saving}>Annulla</button>
        <button className="btn btn-secondary" onClick={handleSave} disabled={saving}>
          {saving ? 'Salvataggio…' : '💾 Salva bozza'}
        </button>
        <button className="btn btn-primary" onClick={handleSaveAndGenerate}
          disabled={saving || missingRequired > 0}
          title={missingRequired > 0 ? 'Compila i campi obbligatori' : 'Salva e genera il PDF'}>
          {saving ? 'Generazione…' : '📄 Genera PDF'}
        </button>
      </div>
    </div>
  )
}
