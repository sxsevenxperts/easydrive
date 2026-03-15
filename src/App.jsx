import { useState, useEffect } from 'react'
import { supabase, checkSubscription, checkIsAdmin } from './lib/supabase'
import NavBar from './components/NavBar'
import AlertToast from './components/AlertToast'
import Dashboard from './pages/Dashboard'
import ActiveTrip from './pages/ActiveTrip'
import History from './pages/History'
import Settings from './pages/Settings'
import Stats from './pages/Stats'
import Chat from './pages/Chat'
import Billing from './pages/Billing'
import AdminPanel from './pages/AdminPanel'
import Login, { SubscriptionExpired } from './pages/Login'
import { useGPS } from './hooks/useGPS'

function MainApp({ sharedRide, user, subscription, onLogout }) {
  const [tab, setTab] = useState('dashboard')

  // ⚡ Inicia GPS em tempo real quando app é aberto
  useGPS()

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
        {tab === 'trip'      && <ActiveTrip sharedRide={sharedRide} />}
        {tab === 'history'   && <History />}
        {tab === 'stats'     && <Stats />}
        {tab === 'chat'      && <Chat user={user} />}
        {tab === 'settings'  && <Settings user={user} subscription={subscription} onTab={setTab} onLogout={onLogout} />}

        <div style={{
          textAlign: 'center', padding: '16px 0 90px',
          borderTop: '1px solid var(--border-dim)', marginTop: 20,
        }}>
          <p style={{ fontSize: 11, color: '#475569' }}>
            Powered by <strong style={{ color: '#64748b' }}>Seven Xperts</strong>
          </p>
        </div>

        <AlertToast />
        <NavBar active={tab} onTab={setTab} />
      </div>
    </div>
  )
}

export default function App() {
  const [auth, setAuth] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [sharedRide, setSharedRide] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }

    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        checkSubscription(session.user.id).then(sub => {
          const isAdminUser = session.user.email === 'sevenxpertssxacademy@gmail.com'
          setAuth({ user: session.user, subscription: sub })
          setIsAdmin(isAdminUser)
        })
      }
      setLoading(false)
    }).catch(() => setLoading(false))

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const sub = await checkSubscription(session.user.id)
        const isAdminUser = session.user.email === 'sevenxpertssxacademy@gmail.com'
        setAuth({ user: session.user, subscription: sub })
        setIsAdmin(isAdminUser)
      } else if (event === 'SIGNED_OUT') {
        setAuth(null)
        setIsAdmin(false)
      }
    })

    return () => subscription?.unsubscribe()
  }, [])

  const handleAuth = async (result) => {
    setAuth(result)
    if (result?.user?.id) {
      const isAdminUser = result.user.email === 'sevenxpertssxacademy@gmail.com'
      setIsAdmin(isAdminUser)
    }
  }

  const handleLogout = async () => {
    if (supabase) await supabase.auth.signOut()
    setAuth(null)
    setIsAdmin(false)
  }

  if (loading) {
    return <div style={{ background: '#000', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#fff', textAlign: 'center' }}>Carregando...</div>
    </div>
  }

  if (auth === null) return <Login onAuth={handleAuth} />

  // Admin panel
  if (isAdmin && auth?.user) {
    return <AdminPanel user={auth.user} onLogout={handleLogout} />
  }

  // Check subscription
  const subBlocked = auth?.user &&
    auth.subscription &&
    !auth.subscription.active &&
    auth.subscription.reason !== 'not_found'

  if (subBlocked) {
    return <SubscriptionExpired user={auth.user} subscription={auth.subscription} onLogout={handleLogout} />
  }

  // Driver app
  if (auth?.user) {
    return <MainApp sharedRide={sharedRide} user={auth.user} subscription={auth.subscription} onLogout={handleLogout} />
  }

  return <Login onAuth={handleAuth} />
}
