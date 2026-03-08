import { LayoutDashboard, Navigation, History, Settings, BarChart2 } from 'lucide-react'
import { useStore } from '../store'

const tabs = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Início' },
  { id: 'trip', icon: Navigation, label: 'Viagem' },
  { id: 'history', icon: History, label: 'Histórico' },
  { id: 'stats', icon: BarChart2, label: 'Gráficos' },
  { id: 'settings', icon: Settings, label: 'Config' },
]

export default function NavBar({ active, onTab }) {
  const { alerts, activeTrip, tripStatus } = useStore()
  const hasAlert = alerts.length > 0 && alerts[0]?.type === 'danger'

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#0f172a',
      borderTop: '1px solid #1e293b',
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
              color: isActive ? '#3b82f6' : '#64748b',
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
                  border: '1px solid #0f172a',
                }} />
              )}
              {id === 'dashboard' && hasAlert && (
                <span style={{
                  position: 'absolute', top: -4, right: -4,
                  width: 8, height: 8, borderRadius: '50%',
                  background: '#ef4444', border: '1px solid #0f172a',
                }} />
              )}
            </div>
            <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400 }}>{label}</span>
            {isActive && (
              <span style={{
                position: 'absolute', bottom: 0, left: '25%', right: '25%',
                height: 2, background: '#3b82f6', borderRadius: '2px 2px 0 0',
              }} />
            )}
          </button>
        )
      })}
    </nav>
  )
}
