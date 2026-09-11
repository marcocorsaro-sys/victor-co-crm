import { useState, useEffect } from 'react'
import { useAgencySettings } from '../hooks/useAgencySettings'
import type { AgencySettings } from '../lib/supabase'
import ToastContainer from '../components/ToastContainer'
import { useToast } from '../hooks/useToast'

/**
 * Pagina admin per configurare i dati dell'agenzia che vengono usati
 * per pre-popolare la modulistica FIAIP (intestazione PDF, sede, REA, polizza).
 */
export default function AdminAgencySettings() {
  const { settings, loading, update } = useAgencySettings()
  const [form, setForm] = useState<Partial<AgencySettings>>({})
  const [saving, setSaving] = useState(false)
  const { toasts, addToast } = useToast()

  useEffect(() => {
    if (settings) setForm(settings)
  }, [settings])

  const set = <K extends keyof AgencySettings>(key: K, value: AgencySettings[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    const { error } = await update(form)
    setSaving(false)
    if (error) addToast(`Errore: ${error}`, 'error')
    else addToast('Impostazioni agenzia salvate', 'success')
  }

  const sectionTitle = (text: string) => (
    <div style={{
      fontFamily: "'Montserrat', sans-serif",
      fontSize: 11,
      color: 'var(--ld)',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      marginBottom: 12,
      marginTop: 24,
    }}>
      // {text}
    </div>
  )

  if (loading) return <div className="skeleton" style={{ height: 400, borderRadius: 12 }} />

  return (
    <div>
      <ToastContainer toasts={toasts} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div className="section-heading" style={{ margin: 0 }}>Impostazioni Agenzia</div>
          <p style={{ fontSize: 12, color: 'var(--g)', margin: '4px 0 0 0' }}>
            Questi dati vengono usati per pre-popolare la modulistica FIAIP (Privacy, Antiriciclaggio, Incarico, Proposta, ecc.).
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Salvataggio…' : 'Salva'}
        </button>
      </div>

      <div style={{ background: 'var(--s1)', borderRadius: 12, padding: 20, border: '1px solid var(--bd)' }}>
        {sectionTitle('Identità')}
        <div className="form-group">
          <label className="form-label">Ragione sociale</label>
          <input className="form-input" value={form.full_name || ''}
            onChange={e => set('full_name', e.target.value)} placeholder="Victor & Co Real Estate S.r.l." />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Partita IVA</label>
            <input className="form-input" value={form.partita_iva || ''}
              onChange={e => set('partita_iva', e.target.value)} placeholder="02772620031" />
          </div>
          <div className="form-group">
            <label className="form-label">Codice Fiscale</label>
            <input className="form-input" value={form.codice_fiscale || ''}
              onChange={e => set('codice_fiscale', e.target.value)} placeholder="02772620031" />
          </div>
        </div>

        {sectionTitle('Sede legale')}
        <div className="form-group">
          <label className="form-label">Indirizzo</label>
          <input className="form-input" value={form.sede_legale_via || ''}
            onChange={e => set('sede_legale_via', e.target.value)} placeholder="Via Solari 11" />
        </div>
        <div className="form-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">CAP</label>
            <input className="form-input" value={form.sede_legale_cap || ''}
              onChange={e => set('sede_legale_cap', e.target.value)} placeholder="20144" />
          </div>
          <div className="form-group" style={{ flex: 2 }}>
            <label className="form-label">Città</label>
            <input className="form-input" value={form.sede_legale_citta || ''}
              onChange={e => set('sede_legale_citta', e.target.value)} placeholder="Milano" />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Provincia</label>
            <input className="form-input" value={form.sede_legale_provincia || ''}
              onChange={e => set('sede_legale_provincia', e.target.value)} placeholder="MI" maxLength={2} />
          </div>
        </div>

        {sectionTitle('Sede operativa (se diversa)')}
        <div className="form-group">
          <label className="form-label">Indirizzo</label>
          <input className="form-input" value={form.sede_operativa_via || ''}
            onChange={e => set('sede_operativa_via', e.target.value)} placeholder="Baluardo Partigiani 11" />
        </div>
        <div className="form-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">CAP</label>
            <input className="form-input" value={form.sede_operativa_cap || ''}
              onChange={e => set('sede_operativa_cap', e.target.value)} placeholder="28100" />
          </div>
          <div className="form-group" style={{ flex: 2 }}>
            <label className="form-label">Città</label>
            <input className="form-input" value={form.sede_operativa_citta || ''}
              onChange={e => set('sede_operativa_citta', e.target.value)} placeholder="Novara" />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Provincia</label>
            <input className="form-input" value={form.sede_operativa_provincia || ''}
              onChange={e => set('sede_operativa_provincia', e.target.value)} placeholder="NO" maxLength={2} />
          </div>
        </div>

        {sectionTitle('Contatti')}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Telefono</label>
            <input className="form-input" value={form.telefono || ''}
              onChange={e => set('telefono', e.target.value)} placeholder="+39 ..." />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={form.email || ''}
              onChange={e => set('email', e.target.value)} placeholder="info@victorco..." />
          </div>
          <div className="form-group">
            <label className="form-label">PEC</label>
            <input className="form-input" type="email" value={form.pec || ''}
              onChange={e => set('pec', e.target.value)} placeholder="victoreco.srl@pec.it" />
          </div>
        </div>

        {sectionTitle('Camera di Commercio')}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">CCIAA di</label>
            <input className="form-input" value={form.camera_commercio || ''}
              onChange={e => set('camera_commercio', e.target.value)} placeholder="Novara" />
          </div>
          <div className="form-group">
            <label className="form-label">REA n°</label>
            <input className="form-input" value={form.rea || ''}
              onChange={e => set('rea', e.target.value)} placeholder="315422" />
          </div>
          <div className="form-group">
            <label className="form-label">Data iscrizione</label>
            <input className="form-input" type="date" value={form.rea_data_iscrizione || ''}
              onChange={e => set('rea_data_iscrizione', e.target.value || null)} />
          </div>
          <div className="form-group">
            <label className="form-label">Protocollo deposito</label>
            <input className="form-input" value={form.rea_protocollo || ''}
              onChange={e => set('rea_protocollo', e.target.value)} />
          </div>
        </div>

        {sectionTitle('Iscrizione FIAIP')}
        <div className="form-group">
          <label className="form-label">N° iscrizione FIAIP (Federazione Italiana Agenti Immobiliari Professionali)</label>
          <input className="form-input" value={form.iscrizione_fiaip || ''}
            onChange={e => set('iscrizione_fiaip', e.target.value)} placeholder="es. 12345" />
        </div>

        {sectionTitle('Polizza RC professionale (art. 18 L. 57/2001)')}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Compagnia assicurativa</label>
            <input className="form-input" value={form.polizza_compagnia || ''}
              onChange={e => set('polizza_compagnia', e.target.value)} placeholder="es. UnipolSai" />
          </div>
          <div className="form-group">
            <label className="form-label">Numero polizza</label>
            <input className="form-input" value={form.polizza_numero || ''}
              onChange={e => set('polizza_numero', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Scadenza polizza</label>
            <input className="form-input" type="date" value={form.polizza_scadenza || ''}
              onChange={e => set('polizza_scadenza', e.target.value || null)} />
          </div>
        </div>

        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--bd)', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvataggio…' : 'Salva impostazioni'}
          </button>
        </div>
      </div>
    </div>
  )
}
