import { LayoutDashboard, Navigation, History, Trophy, Settings } from 'lucide-react'
import { useStore } from '../store'

const tabs = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Início' },
  { id: 'trip', icon: Navigation, label: 'Viagem' },
  { id: 'history', icon: History, label: 'Histórico' },
  { id: 'stats', icon: Trophy, label: 'Conquistas' },
  { id: 'settings', icon: Settings, label: 'Config' },
]

export default function NavBar({ active, onTab }) {
  const { alerts, activeTrip, tripStatus, maintenances } = useStore()
  const hasAlert = alerts.length > 0 && alerts[0]?.type === 'danger'
  const now = Date.now()
  const hasMaintAlert = (maintenances || []).some((m) =>
    !m.done && m.dueDate && Math.ceil((m.dueDate - now) / 86_400_000) <= (m.reminderDays ?? 7)
  )

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'var(--bg)',
      borderTop: '1px solid var(--border-dim)',
      display: 'flex',
      zIndex: 100,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {tabs.map(({ id, icon: Icon, label }) => {
        const isActive = active === id
        const isTripActive = id === 'trip' && activeTrip
        return (
          <button
            key={id}
            onClick={() => onTab(id)}
            style={{
              flex: 1,
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 3, padding: '10px 0 8px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: isActive ? '#22c55e' : '#64748b',
              position: 'relative',
              transition: 'color 0.15s',
            }}
          >
            <div style={{ position: 'relative' }}>
              <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />
              {isTripActive && (
                <span style={{
                  position: 'absolute', top: -4, right: -4,
                  width: 8, height: 8, borderRadius: '50%',
                  background: tripStatus === 'trip' ? '#22c55e' : '#f59e0b',
                  border: '1px solid var(--bg)',
                }} />
              )}
              {id === 'dashboard' && hasAlert && (
                <span style={{
                  position: 'absolute', top: -4, right: -4,
                  width: 8, height: 8, borderRadius: '50%',
                  background: '#ef4444', border: '1px solid var(--bg)',
                }} />
              )}
              {id === 'settings' && hasMaintAlert && (
                <span style={{
                  position: 'absolute', top: -4, right: -4,
                  width: 8, height: 8, borderRadius: '50%',
                  background: '#f59e0b', border: '1px solid var(--bg)',
                }} />
              )}
            </div>
            <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400 }}>{label}</span>
            {isActive && (
              <span style={{
                position: 'absolute', bottom: 0, left: '25%', right: '25%',
                height: 2, background: '#22c55e', borderRadius: '2px 2px 0 0',
              }} />
            )}
          </button>
        )
      })}
    </nav>
  )
}
