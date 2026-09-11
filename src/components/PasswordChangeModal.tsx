import { useState } from 'react'
import { supabase } from '../lib/supabase'

type Props = {
  open: boolean
  onClose: () => void
}

export default function PasswordChangeModal({ open, onClose }: Props) {
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPw.length < 6) {
      setError('La nuova password deve avere almeno 6 caratteri')
      return
    }
    if (newPw !== confirmPw) {
      setError('Le password non coincidono')
      return
    }

    setLoading(true)
    try {
      // Verify current password by re-signing in
      const { data: sessionData } = await supabase.auth.getSession()
      const email = sessionData.session?.user?.email
      if (!email) {
        setError('Sessione non valida. Effettua nuovamente il login.')
        setLoading(false)
        return
      }

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password: currentPw,
      })
      if (signInErr) {
        setError('La password attuale non è corretta')
        setLoading(false)
        return
      }

      // Update password
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPw,
      })
      if (updateErr) {
        setError(updateErr.message)
        setLoading(false)
        return
      }

      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        setCurrentPw('')
        setNewPw('')
        setConfirmPw('')
        onClose()
      }, 1500)
    } catch {
      setError('Errore imprevisto')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setCurrentPw('')
    setNewPw('')
    setConfirmPw('')
    setError('')
    setSuccess(false)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">Cambia Password</div>

        {success ? (
          <div style={{
            textAlign: 'center',
            padding: '24px 0',
            color: 'var(--green)',
            fontWeight: 600,
          }}>
            Password aggiornata con successo!
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Password attuale *</label>
              <input
                className="form-input"
                type="password"
                value={currentPw}
                onChange={e => { setCurrentPw(e.target.value); setError('') }}
                placeholder="Inserisci la password attuale"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Nuova password *</label>
              <input
                className="form-input"
                type="password"
                value={newPw}
                onChange={e => { setNewPw(e.target.value); setError('') }}
                placeholder="Min. 6 caratteri"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Conferma nuova password *</label>
              <input
                className="form-input"
                type="password"
                value={confirmPw}
                onChange={e => { setConfirmPw(e.target.value); setError('') }}
                placeholder="Ripeti la nuova password"
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(192,57,43,0.12)',
                color: 'var(--red)',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 13,
                marginBottom: 16,
              }}>
                {error}
              </div>
            )}

            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={handleClose}>
                Annulla
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || !currentPw || !newPw || !confirmPw}
              >
                {loading ? 'Salvando...' : 'Aggiorna Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
