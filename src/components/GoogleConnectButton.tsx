import type { GoogleIntegration } from '../lib/googleTypes'
import { getGoogleAuthUrl, disconnectGoogle } from '../lib/googleApi'
import { useState } from 'react'

type Props = {
  integration: GoogleIntegration | null
  onStatusChange: () => void
}

export default function GoogleConnectButton({ integration, onStatusChange }: Props) {
  const [loading, setLoading] = useState(false)

  const handleConnect = async () => {
    setLoading(true)
    try {
      const url = await getGoogleAuthUrl()
      window.open(url, '_blank', 'width=500,height=600')
      // Poll for status change
      const interval = setInterval(async () => {
        onStatusChange()
      }, 3000)
      setTimeout(() => clearInterval(interval), 120000)
    } catch (err) {
      alert('Errore nella connessione: ' + (err as Error).message)
    }
    setLoading(false)
  }

  const handleDisconnect = async () => {
    if (!confirm('Disconnettere Google?')) return
    setLoading(true)
    try {
      await disconnectGoogle()
      onStatusChange()
    } catch (err) {
      alert('Errore: ' + (err as Error).message)
    }
    setLoading(false)
  }

  const isConnected = integration?.gmail_connected || integration?.calendar_connected

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {isConnected ? (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {integration?.gmail_connected && (
              <span style={{ background: 'rgba(29,143,95,0.15)', color: 'var(--green)', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                ✓ Gmail
              </span>
            )}
            {integration?.calendar_connected && (
              <span style={{ background: 'rgba(29,143,95,0.15)', color: 'var(--green)', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                ✓ Calendar
              </span>
            )}
          </div>
          <button className="btn btn-danger btn-sm" onClick={handleDisconnect} disabled={loading}>
            Disconnetti
          </button>
        </>
      ) : (
        <button className="btn btn-primary" onClick={handleConnect} disabled={loading}>
          {loading ? 'Connessione...' : 'Connetti Google'}
        </button>
      )}
    </div>
  )
}
