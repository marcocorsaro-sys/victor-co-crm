import type { ReactNode } from 'react'
import TopBar from './TopBar'
import MobileNav from './MobileNav'
import type { Profile } from '../lib/supabase'

type Props = {
  profile: Profile
  onLogout: () => void
  children: ReactNode
  viewAsAgent?: Profile | null
  onSwitchView?: (agent: Profile | null) => void
  onExitAgentView?: () => void
  agents?: Profile[]
}

export default function Layout({ profile, onLogout, children, viewAsAgent, onSwitchView, onExitAgentView, agents }: Props) {
  return (
    <div className="app-layout">
      <TopBar
        profile={profile}
        onLogout={onLogout}
        viewAsAgent={viewAsAgent}
        onSwitchView={onSwitchView}
        onExitAgentView={onExitAgentView}
        agents={agents}
      />
      <div className="main-content">
        {children}
      </div>
      <MobileNav profile={viewAsAgent || profile} />
    </div>
  )
}
