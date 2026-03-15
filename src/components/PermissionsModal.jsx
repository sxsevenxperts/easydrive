import { useState, useEffect } from 'react'

const PERMISSIONS_KEY = 'easydrive_permissions_asked'

export default function PermissionsModal({ onDone }) {
  const [step, setStep] = useState(0) // 0=intro, 1=location, 2=notif, 3=done
  const [locationStatus, setLocationStatus] = useState('pending')
  const [notifStatus, setNotifStatus] = useState('pending')

  useEffect(() => {
    // Já pediu antes? Pula
    if (localStorage.getItem(PERMISSIONS_KEY)) {
      onDone()
      return
    }

    // Verifica status atual
    if ('Notification' in window && Notification.permission === 'granted') {
      setNotifStatus('granted')
    }
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then(r => {
        if (r.state === 'granted') setLocationStatus('granted')
      }).catch(() => {})
    }
  }, [onDone])

  const requestLocation = () => {
    setLocationStatus('requesting')
    navigator.geolocation.getCurrentPosition(
      () => {
        setLocationStatus('granted')
        setTimeout(() => setStep(2), 600)
      },
      (err) => {
        setLocationStatus(err.code === 1 ? 'denied' : 'error')
        setTimeout(() => setStep(2), 1500)
      },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  const requestNotifications = () => {
    if (!('Notification' in window)) {
      setNotifStatus('unavailable')
      finish()
      return
    }
    setNotifStatus('requesting')
    Notification.requestPermission().then(perm => {
      setNotifStatus(perm === 'granted' ? 'granted' : 'denied')
      setTimeout(finish, 600)
    })
  }

  const finish = () => {
    localStorage.setItem(PERMISSIONS_KEY, Date.now().toString())
    setStep(3)
    setTimeout(onDone, 800)
  }

  const skipAll = () => {
    localStorage.setItem(PERMISSIONS_KEY, Date.now().toString())
    onDone()
  }

  // Já pediu? Não renderiza
  if (localStorage.getItem(PERMISSIONS_KEY)) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        background: '#1e293b', borderRadius: 20, padding: '32px 24px',
        maxWidth: 380, width: '100%', textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>

        {/* INTRO */}
        {step === 0 && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🚗</div>
            <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
              Bem-vindo ao EasyDrive!
            </h2>
            <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.5, marginBottom: 24 }}>
              Para funcionar corretamente, precisamos de algumas permissões:
            </p>

            <div style={{ textAlign: 'left', marginBottom: 24 }}>
              <PermItem
                icon="📍"
                title="Localização / GPS"
                desc="Rastrear sua rota, calcular km e mostrar sua posição no mapa"
              />
              <PermItem
                icon="🔔"
                title="Notificações"
                desc="Alertas de segurança, fadiga e áreas de risco"
              />
            </div>

            <button onClick={() => setStep(1)} style={btnStyle('#3b82f6')}>
              Continuar
            </button>
            <button onClick={skipAll} style={linkStyle}>
              Pular por agora
            </button>
          </>
        )}

        {/* LOCATION */}
        {step === 1 && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📍</div>
            <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
              Localização em tempo real
            </h2>
            <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.5, marginBottom: 24 }}>
              Usamos o GPS para rastrear sua rota, calcular quilômetros rodados e mostrar sua posição no mapa.
            </p>

            {locationStatus === 'granted' ? (
              <>
                <StatusBadge status="granted" text="Localização ativada!" />
                <button onClick={() => setStep(2)} style={btnStyle('#10b981')}>
                  Próximo
                </button>
              </>
            ) : locationStatus === 'denied' ? (
              <>
                <StatusBadge status="denied" text="Permissão negada — ative nas configurações do navegador" />
                <button onClick={() => setStep(2)} style={btnStyle('#64748b')}>
                  Próximo
                </button>
              </>
            ) : locationStatus === 'requesting' ? (
              <StatusBadge status="requesting" text="Aguardando permissão..." />
            ) : (
              <button onClick={requestLocation} style={btnStyle('#3b82f6')}>
                Permitir Localização
              </button>
            )}

            <button onClick={() => { setStep(2) }} style={linkStyle}>
              Pular
            </button>
          </>
        )}

        {/* NOTIFICATIONS */}
        {step === 2 && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔔</div>
            <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
              Notificações
            </h2>
            <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.5, marginBottom: 24 }}>
              Receba alertas de áreas de risco, fadiga ao volante e avisos importantes durante suas corridas.
            </p>

            {notifStatus === 'granted' ? (
              <>
                <StatusBadge status="granted" text="Notificações ativadas!" />
                <button onClick={finish} style={btnStyle('#10b981')}>
                  Começar a usar
                </button>
              </>
            ) : notifStatus === 'denied' ? (
              <>
                <StatusBadge status="denied" text="Permissão negada — ative nas configurações" />
                <button onClick={finish} style={btnStyle('#64748b')}>
                  Começar a usar
                </button>
              </>
            ) : notifStatus === 'unavailable' ? (
              <>
                <StatusBadge status="denied" text="Notificações não suportadas neste navegador" />
                <button onClick={finish} style={btnStyle('#64748b')}>
                  Começar a usar
                </button>
              </>
            ) : notifStatus === 'requesting' ? (
              <StatusBadge status="requesting" text="Aguardando permissão..." />
            ) : (
              <button onClick={requestNotifications} style={btnStyle('#f59e0b')}>
                Permitir Notificações
              </button>
            )}

            <button onClick={finish} style={linkStyle}>
              Pular
            </button>
          </>
        )}

        {/* DONE */}
        {step === 3 && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>
              Tudo pronto!
            </h2>
            <p style={{ color: '#94a3b8', fontSize: 14, marginTop: 8 }}>
              Iniciando EasyDrive...
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function PermItem({ icon, title, desc }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
      <span style={{ fontSize: 24, flexShrink: 0 }}>{icon}</span>
      <div>
        <p style={{ color: '#fff', fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{title}</p>
        <p style={{ color: '#64748b', fontSize: 12, lineHeight: 1.4 }}>{desc}</p>
      </div>
    </div>
  )
}

function StatusBadge({ status, text }) {
  const colors = {
    granted: { bg: '#10b98120', color: '#10b981', icon: '✅' },
    denied: { bg: '#ef444420', color: '#ef4444', icon: '❌' },
    requesting: { bg: '#3b82f620', color: '#3b82f6', icon: '⏳' },
  }
  const c = colors[status] || colors.requesting
  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.color}30`,
      borderRadius: 10, padding: '10px 14px', marginBottom: 16,
      color: c.color, fontSize: 13, fontWeight: 600,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    }}>
      {c.icon} {text}
    </div>
  )
}

const btnStyle = (bg) => ({
  width: '100%', padding: '16px',
  background: bg, border: 'none', borderRadius: 14,
  color: '#fff', fontSize: 16, fontWeight: 700,
  cursor: 'pointer', marginBottom: 8,
  WebkitTapHighlightColor: 'transparent',
  touchAction: 'manipulation',
})

const linkStyle = {
  background: 'none', border: 'none',
  color: '#64748b', fontSize: 13, cursor: 'pointer',
  padding: '8px 16px', marginTop: 4,
  WebkitTapHighlightColor: 'transparent',
}
