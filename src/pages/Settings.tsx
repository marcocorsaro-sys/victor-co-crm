import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useGoogleIntegration } from '../hooks/useGoogleIntegration'
import GoogleConnectButton from '../components/GoogleConnectButton'
import AdminUsers from './AdminUsers'
import AdminActivity from './AdminActivity'
import AdminAgencySettings from './AdminAgencySettings'
import PasswordChangeModal from '../components/PasswordChangeModal'

const TABS_AGENT = ['Profilo', 'Google'] as const
const TABS_ADMIN = ['Profilo', 'Google', 'Agenzia', 'Gestione Utenti', 'Log Attivita'] as const

export default function Settings() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const tabs = isAdmin ? TABS_ADMIN : TABS_AGENT
  const [activeTab, setActiveTab] = useState<string>(tabs[0])
  const { integration, loading: gLoading, refetch } = useGoogleIntegration()
  const [showPwModal, setShowPwModal] = useState(false)

  const mono = { fontFamily: "'Montserrat', sans-serif" } as const

  return (
    <div>
      <div className="section-heading" style={{ marginBottom: 16 }}>Impostazioni</div>

      {/* Tab bar */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        {tabs.map(tab => (
          <button key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </div>

      {/* ─── Profilo ─── */}
      {activeTab === 'Profilo' && profile && (
        <div style={{ maxWidth: 600 }}>
          <div style={{ background: 'var(--s1)', borderRadius: 12, padding: 20, border: '1px solid var(--bd)', marginBottom: 16 }}>
            <div style={{ ...mono, fontSize: 11, color: 'var(--ld)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>
              // Il mio profilo
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div className="avatar" style={{ backgroundColor: profile.color, width: 48, height: 48, fontSize: 16 }}>
                {profile.initials}
              </div>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--w)', fontSize: 16 }}>{profile.full_name}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                  <span className={`role-badge ${profile.role}`}>{profile.role === 'admin' ? 'ADMIN' : 'AGENT'}</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
              {profile.display_email && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--bd)' }}>
                  <span style={{ color: 'var(--g)' }}>Email</span>
                  <span style={{ color: 'var(--w)' }}>{profile.display_email}</span>
                </div>
              )}
              {profile.phone && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--bd)' }}>
                  <span style={{ color: 'var(--g)' }}>Telefono</span>
                  <span style={{ color: 'var(--w)' }}>{profile.phone}</span>
                </div>
              )}
              {profile.contract_type && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--bd)' }}>
                  <span style={{ color: 'var(--g)' }}>Contratto</span>
                  <span style={{ color: 'var(--w)' }}>{profile.contract_type}</span>
                </div>
              )}
            </div>
          </div>

          <div style={{ background: 'var(--s1)', borderRadius: 12, padding: 20, border: '1px solid var(--bd)' }}>
            <div style={{ ...mono, fontSize: 11, color: 'var(--ld)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>
              // Sicurezza
            </div>
            <button className="btn btn-secondary" onClick={() => setShowPwModal(true)}>
              Cambia password
            </button>
          </div>

          <PasswordChangeModal open={showPwModal} onClose={() => setShowPwModal(false)} />
        </div>
      )}

      {/* ─── Google Integration ─── */}
      {activeTab === 'Google' && (
        <div style={{ maxWidth: 600 }}>
          <div style={{ background: 'var(--s1)', borderRadius: 12, padding: 24, border: '1px solid var(--bd)' }}>
            <div style={{ ...mono, fontSize: 11, color: 'var(--ld)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>
              // Integrazione Google
            </div>
            <p style={{ color: 'var(--gl)', fontSize: 13, marginBottom: 16 }}>
              Collega il tuo account Google per sincronizzare Gmail e Google Calendar con il CRM.
            </p>
            {gLoading ? (
              <div className="skeleton skeleton-row" style={{ width: 200 }} />
            ) : (
              <GoogleConnectButton integration={integration} onStatusChange={refetch} />
            )}
            {integration && (
              <div style={{ marginTop: 16, fontSize: 12, color: 'var(--g)' }}>
                <div>Scopes: {integration.scopes?.join(', ') || 'Nessuno'}</div>
                <div>Ultimo aggiornamento: {new Date(integration.updated_at).toLocaleString('it-IT')}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Agenzia (admin only, embedded) ─── */}
      {activeTab === 'Agenzia' && isAdmin && <AdminAgencySettings />}

      {/* ─── Gestione Utenti (admin only, embedded) ─── */}
      {activeTab === 'Gestione Utenti' && isAdmin && <AdminUsers />}

      {/* ─── Log Attivita (admin only, embedded) ─── */}
      {activeTab === 'Log Attivita' && isAdmin && <AdminActivity />}
    </div>
  )
}
