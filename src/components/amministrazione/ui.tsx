import { useRef, useState, type ReactNode } from 'react'
import { uploadAdmFile, openAdmFile } from '../../hooks/useAdm'

export type Tone = 'red' | 'amber' | 'green' | 'teal' | 'g'

const TONE: Record<Tone, { color: string; bg: string }> = {
  red: { color: 'var(--red)', bg: 'rgba(192,57,43,0.12)' },
  amber: { color: 'var(--amber)', bg: 'rgba(183,121,31,0.14)' },
  green: { color: 'var(--green)', bg: 'rgba(29,143,95,0.14)' },
  teal: { color: 'var(--teal)', bg: 'rgba(31,111,139,0.14)' },
  g: { color: 'var(--g)', bg: 'rgba(120,120,120,0.14)' },
}

export function Pill({ tone = 'g', children }: { tone?: Tone; children: ReactNode }) {
  const t = TONE[tone]
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
      color: t.color, background: t.bg, whiteSpace: 'nowrap',
    }}>{children}</span>
  )
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={wide ? { maxWidth: 720 } : undefined} onClick={e => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: 'var(--g)', marginTop: 3 }}>{hint}</div>}
    </div>
  )
}

export function Head({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
      <div>
        <div className="section-heading" style={{ margin: 0 }}>{title}</div>
        {hint && <p style={{ fontSize: 12, color: 'var(--g)', margin: '4px 0 0 0', maxWidth: 760 }}>{hint}</p>}
      </div>
      {action}
    </div>
  )
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="empty-state" style={{ padding: 32 }}>
      <div style={{ fontSize: 13, color: 'var(--g)' }}>{text}</div>
    </div>
  )
}

export function Kpi({ label, value, tone, onClick }: { label: string; value: ReactNode; tone?: 'red' | 'amber' | 'green' | 'teal'; onClick?: () => void }) {
  return (
    <div className="kpi-card" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <div className={`kpi-value ${tone ?? ''}`}>{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  )
}

/** Avviso quando le tabelle adm_* non esistono ancora (script SQL non applicato). */
export function SetupNotice({ error }: { error: string | null }) {
  if (!error) return null
  const missing = /relation|does not exist|schema cache|Could not find/i.test(error)
  return (
    <div style={{
      background: 'rgba(183,121,31,0.12)', border: '1px solid var(--amber)', borderRadius: 8,
      padding: '10px 14px', marginBottom: 14, fontSize: 12, color: 'var(--amber)',
    }}>
      {missing
        ? 'Le tabelle del modulo non sono ancora nel database. Applica supabase/2026-11-12_amministrazione.sql su Supabase e ricarica.'
        : `Errore di caricamento: ${error}`}
    </div>
  )
}

/** Pulsante carica + apri allegato (bucket privato documents). */
export function FileCell({ path, prefix, onUploaded, label = 'Carica' }: {
  path: string | null
  prefix: string
  onUploaded: (path: string) => void | Promise<void>
  label?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const pick = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setErr(null)
    const res = await uploadAdmFile(prefix, file)
    if (res.error) setErr(res.error)
    else if (res.path) await onUploaded(res.path)
    setBusy(false)
    if (ref.current) ref.current.value = ''
  }

  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      {path && (
        <button className="btn btn-secondary btn-sm" onClick={() => openAdmFile(path)}>Apri</button>
      )}
      <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? '...' : path ? 'Sostituisci' : label}
      </button>
      <input ref={ref} type="file" style={{ display: 'none' }} onChange={e => pick(e.target.files?.[0])} />
      {err && <span style={{ color: 'var(--red)', fontSize: 11 }}>{err}</span>}
    </span>
  )
}
