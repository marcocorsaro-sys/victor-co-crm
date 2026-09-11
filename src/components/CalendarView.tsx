import { useState } from 'react'

type CalendarItem = {
  id: string
  title: string
  start: string
  end: string
  color: string
  type: 'google' | 'open_house'
}

type Props = {
  events: CalendarItem[]
  onDateClick?: (date: string) => void
  onEventClick?: (event: CalendarItem) => void
}

const DAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
const MONTH_NAMES = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

export default function CalendarView({ events, onDateClick, onEventClick }: Props) {
  const today = new Date()
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())

  const firstDay = new Date(currentYear, currentMonth, 1)
  const lastDay = new Date(currentYear, currentMonth + 1, 0)
  const startOffset = (firstDay.getDay() + 6) % 7 // Monday = 0
  const totalDays = lastDay.getDate()

  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const getEventsForDay = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return events.filter(e => e.start.startsWith(dateStr))
  }

  const prev = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) }
    else setCurrentMonth(m => m - 1)
  }
  const next = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) }
    else setCurrentMonth(m => m + 1)
  }

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button className="btn btn-secondary btn-sm" onClick={prev}>←</button>
        <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--w)' }}>
          {MONTH_NAMES[currentMonth]} {currentYear}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={next}>→</button>
      </div>

      {/* Days header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, marginBottom: 1 }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, color: 'var(--g)', padding: '4px 0', fontWeight: 600 }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={i} style={{ minHeight: 80, background: 'var(--bg)', borderRadius: 4 }} />
          }
          const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const dayEvents = getEventsForDay(day)
          const isToday = dateStr === todayStr

          return (
            <div key={i} style={{
              minHeight: 80, background: 'var(--s1)', borderRadius: 4, padding: 4,
              border: isToday ? '2px solid var(--lime)' : '1px solid var(--bd)',
              cursor: 'pointer',
            }} onClick={() => onDateClick?.(dateStr)}>
              <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--lime)' : 'var(--gl)', marginBottom: 2 }}>
                {day}
              </div>
              {dayEvents.slice(0, 3).map(e => (
                <div key={e.id} onClick={ev => { ev.stopPropagation(); onEventClick?.(e) }}
                  style={{
                    fontSize: 9, padding: '1px 4px', borderRadius: 3, marginBottom: 1,
                    background: e.color, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    cursor: 'pointer',
                  }}>
                  {e.title}
                </div>
              ))}
              {dayEvents.length > 3 && (
                <div style={{ fontSize: 9, color: 'var(--g)' }}>+{dayEvents.length - 3}</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 11, color: 'var(--g)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(31,111,139,0.7)' }} />
          Google Calendar
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(183,121,31,0.7)' }} />
          Open House
        </div>
      </div>
    </div>
  )
}
