import { useState } from 'react'

type Props = {
  onLogin: (email: string, password: string) => Promise<any>
}

export default function Login({ onLogin }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email || !password) {
      setError('Inserisci email e password')
      return
    }
    setLoading(true)
    const err = await onLogin(email, password)
    setLoading(false)
    if (err) {
      setError('Credenziali non valide')
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-logo"><img src="/brand/logo-navy.png" alt="Victor&Co Real Estate" style={{ height: 72, display: "block", margin: "0 auto" }} /></div>
        <div className="login-subtitle">CRM Immobiliare</div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className={`form-input ${error ? 'error' : ''}`}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@victorco.it"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className={`form-input ${error ? 'error' : ''}`}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '10px 16px' }}
            disabled={loading}
          >
            {loading ? 'Accesso...' : 'Accedi'}
          </button>
        </form>
      </div>
    </div>
  )
}
