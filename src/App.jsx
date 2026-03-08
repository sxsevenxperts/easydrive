import { useState, useEffect } from 'react'
import { useGPS } from './hooks/useGPS'
import { supabase } from './lib/supabase'
import NavBar from './components/NavBar'
import Dashboard from './pages/Dashboard'
import ActiveTrip from './pages/ActiveTrip'
import History from './pages/History'
import Settings from './pages/Settings'
import Stats from './pages/Stats'
import Login, { SubscriptionExpired } from './pages/Login'
import { parseShareUrl } from './utils/rideParser'

// Determina aba inicial (pode vir de shortcut da PWA ou share target)
function getInitialTab() {
  const params = new URLSearchParams(window.location.search)
  if (params.get('share') === '1') return 'trip'
  if (params.get('tab')) return params.get('tab')
  return 'dashboard'
}

function MainApp({ sharedRide }) {
  const [tab, setTab] = useState(getInitialTab())
  useGPS() // GPS rodando em segundo plano

  return (
    <div style={{ background: '#0f172a', minHeight: '100dvh', color: '#f1f5f9' }}>
      <div style={{
        maxWidth: 480,
        margin: '0 auto',
        paddingTop: 'env(safe-area-inset-top)',
        minHeight: '100dvh',
        position: 'relative',
      }}>
        {tab === 'dashboard' && <Dashboard onTab={setTab} />}
        {tab === 'trip' && <ActiveTrip sharedRide={sharedRide} />}
        {tab === 'history' && <History />}
        {tab === 'stats' && <Stats />}
        {tab === 'settings' && <Settings />}
        <NavBar active={tab} onTab={setTab} />
      </div>
    </div>
  )
}

export default function App() {
  const [auth, setAuth] = useState(null) // null = verificando, false = não logado
  const [sharedRide, setSharedRide] = useState(null)

  // Captura ride compartilhado via Web Share Target
  useEffect(() => {
    const parsed = parseShareUrl()
    if (parsed) {
      setSharedRide(parsed)
      // Limpa URL para não reprocessar em reloads
      window.history.replaceState({}, '', '/')
    }
  }, [])

  const handleAuth = (result) => setAuth(result)

  const handleLogout = async () => {
    if (supabase) await supabase.auth.signOut()
    setAuth(null)
  }

  // Verificando sessão...
  if (auth === null) return <Login onAuth={handleAuth} />

  // Logado mas sem assinatura ativa
  if (auth?.user && auth.subscription && !auth.subscription.active) {
    return (
      <SubscriptionExpired
        user={auth.user}
        subscription={auth.subscription}
        onLogout={handleLogout}
      />
    )
  }

  // Autenticado com assinatura ativa (ou demo)
  if (auth?.user || auth?.demo) return <MainApp sharedRide={sharedRide} />

  // Sem sessão → tela de login
  return <Login onAuth={handleAuth} />
}
