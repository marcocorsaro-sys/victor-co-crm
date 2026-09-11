import { useState, useMemo } from 'react'
import CalendarView from '../components/CalendarView'
import OpenHouseModal from '../components/OpenHouseModal'
import { useGoogleIntegration } from '../hooks/useGoogleIntegration'
import { useOpenHouses } from '../hooks/useOpenHouses'
import { useOperations } from '../hooks/useOperations'
import { useToast } from '../hooks/useToast'
import GoogleConnectButton from '../components/GoogleConnectButton'
import ToastContainer from '../components/ToastContainer'
import type { OpenHouse } from '../hooks/useOpenHouses'

type CalendarItem = {
  id: string
  title: string
  start: string
  end: string
  color: string
  type: 'google' | 'open_house'
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Programmato',
  completed: 'Completato',
  cancelled: 'Annullato',
}

export default function CalendarPage() {
  const { integration, loading: gLoading, refetch } = useGoogleIntegration()
  const { openHouses, addOpenHouse, updateOpenHouse, deleteOpenHouse } = useOpenHouses()
  const { operations } = useOperations()
  const { toasts, addToast } = useToast()

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showOHModal, setShowOHModal] = useState(false)
  const [editingOH, setEditingOH] = useState<OpenHouse | null>(null)

  const isConnected = integration?.calendar_connected

  // Map open houses to calendar items
  const events: CalendarItem[] = useMemo(() => {
    return openHouses
      .filter(oh => oh.status !== 'cancelled')
      .map(oh => ({
        id: oh.id,
        title: oh.title,
        start: oh.start_datetime,
        end: oh.end_datetime,
        color: oh.status === 'completed' ? 'rgba(29,143,95,0.7)' : 'rgba(183,121,31,0.7)',
        type: 'open_house' as const,
      }))
  }, [openHouses])

  const selectedOH = selectedDate
    ? openHouses.filter(oh => oh.start_datetime.startsWith(selectedDate))
    : []

  const handleCreateOH = async (data: Partial<OpenHouse>) => {
    const { error } = await addOpenHouse(data)
    if (error) addToast('Errore nella creazione', 'error')
    else { addToast('Open House creato', 'success'); setShowOHModal(false) }
  }

  const handleUpdateOH = async (data: Partial<OpenHouse>) => {
    if (!editingOH) return
    const { error } = await updateOpenHouse(editingOH.id, data)
    if (error) addToast('Errore nella modifica', 'error')
    else { addToast('Open House modificato', 'success'); setEditingOH(null); setShowOHModal(false) }
  }

  const handleDeleteOH = async (id: string) => {
    if (!confirm('Eliminare questo Open House?')) return
    const { error } = await deleteOpenHouse(id)
    if (error) addToast("Errore nell'eliminazione", 'error')
    else addToast('Open House eliminato', 'success')
  }

  return (
    <div>
      <ToastContainer toasts={toasts} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="section-heading" style={{ margin: 0 }}>Calendario</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!gLoading && !isConnected && (
            <GoogleConnectButton integration={integration} onStatusChange={refetch} />
          )}
          <button className="btn btn-primary" onClick={() => { setEditingOH(null); setShowOHModal(true) }}>
            + Open House
          </button>
        </div>
      </div>

      <div style={{ background: 'var(--s1)', borderRadius: 12, padding: 20, border: '1px solid var(--bd)' }}>
        <CalendarView
          events={events}
          onDateClick={(date) => setSelectedDate(date)}
          onEventClick={(event) => {
            const oh = openHouses.find(o => o.id === event.id)
            if (oh) { setEditingOH(oh); setShowOHModal(true) }
          }}
        />
      </div>

      {/* Selected date detail */}
      {selectedDate && (
        <div style={{ marginTop: 16, background: 'var(--s1)', borderRadius: 12, padding: 16, border: '1px solid var(--bd)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: 'var(--ld)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              // {new Date(selectedDate + 'T00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedDate(null)}>
              ✕
            </button>
          </div>

          {selectedOH.length === 0 ? (
            <p style={{ color: 'var(--g)', fontSize: 13 }}>Nessun evento per questa data.</p>
          ) : (
            selectedOH.map(oh => (
              <div key={oh.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--w)' }}>{oh.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--g)', marginTop: 2 }}>
                    {new Date(oh.start_datetime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                    {' - '}
                    {new Date(oh.end_datetime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                    {oh.location && ` · ${oh.location}`}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <span className={`badge ${oh.status === 'completed' ? 'badge-completata' : oh.status === 'cancelled' ? '' : 'badge-pipeline'}`}
                      style={oh.status === 'cancelled' ? { background: 'rgba(192,57,43,0.15)', color: 'var(--red)' } : {}}>
                      {STATUS_LABELS[oh.status]}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setEditingOH(oh); setShowOHModal(true) }}>✎</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDeleteOH(oh.id)}>✕</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Open House Modal */}
      <OpenHouseModal
        open={showOHModal}
        onClose={() => { setShowOHModal(false); setEditingOH(null) }}
        onSave={editingOH ? handleUpdateOH : handleCreateOH}
        initial={editingOH}
        operations={operations}
      />
    </div>
  )
}
