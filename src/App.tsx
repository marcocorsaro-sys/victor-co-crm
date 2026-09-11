import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useProfiles } from './hooks/useProfiles'
import Layout from './components/Layout'
import Login from './pages/Login'
import AgentDashboard from './pages/AgentDashboard'
import AdminDashboard from './pages/AdminDashboard'
import AdminOperations from './pages/AdminOperations'
import AdminUsers from './pages/AdminUsers'
import AdminClients from './pages/AdminClients'
import AdminActivity from './pages/AdminActivity'
import AdminAgents from './pages/AdminAgents'
import ClientDetail from './pages/ClientDetail'
import AdminAgentDetail from './pages/AdminAgentDetail'
import AgentValuations from './pages/AgentValuations'
import AgentClients from './pages/AgentClients'
import AdminValutazioni from './pages/AdminValutazioni'
import AdminIntelligence from './pages/AdminIntelligence'
import AdminAI from './pages/AdminAI'
import AdminWeekly from './pages/AdminWeekly'
import AdminMercato from './pages/AdminMercato'
import AdminAgencySettings from './pages/AdminAgencySettings'
import CalendarPage from './pages/CalendarPage'
import Settings from './pages/Settings'
import Vademecum from './pages/Vademecum'
import type { Profile } from './lib/supabase'

function App() {
  const { user, profile, loading, signIn, signOut } = useAuth()
  const { agents } = useProfiles()
  const [viewAsAgent, setViewAsAgent] = useState<Profile | null>(null)

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
      }}>
        <div style={{
          fontFamily: "'Montserrat', sans-serif",
          color: 'var(--lime)',
          fontSize: 16,
        }}>
          // VICTOR&CO · CRM
        </div>
      </div>
    )
  }

  if (!user || !profile) {
    return <Login onLogin={signIn} />
  }

  const isRealAdmin = profile.role === 'admin'
  const isViewingAsAgent = isRealAdmin && viewAsAgent !== null
  const effectiveProfile = isViewingAsAgent ? viewAsAgent : profile
  const isAdmin = isRealAdmin && !isViewingAsAgent

  return (
    <BrowserRouter>
      <Layout
        profile={effectiveProfile}
        onLogout={signOut}
        viewAsAgent={viewAsAgent}
        onSwitchView={isRealAdmin ? (agent) => setViewAsAgent(agent) : undefined}
        onExitAgentView={() => setViewAsAgent(null)}
        agents={isRealAdmin ? agents : undefined}
      >
        {/* Impersonate banner */}
        {isViewingAsAgent && (
          <div style={{
            background: 'rgba(183,121,31,0.15)',
            border: '1px solid var(--amber)',
            borderRadius: 8,
            padding: '8px 16px',
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: 13, color: 'var(--amber)' }}>
              Stai visualizzando come <strong>{viewAsAgent.full_name}</strong> (vista agente)
            </span>
            <button className="btn btn-secondary btn-sm" onClick={() => setViewAsAgent(null)}
              style={{ fontSize: 11 }}>
              ← Torna ad Admin
            </button>
          </div>
        )}

        <Routes>
          {isAdmin ? (
            <>
              <Route path="/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/operations" element={<AdminOperations />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/clients" element={<AdminClients />} />
              <Route path="/admin/activity" element={<AdminActivity />} />
              <Route path="/admin/agents" element={<AdminAgents />} />
              <Route path="/admin/agent/:agentId" element={<AdminAgentDetail />} />
              <Route path="/admin/client/:clientId" element={<ClientDetail />} />
              <Route path="/admin/valutazioni" element={<AdminValutazioni />} />
              <Route path="/admin/intelligence" element={<AdminIntelligence />} />
              <Route path="/admin/weekly" element={<AdminWeekly />} />
              <Route path="/admin/mercato" element={<AdminMercato />} />
              <Route path="/admin/ai" element={<AdminAI />} />
              <Route path="/admin/agency" element={<AdminAgencySettings />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/vademecum" element={<Vademecum />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </>
          ) : (
            <>
              <Route path="/agent" element={<AgentDashboard profile={effectiveProfile} />} />
              <Route path="/agent/valutazioni" element={<AgentValuations profile={effectiveProfile} />} />
              <Route path="/agent/clients" element={<AgentClients profile={effectiveProfile} />} />
              <Route path="/admin/client/:clientId" element={<ClientDetail />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/vademecum" element={<Vademecum />} />
              <Route path="*" element={<Navigate to="/agent" replace />} />
            </>
          )}
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
