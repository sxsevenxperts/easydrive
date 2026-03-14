import { useEffect } from 'react'
import { useStore } from '../store'
import { X } from 'lucide-react'

export default function AlertToast() {
  const { alerts, settings } = useStore((s) => ({ alerts: s.alerts, settings: s.settings }))

  // Auto-remove alertas após 5 segundos
  useEffect(() => {
    if (alerts.length === 0) return

    const timers = alerts.map((alert) => {
      return setTimeout(() => {
        const { alerts: current } = useStore.getState()
        const updated = current.filter((a) => a.id !== alert.id)
        useStore.setState({ alerts: updated })
      }, alert.duration || 5000)
    })

    return () => timers.forEach(clearTimeout)
  }, [alerts])

  if (!alerts.length) return null

  // Estilos por tipo de alerta
  const getStyles = (type = 'info') => {
    const styles = {
      info: {
        bg: '#0f172a',
        border: '#3b82f6',
        icon: '💡',
        text: '#e0f2fe',
      },
      success: {
        bg: '#0c2818',
        border: '#22c55e',
        icon: '✅',
        text: '#dcfce7',
      },
      warning: {
        bg: '#291d00',
        border: '#eab308',
        icon: '⚠️',
        text: '#fef3c7',
      },
      error: {
        bg: '#3f0f0f',
        border: '#ef4444',
        icon: '❌',
        text: '#fee2e2',
      },
      achievement: {
        bg: '#1a0f2e',
        border: '#a855f7',
        icon: '🏆',
        text: '#f3e8ff',
      },
    }
    return styles[type] || styles.info
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 90,
        right: 16,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: 320,
        pointerEvents: 'none',
      }}
    >
      {alerts.map((alert) => {
        const s = getStyles(alert.type)
        return (
          <div
            key={alert.id}
            style={{
              background: s.bg,
              border: `1px solid ${s.border}`,
              borderRadius: 12,
              padding: '12px 14px',
              color: s.text,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              animation: 'slideIn 0.3s ease-out',
              boxShadow: `0 4px 12px ${s.border}40`,
              pointerEvents: 'auto',
              cursor: 'pointer',
            }}
            onClick={() => {
              const { alerts: current } = useStore.getState()
              useStore.setState({ alerts: current.filter((a) => a.id !== alert.id) })
            }}
          >
            <span style={{ fontSize: 16, marginTop: 2, flexShrink: 0 }}>{s.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              {alert.title && (
                <p style={{ fontWeight: 700, fontSize: 13, margin: '0 0 4px', lineHeight: 1.3 }}>
                  {alert.title}
                </p>
              )}
              {alert.message && (
                <p style={{ fontSize: 12, color: s.text, margin: 0, opacity: 0.9, lineHeight: 1.4 }}>
                  {alert.message}
                </p>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                const { alerts: current } = useStore.getState()
                useStore.setState({ alerts: current.filter((a) => a.id !== alert.id) })
              }}
              style={{
                background: 'none',
                border: 'none',
                color: s.text,
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                opacity: 0.6,
                transition: 'opacity 0.2s',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => (e.target.style.opacity = '1')}
              onMouseLeave={(e) => (e.target.style.opacity = '0.6')}
            >
              <X size={16} />
            </button>
          </div>
        )
      })}

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}
