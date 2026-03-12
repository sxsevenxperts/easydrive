import { useState, useEffect, useRef } from 'react'
import { useGPS } from './hooks/useGPS'
import { useTheme } from './hooks/useTheme'
import { useStore } from './store'
import { supabase, checkSubscription, checkIsAdmin } from './lib/supabase'
import { startPeriodicSync, stopPeriodicSync, fullSync, processQueue } from './lib/sync'
import NavBar from './components/NavBar'
import Dashboard from './pages/Dashboard'
import ActiveTrip from './pages/ActiveTrip'
import History from './pages/History'
import Settings from './pages/Settings'
import Stats from './pages/Stats'
import Billing from './pages/Billing'
import AdminPanel from './pages/AdminPanel'
import Login, { SubscriptionExpired } from './pages/Login'
import { parseShareUrl } from './utils/rideParser'
import {
  registerServiceWorker,
  requestNotificationPermission,
  checkGoalNotifications,
  getPermissionStatus,
  NOTIFY,
} from './utils/notifications'
import { calcStreak, calcAchievements } from './utils/gamification'

function getInitialTab() {
  const params = new URLSearchParams(window.location.search)
  if (params.get('share') === '1') return 'trip'
  if (params.get('tab')) return params.get('tab')
  return 'dashboard'
}

function MainApp({ sharedRide, user, subscription, onLogout }) {
  const [tab, setTab] = useState(getInitialTab())
  const { trips, settings, expenses, safetyScore, setUser } = useStore()
  const prevAchievementsRef = useRef(null)
  const streakNotifiedRef = useRef(null)
  useTheme()
  useGPS()

  // Setar userId no store para sync
  useEffect(() => {
    if (user?.id) {
      setUser(user.id, user.email)

      // Iniciar sync periódico
      const cleanup = startPeriodicSync(user.id, useStore.getState)

      // Processar fila pendente
      processQueue(user.id)

      return () => { cleanup(); stopPeriodicSync() }
    }
  }, [user?.id])

  // Registra SW uma vez
  useEffect(() => { registerServiceWorker() }, [])

  // Checa metas a cada hora
  useEffect(() => {
    if (getPermissionStatus() !== 'granted') return
    checkGoalNotifications(trips, settings, expenses)
    const id = setInterval(() => checkGoalNotifications(trips, settings, expenses), 60 * 60 * 1000)
    return () => clearInterval(id)
  }, [trips, settings, expenses])

  // Alerta de segurança quando score cai
  useEffect(() => {
    if (getPermissionStatus() !== 'granted' || !safetyScore) return
    if (settings.notifSafety === false) return
    if (safetyScore < 30) NOTIFY.safetyAlert(`Pontuação crítica: ${safetyScore}/100. Considere pausar.`)
  }, [safetyScore, settings])

  // Conquistas novas desbloqueadas
  useEffect(() => {
    if (getPermissionStatus() !== 'granted') return
    if (settings.notifAchievements === false) return
    const current = calcAchievements(trips, settings)
    if (!prevAchievementsRef.current) { prevAchievementsRef.current = current; return }
    current.forEach((a) => {
      const prev = prevAchievementsRef.current.find(p => p.id === a.id)
      if (a.unlocked && prev && !prev.unlocked) NOTIFY.achievement(a.title, a.desc)
    })
    prevAchievementsRef.current = current
  }, [trips, settings])

  // Streak em risco
  useEffect(() => {
    if (getPermissionStatus() !== 'granted') return
    if (settings.notifStreak === false) return
    const streak = calcStreak(trips)
    if (streak.current < 3) return
    const now = new Date()
    if (now.getHours() < 12) return
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const workedToday = trips.some(t => (t.endTime || t.startTime) >= todayStart)
    const key = `streak-${now.toDateString()}`
    if (!workedToday && streakNotifiedRef.current !== key) {
      streakNotifiedRef.current = key
      NOTIFY.streakRisk(streak.current)
    }
  }, [trips, settings])

  // Se está na tab billing
  if (tab === 'billing') {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100dvh', color: 'var(--text)' }}>
        <Billing user={user} subscription={subscription} onBack={() => setTab('dashboard')} />
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100dvh', color: 'var(--text)' }}>
      <div style={{
        maxWidth: 480, margin: '0 auto',
        paddingTop: 'env(safe-area-inset-top)',
        minHeight: '100dvh', position: 'relative',
      }}>
        {tab === 'dashboard' && <Dashboard onTab={setTab} />}
        {tab === 'trip' && <ActiveTrip sharedRide={sharedRide} />}
        {tab === 'history' && <History />}
        {tab === 'stats' && <Stats />}
        {tab === 'settings' && <Settings user={user} subscription={subscription} onTab={setTab} onLogout={onLogout} />}

        {/* Footer */}
        <div style={{
          textAlign: 'center', padding: '16px 0 90px',
          borderTop: '1px solid var(--border-dim)', marginTop: 20,
        }}>
          <p style={{ fontSize: 11, color: '#475569' }}>
            Powered by <strong style={{ color: '#64748b' }}>Seven Xperts</strong>
          </p>
          <p style={{ fontSize: 10, color: '#334155' }}>
            CNPJ 32.794.007/0001-19
          </p>
        </div>

        <NavBar active={tab} onTab={setTab} />
      </div>
    </div>
  )
}

export default function App() {
  const [auth, setAuth] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [sharedRide, setSharedRide] = useState(null)
  const [showNotifBanner, setShowNotifBanner] = useState(false)

  useEffect(() => {
    const parsed = parseShareUrl()
    if (parsed) { setSharedRide(parsed); window.history.replaceState({}, '', '/') }
  }, [])

  const handleAuth = async (result) => {
    setAuth(result)

    // Verificar se é admin (por role no banco ou por email)
    if (result?.user?.id) {
      let admin = await checkIsAdmin(result.user.id)
      // Override: marca como admin se for email específico
      if (!admin && result.user.email === 'sevenxpertssxacadmy@gmail.com') {
        admin = true
      }
      setIsAdmin(admin)
    }

    // Após login, exibe banner pedindo permissão de notificação
    setTimeout(() => {
      if (getPermissionStatus() === 'default') setShowNotifBanner(true)
    }, 2500)
  }

  const handleLogout = async () => {
    stopPeriodicSync()
    if (supabase) await supabase.auth.signOut()
    setAuth(null)
    setIsAdmin(false)
  }

  const handleEnableNotifs = async () => {
    const granted = await requestNotificationPermission()
    setShowNotifBanner(false)
    if (granted) registerServiceWorker()
  }

  if (auth === null) return <Login onAuth={handleAuth} />

  // ── Admin Panel ──
  if (isAdmin && auth?.user) {
    return <AdminPanel user={auth.user} onLogout={handleLogout} />
  }

  // ── Assinatura expirada ──
  // Só bloqueia se assinatura existe e está expirada/cancelada
  // Se não encontrou assinatura (not_found), deixa entrar como trial
  const subBlocked = auth?.user && 
    auth.subscription && 
    !auth.subscription.active && 
    auth.subscription.reason !== 'not_found'
  if (subBlocked) {
    return <SubscriptionExpired user={auth.user} subscription={auth.subscription} onLogout={handleLogout} />
  }

  // ── App do motorista ──
  if (auth?.user || auth?.demo) {
    return (
      <>
        <MainApp
          sharedRide={sharedRide}
          user={auth.user}
          subscription={auth.subscription}
          onLogout={handleLogout}
        />

        {/* Banner de permissão */}
        {showNotifBanner && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999,
            background: '#1e293b', borderBottom: '2px solid #22c55e',
            padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'center',
          }}>
            <span style={{ fontSize: 22 }}>🔔</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: '#f1f5f9' }}>Ativar alertas push?</p>
              <p style={{ fontSize: 11, color: '#64748b' }}>Metas, riscos, conquistas e prejuízo</p>
            </div>
            <button onClick={() => setShowNotifBanner(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18, padding: '4px 6px' }}>✕</button>
            <button onClick={handleEnableNotifs} style={{ background: '#22c55e', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13, padding: '9px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Ativar
            </button>
          </div>
        )}
      </>
    )
  }

  return <Login onAuth={handleAuth} />
}
