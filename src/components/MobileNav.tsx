import { useEffect, useState, type ReactElement } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import type { Profile } from '../lib/supabase'

type Item = { to: string; label: string; icon: string; external?: boolean }

const ICONS: Record<string, ReactElement> = {
  home: <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  ops: <path d="M4 5h16v4H4zM4 11h16v4H4zM4 17h10v2H4z" />,
  users: <path d="M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zm-4 6c-4 0-8 2-8 4v1h16v-1c0-2-4-4-8-4z" />,
  pin: <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />,
  cal: <path d="M7 2v2H4a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-3V2h-2v2H9V2zM5 9h14v10H5z" />,
  more: <path d="M5 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />,
  euro: <path d="M15 18.5A6.5 6.5 0 0 1 8.7 14H14v-2H8.2a6.6 6.6 0 0 1 0-1H14V9H8.7A6.5 6.5 0 0 1 15 4.5c1.4 0 2.6.4 3.6 1.1l1.2-1.6A8.5 8.5 0 0 0 6.6 9H4v2h2.1a8.7 8.7 0 0 0 0 1H4v2h2.6a8.5 8.5 0 0 0 13.2 5l-1.2-1.6c-1 .7-2.2 1.1-3.6 1.1z" />,
}

function Icon({ name }: { name: string }) {
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">{ICONS[name] || ICONS.more}</svg>
}

export default function MobileNav({ profile }: { profile: Profile }) {
  const isAdmin = profile.role === 'admin'
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  useEffect(() => { setOpen(false) }, [loc.pathname])

  const primary: Item[] = isAdmin
    ? [
        { to: '/dashboard', label: 'Dashboard', icon: 'home' },
        { to: '/admin/operations', label: 'Operazioni', icon: 'ops' },
        { to: '/admin/clients', label: 'Clienti', icon: 'users' },
        { to: '/monitor', label: 'Monitor', icon: 'pin' },
      ]
    : [
        { to: '/agent', label: 'Operazioni', icon: 'ops' },
        { to: '/agent/clients', label: 'Clienti', icon: 'users' },
        { to: '/monitor', label: 'Monitor', icon: 'pin' },
        { to: '/calendar', label: 'Calendario', icon: 'cal' },
      ]
  const more: Item[] = isAdmin
    ? [
        { to: '/admin/agents', label: 'Agenti', icon: 'users' },
        { to: '/admin/valutazioni', label: 'Valutazioni', icon: 'euro' },
        { to: '/admin/amministrazione', label: 'Amministrazione', icon: 'ops' },
        { to: '/admin/intelligence', label: 'Intelligence', icon: 'more' },
        { to: '/admin/talent', label: 'Talent', icon: 'users' },
        { to: '/admin/weekly', label: 'Settimane', icon: 'cal' },
        { to: '/admin/mercato', label: 'Mercato', icon: 'euro' },
        { to: '/admin/ai', label: 'AI', icon: 'more' },
        { to: '/calendar', label: 'Calendario', icon: 'cal' },
        { to: '/vademecum', label: 'Vademecum', icon: 'ops' },
        { to: '/settings', label: 'Impostazioni', icon: 'more' },
        { to: 'https://victorco-vale-hub.vercel.app', label: 'Vale Hub ↗', icon: 'more', external: true },
      ]
    : [
        { to: '/agent/valutazioni', label: 'Valutazioni', icon: 'euro' },
        { to: '/vademecum', label: 'Vademecum', icon: 'ops' },
        { to: '/settings', label: 'Impostazioni', icon: 'more' },
        { to: 'https://victorco-vale-hub.vercel.app', label: 'Vale Hub ↗', icon: 'more', external: true },
      ]
  const moreActive = more.some(m => !m.external && loc.pathname.startsWith(m.to))

  return (
    <>
      {open && (
        <div className="mnav-sheet-backdrop" onClick={() => setOpen(false)}>
          <div className="mnav-sheet" onClick={e => e.stopPropagation()}>
            <div className="mnav-sheet-title">Altre sezioni</div>
            <div className="mnav-sheet-grid">
              {more.map(m => m.external
                ? <a key={m.to} href={m.to} target="_blank" rel="noopener noreferrer" className="mnav-sheet-item"><Icon name={m.icon} /><span>{m.label}</span></a>
                : <NavLink key={m.to} to={m.to} className={({ isActive }) => 'mnav-sheet-item' + (isActive ? ' active' : '')}><Icon name={m.icon} /><span>{m.label}</span></NavLink>)}
            </div>
          </div>
        </div>
      )}
      <nav className="mnav" aria-label="Navigazione principale">
        {primary.map(p => (
          <NavLink key={p.to} to={p.to} className={({ isActive }) => 'mnav-item' + (isActive ? ' active' : '')}>
            <Icon name={p.icon} /><span>{p.label}</span>
          </NavLink>
        ))}
        <button type="button" className={'mnav-item' + (moreActive || open ? ' active' : '')} onClick={() => setOpen(o => !o)}>
          <Icon name="more" /><span>Altro</span>
        </button>
      </nav>
    </>
  )
}
