import { useState, useEffect } from 'react'
import { supabase, checkSubscription } from '../lib/supabase'
import { Lock, Mail, AlertCircle, CheckCircle, Loader, ArrowLeft } from 'lucide-react'

// Auth offline (quando Supabase não está configurado)
const OFFLINE_KEY = 'easydrive_offline_auth'

function getOfflineAuth() {
  try { return JSON.parse(localStorage.getItem(OFFLINE_KEY)) } catch { return null }
}

async function offlineLogin(email, password) {
  const stored = getOfflineAuth()
  if (!stored) {
    // Primeiro acesso: cadastra localmente
    localStorage.setItem(OFFLINE_KEY, JSON.stringify({ email, password }))
    return { ok: true, user: { email, id: 'local' } }
  }
  if (stored.email === email && stored.password === password) {
    return { ok: true, user: { email, id: 'local' } }
  }
  return { ok: false, error: 'E-mail ou senha incorretos' }
}

export default function Login({ onAuth }) {
  const [screen, setScreen] = useState('login') // 'login' | 'forgot' | 'sent'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [offlinePwd, setOfflinePwd] = useState(null)

  const hasSupabase = !!supabase

  useEffect(() => {
    if (!hasSupabase) {
      const session = sessionStorage.getItem('easydrive_session')
      if (session) {
        try { onAuth({ user: JSON.parse(session), subscription: { active: true } }); return } catch {}
      }
      setChecking(false)
      return
    }

    const timeout = setTimeout(() => setChecking(false), 5000)

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      clearTimeout(timeout)
      if (session?.user) {
        const sub = await checkSubscription(session.user.id)
        onAuth({ user: session.user, subscription: sub })
      } else {
        setChecking(false)
      }
    }).catch(() => { clearTimeout(timeout); setChecking(false) })

    const { data: { subscription: listener } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const sub = await checkSubscription(session.user.id)
        onAuth({ user: session.user, subscription: sub })
      }
    })

    return () => listener.unsubscribe()
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!hasSupabase) {
      const res = await offlineLogin(email, password)
      if (!res.ok) { setError(res.error); setLoading(false); return }
      sessionStorage.setItem('easydrive_session', JSON.stringify(res.user))
      onAuth({ user: res.user, subscription: { active: true } })
      return
    }

    // Tenta login
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })

    if (err && err.message === 'Invalid login credentials') {
      // Conta não existe → cria automaticamente
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({ email, password })
      if (signUpErr) {
        setError(signUpErr.message)
        setLoading(false)
        return
      }
      // Supabase pode exigir confirmação de email
      if (signUpData.user && !signUpData.session) {
        setError('Conta criada! Verifique seu e-mail para confirmar.')
        setLoading(false)
        return
      }
      const sub = await checkSubscription(signUpData.user.id)
      onAuth({ user: signUpData.user, subscription: sub })
      return
    }

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    const sub = await checkSubscription(data.user.id)
    onAuth({ user: data.user, subscription: sub })
  }

  const handleForgot = async (e) => {
    e.preventDefault()
    if (!email) { setError('Digite seu e-mail primeiro'); return }
    setError('')
    setLoading(true)

    if (!hasSupabase) {
      const stored = getOfflineAuth()
      if (!stored || stored.email !== email) {
        setError('E-mail não encontrado no dispositivo')
        setLoading(false)
        return
      }
      setOfflinePwd(stored.password)
      setScreen('sent')
      setLoading(false)
      return
    }

    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/?reset=1`,
    })
    if (err) { setError(err.message); setLoading(false); return }
    setScreen('sent')
    setLoading(false)
  }

  if (checking) {
    return (
      <div style={S.center}>
        <Loader size={32} color='#3b82f6' style={{ animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  return (
    <div style={S.wrapper}>
      <div style={S.card}>

        {/* ── E-MAIL / LINK ENVIADO ── */}
        {screen === 'sent' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ ...S.iconBox, background: '#22c55e20' }}>
                <CheckCircle size={36} color='#22c55e' />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginTop: 16 }}>
                {hasSupabase ? 'E-mail enviado!' : 'Sua senha salva'}
              </h2>
              <p style={{ color: '#64748b', fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>
                {hasSupabase
                  ? `Enviamos um link de redefinição para ${email}. Verifique sua caixa de entrada.`
                  : 'Esta é a senha armazenada no seu dispositivo:'
                }
              </p>
              {offlinePwd && (
                <div style={{
                  background: '#1e293b', borderRadius: 10, padding: '12px 16px',
                  marginTop: 14, border: '1px solid #334155',
                  fontSize: 20, fontWeight: 800, color: '#f1f5f9', letterSpacing: 3,
                }}>
                  {offlinePwd}
                </div>
              )}
            </div>
            <button onClick={() => { setScreen('login'); setError(''); setOfflinePwd(null) }} style={S.btn}>
              Voltar para o login
            </button>
          </>
        )}

        {/* ── ESQUECEU A SENHA ── */}
        {screen === 'forgot' && (
          <>
            <button onClick={() => { setScreen('login'); setError('') }}
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 20, padding: 0 }}>
              <ArrowLeft size={15} /> Voltar
            </button>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Recuperar senha</h2>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
              {hasSupabase
                ? 'Informe seu e-mail para receber o link de redefinição.'
                : 'Informe o e-mail cadastrado para ver a senha salva no dispositivo.'
              }
            </p>
            <form onSubmit={handleForgot}>
              <label style={S.label}>E-mail</label>
              <div style={S.inputWrap}>
                <Mail size={16} color='#64748b' style={S.icon} />
                <input type='email' value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder='seu@email.com' required style={S.input} />
              </div>
              {error && <Err msg={error} />}
              <button type='submit' disabled={loading} style={S.btn}>
                {loading ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : 'Enviar'}
              </button>
            </form>
          </>
        )}

        {/* ── LOGIN ── */}
        {screen === 'login' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <img src='/logo.png' alt='EasyDrive' style={{
                width: 260, height: 'auto', marginBottom: -8,
                WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 14%), radial-gradient(ellipse 90% 88% at 50% 58%, black 65%, transparent 86%)',
                WebkitMaskComposite: 'destination-in',
                maskImage: 'linear-gradient(to bottom, transparent 0%, black 14%), radial-gradient(ellipse 90% 88% at 50% 58%, black 65%, transparent 86%)',
                maskComposite: 'intersect',
              }} />
            </div>

            <form onSubmit={handleLogin}>
              <label style={S.label}>E-mail</label>
              <div style={S.inputWrap}>
                <Mail size={16} color='#64748b' style={S.icon} />
                <input type='email' value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder='seu@email.com' required style={S.input} />
              </div>

              <label style={S.label}>Senha</label>
              <div style={S.inputWrap}>
                <Lock size={16} color='#64748b' style={S.icon} />
                <input type='password' value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder='••••••••' required style={S.input} />
              </div>

              {error && <Err msg={error} />}

              <div style={{ textAlign: 'right', marginBottom: 18, marginTop: -8 }}>
                <button type='button' onClick={() => { setScreen('forgot'); setError('') }}
                  style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 13, cursor: 'pointer', padding: 0 }}>
                  Esqueceu a senha?
                </button>
              </div>

              <button type='submit' disabled={loading} style={S.btn}>
                {loading ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : 'Entrar'}
              </button>
            </form>

            <p style={{ textAlign: 'center', fontSize: 12, color: '#475569', marginTop: 20, lineHeight: 1.6 }}>
              Sem conta?{' '}
              <a href='https://wa.me/5500000000000?text=Quero+assinar+o+EasyDrive'
                style={{ color: '#3b82f6', textDecoration: 'none' }}>
                Assinar agora
              </a>
            </p>
          </>
        )}
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function Err({ msg }) {
  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'center',
      background: '#ef444415', border: '1px solid #ef444440',
      borderRadius: 10, padding: '10px 12px', marginBottom: 14, color: '#ef4444',
    }}>
      <AlertCircle size={14} />
      <span style={{ fontSize: 13 }}>{msg}</span>
    </div>
  )
}

export function SubscriptionExpired({ user, subscription, onLogout }) {
  return (
    <div style={S.wrapper}>
      <div style={S.card}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ ...S.iconBox, background: '#ef444420' }}>
            <AlertCircle size={36} color='#ef4444' />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginTop: 16 }}>
            {subscription?.reason === 'not_found' ? 'Assinatura não encontrada' : 'Assinatura vencida'}
          </h2>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>{user?.email}</p>
        </div>
        <div style={{ background: '#1e293b', borderRadius: 12, padding: 14, marginBottom: 20, border: '1px solid #334155' }}>
          <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.7 }}>
            {subscription?.reason === 'not_found'
              ? 'Nenhuma assinatura ativa para esta conta. Entre em contato para assinar.'
              : <>Venceu em <strong style={{ color: '#f1f5f9' }}>{subscription?.expires_at ? new Date(subscription.expires_at).toLocaleDateString('pt-BR') : '—'}</strong>. Renove para continuar.</>
            }
          </p>
        </div>
        <button onClick={() => window.open('https://wa.me/5500000000000?text=Quero+renovar+EasyDrive', '_blank')}
          style={{ ...S.btn, background: '#25D366', marginBottom: 10 }}>
          📱 Renovar via WhatsApp
        </button>
        <button onClick={onLogout}
          style={{ width: '100%', padding: 12, background: 'none', border: '1px solid #334155', borderRadius: 12, color: '#64748b', cursor: 'pointer', fontSize: 14 }}>
          Sair da conta
        </button>
      </div>
    </div>
  )
}

const S = {
  wrapper: { minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: '#000' },
  card: { width: '100%', maxWidth: 380, background: '#0d0d0d', borderRadius: 20, padding: '32px 24px', border: '1px solid #1a1a1a' },
  center: { minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' },
  iconBox: { width: 72, height: 72, background: '#3b82f620', borderRadius: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  inputWrap: { position: 'relative', marginBottom: 16 },
  icon: { position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' },
  input: { width: '100%', background: '#111', border: '1px solid #2a2a2a', borderRadius: 12, padding: '13px 14px 13px 42px', color: '#f1f5f9', fontSize: 15, outline: 'none', boxSizing: 'border-box' },
  btn: { width: '100%', padding: '14px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
}
