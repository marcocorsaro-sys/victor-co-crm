// Registrazione service worker + banner "nuova versione" e "installa app"
import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

export default function PwaPrompts() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [offline, setOffline] = useState(!navigator.onLine)
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null)
  const [update, setUpdate] = useState<((reload?: boolean) => Promise<void>) | null>(null)

  useEffect(() => {
    const u = registerSW({ onNeedRefresh: () => setNeedRefresh(true) })
    setUpdate(() => u)
    const onBip = (e: Event) => { e.preventDefault(); if (!localStorage.getItem('pwa-install-dismissed')) setInstallEvt(e as BeforeInstallPromptEvent) }
    const on = () => setOffline(false), off = () => setOffline(true)
    window.addEventListener('beforeinstallprompt', onBip)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('beforeinstallprompt', onBip); window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const bar: React.CSSProperties = { position: 'fixed', left: 12, right: 12, bottom: 12, zIndex: 9999, background: 'var(--navy)', color: '#fff', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, boxShadow: '0 6px 20px rgba(13,52,71,.25)', fontSize: 13 }
  const btn: React.CSSProperties = { background: '#fff', color: 'var(--navy)', border: 0, borderRadius: 6, padding: '6px 12px', fontWeight: 600, cursor: 'pointer' }
  const ghost: React.CSSProperties = { ...btn, background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,.5)' }

  if (offline) return <div style={{ ...bar, background: 'var(--amber)', color: '#181a20' }}>Sei offline: i dati mostrati sono l'ultima versione salvata.</div>
  if (needRefresh) return (
    <div style={bar}><span>È disponibile una nuova versione del CRM.</span>
      <span style={{ display: 'flex', gap: 8 }}><button style={ghost} onClick={() => setNeedRefresh(false)}>Dopo</button><button style={btn} onClick={() => update?.(true)}>Aggiorna</button></span></div>)
  if (installEvt) return (
    <div style={bar}><span>Installa Victor&Co CRM sul telefono.</span>
      <span style={{ display: 'flex', gap: 8 }}>
        <button style={ghost} onClick={() => { localStorage.setItem('pwa-install-dismissed', '1'); setInstallEvt(null) }}>No</button>
        <button style={btn} onClick={async () => { await installEvt.prompt(); setInstallEvt(null) }}>Installa</button></span></div>)
  return null
}
