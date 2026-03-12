import { useState, useEffect } from 'react'
import { useStore } from '../store'
import { useTheme } from '../hooks/useTheme'
import { fmt } from '../utils/format'
import { Save, Fuel, User, Car, DollarSign, Download, Target, Bell, BellOff, Sun, Moon, Monitor, CreditCard, LogOut, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  getPermissionStatus,
  requestNotificationPermission,
  registerServiceWorker,
} from '../utils/notifications'

const ALL_PLATFORMS = [
  { id: 'uber', label: '🚗 Uber' },
  { id: '99', label: '🚕 99' },
  { id: 'inDriver', label: '🚙 inDrive' },
  { id: 'ifood', label: '🍔 iFood' },
  { id: 'rappi', label: '🛵 Rappi' },
  { id: 'uberEats', label: '🍕 Uber Eats' },
  { id: '99food', label: '🥡 99Food' },
  { id: 'lalamove', label: '📦 Lalamove' },
]

export default function Settings({ user, subscription, onTab, onLogout }) {
  const { settings, updateSettings, trips, expenses } = useStore()
  const { theme, setTheme } = useTheme()
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ ...settings })
  const [notifStatus, setNotifStatus] = useState(getPermissionStatus())
  // change password state
  const [pwdForm, setPwdForm] = useState({ current: '', new: '', confirm: '' })
  const [pwdLoading, setPwdLoading] = useState(false)
  const [pwdError, setPwdError] = useState('')
  const [pwdOk, setPwdOk] = useState(false)
  const [showPwd, setShowPwd] = useState(false)

  useEffect(() => {
    setNotifStatus(getPermissionStatus())
  }, [])

  const handleSave = () => {
    updateSettings(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleExport = () => {
    const data = {
      exportDate: new Date().toISOString(),
      settings,
      trips: trips.slice(0, 1000),
      expenses: expenses.slice(0, 500),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `easydrive-backup-${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const custoKm = form.fuelConsumption > 0 ? form.fuelPrice / form.fuelConsumption : 0

  const handleChangePassword = async () => {
    setPwdError('')
    if (!pwdForm.new || pwdForm.new.length < 6) { setPwdError('Nova senha deve ter pelo menos 6 caracteres'); return }
    if (pwdForm.new !== pwdForm.confirm) { setPwdError('Senhas não coincidem'); return }
    if (!supabase) { setPwdError('Sem conexão com servidor'); return }
    setPwdLoading(true)
    try {
      // Re-autenticar primeiro
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user?.email, password: pwdForm.current })
      if (signInErr) { setPwdError('Senha atual incorreta'); setPwdLoading(false); return }
      // Atualizar senha
      const { error } = await supabase.auth.updateUser({ password: pwdForm.new })
      if (error) { setPwdError(error.message); setPwdLoading(false); return }
      setPwdOk(true)
      setPwdForm({ current: '', new: '', confirm: '' })
      setTimeout(() => setPwdOk(false), 4000)
    } catch { setPwdError('Erro ao alterar senha') }
    setPwdLoading(false)
  }

  return (
    <div style={{ padding: '16px 16px 90px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>Configurações</h1>

      {/* ═══════ TEMA ═══════ */}
      <Section icon={<Monitor size={16} color='#3b82f6' />} title='Aparência'>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[
            { id: 'dark',   label: 'Dark',    icon: <Moon size={16} /> },
            { id: 'light',  label: 'Normal',  icon: <Sun size={16} /> },
            { id: 'system', label: 'Sistema', icon: <Monitor size={16} /> },
          ].map((t) => {
            const active = theme === t.id
            return (
              <button key={t.id} onClick={() => setTheme(t.id)} style={{
                padding: '12px 0',
                background: active ? '#3b82f620' : 'var(--bg3)',
                border: `2px solid ${active ? '#3b82f6' : 'var(--border)'}`,
                borderRadius: 12, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                color: active ? '#3b82f6' : 'var(--text3)', fontWeight: active ? 700 : 400, fontSize: 12,
              }}>
                {t.icon}
                {t.label}
              </button>
            )
          })}
        </div>
      </Section>

      {/* Dados pessoais */}
      <Section icon={<User size={16} color='#22c55e' />} title='Dados pessoais'>
        <Label>Seu nome</Label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} placeholder='Ex: João Silva' />
        <Label>Placa do veículo</Label>
        <input value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value.toUpperCase() })} style={inputStyle} placeholder='Ex: ABC-1234' maxLength={8} />
      </Section>

      {/* Veículo */}
      <Section icon={<Car size={16} color='#a78bfa' />} title='Veículo'>
        <Label>Tipo de veículo</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
          {[
            { id: 'moto', label: '🏍️ Moto' },
            { id: 'carro', label: '🚗 Carro' },
            { id: 'bicicleta', label: '🚲 Bike' },
            { id: 'van', label: '🚐 Van' },
          ].map((v) => (
            <button
              key={v.id}
              onClick={() => setForm({ ...form, vehicle: v.id })}
              style={{
                padding: '10px 0', border: `2px solid ${form.vehicle === v.id ? '#22c55e' : '#334155'}`,
                borderRadius: 10, background: form.vehicle === v.id ? '#22c55e20' : '#1e293b',
                color: form.vehicle === v.id ? '#22c55e' : '#64748b',
                cursor: 'pointer', fontWeight: 700, fontSize: 12,
              }}
            >
              {v.label}
            </button>
          ))}
        </div>
      </Section>

      {/* Combustível */}
      <Section icon={<Fuel size={16} color='#f97316' />} title='Combustível'>
        <Label>Tipo de combustível</Label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
          {[
            { id: 'gasolina', label: '⛽ Gasolina' },
            { id: 'etanol', label: '🌿 Etanol' },
            { id: 'flex', label: '🔄 Flex' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setForm({ ...form, fuelType: f.id })}
              style={{
                padding: '10px 0', border: `2px solid ${form.fuelType === f.id ? '#f97316' : '#334155'}`,
                borderRadius: 10, background: form.fuelType === f.id ? '#f9731620' : '#1e293b',
                color: form.fuelType === f.id ? '#f97316' : '#64748b',
                cursor: 'pointer', fontWeight: 600, fontSize: 12,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Label>Preço do litro (R$)</Label>
        <input type='number' value={form.fuelPrice} onChange={(e) => setForm({ ...form, fuelPrice: parseFloat(e.target.value) || 0 })} step='0.01' style={inputStyle} placeholder='Ex: 6.49' />
        <Label>Consumo do veículo (km/L)</Label>
        <input type='number' value={form.fuelConsumption} onChange={(e) => setForm({ ...form, fuelConsumption: parseFloat(e.target.value) || 1 })} step='0.5' style={inputStyle} placeholder='Ex: 35' />

        {custoKm > 0 && (
          <div style={{ background: '#f9731615', border: '1px solid #f9731630', borderRadius: 10, padding: '12px 14px' }}>
            <p style={{ fontSize: 12, color: '#f97316', fontWeight: 700, marginBottom: 6 }}>Estimativas de custo</p>
            <p style={{ fontSize: 13, color: '#94a3b8' }}>Custo por km: <strong style={{ color: '#f1f5f9' }}>{fmt.currency(custoKm)}/km</strong></p>
          </div>
        )}
      </Section>

      {/* ═══════ METAS ═══════ */}
      <Section icon={<Target size={16} color='#f59e0b' />} title='Metas de Faturamento & Lucro'>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14, lineHeight: 1.5 }}>
          Defina suas metas para acompanhar o progresso no dashboard e nas conquistas.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <Label>💰 Meta diária (R$)</Label>
            <input type='number' value={form.goalDailyRevenue || ''} onChange={(e) => setForm({ ...form, goalDailyRevenue: parseFloat(e.target.value) || 0 })} style={inputStyle} placeholder='Ex: 200' />
          </div>
          <div>
            <Label>📈 Lucro diário (R$)</Label>
            <input type='number' value={form.goalDailyProfit || ''} onChange={(e) => setForm({ ...form, goalDailyProfit: parseFloat(e.target.value) || 0 })} style={inputStyle} placeholder='Ex: 150' />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <Label>💰 Meta semanal (R$)</Label>
            <input type='number' value={form.goalWeeklyRevenue || ''} onChange={(e) => setForm({ ...form, goalWeeklyRevenue: parseFloat(e.target.value) || 0 })} style={inputStyle} placeholder='Ex: 1200' />
          </div>
          <div>
            <Label>📈 Lucro semanal (R$)</Label>
            <input type='number' value={form.goalWeeklyProfit || ''} onChange={(e) => setForm({ ...form, goalWeeklyProfit: parseFloat(e.target.value) || 0 })} style={inputStyle} placeholder='Ex: 900' />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <Label>💰 Meta mensal (R$)</Label>
            <input type='number' value={form.goalMonthlyRevenue || ''} onChange={(e) => setForm({ ...form, goalMonthlyRevenue: parseFloat(e.target.value) || 0 })} style={inputStyle} placeholder='Ex: 5000' />
          </div>
          <div>
            <Label>📈 Lucro mensal (R$)</Label>
            <input type='number' value={form.goalMonthlyProfit || ''} onChange={(e) => setForm({ ...form, goalMonthlyProfit: parseFloat(e.target.value) || 0 })} style={inputStyle} placeholder='Ex: 3500' />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <Label>💰 Meta anual (R$)</Label>
            <input type='number' value={form.goalYearlyRevenue || ''} onChange={(e) => setForm({ ...form, goalYearlyRevenue: parseFloat(e.target.value) || 0 })} style={inputStyle} placeholder='Ex: 60000' />
          </div>
          <div>
            <Label>📈 Lucro anual (R$)</Label>
            <input type='number' value={form.goalYearlyProfit || ''} onChange={(e) => setForm({ ...form, goalYearlyProfit: parseFloat(e.target.value) || 0 })} style={inputStyle} placeholder='Ex: 42000' />
          </div>
        </div>
      </Section>

      {/* Plataformas ativas */}
      <Section icon={<DollarSign size={16} color='#22c55e' />} title='Plataformas ativas'>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {ALL_PLATFORMS.map((p) => {
            const active = form.platforms?.includes(p.id)
            return (
              <button
                key={p.id}
                onClick={() => {
                  const current = form.platforms || []
                  setForm({
                    ...form,
                    platforms: active ? current.filter((x) => x !== p.id) : [...current, p.id],
                  })
                }}
                style={{
                  padding: '11px 14px',
                  background: active ? '#22c55e15' : '#1e293b',
                  border: `1px solid ${active ? '#22c55e' : '#334155'}`,
                  borderRadius: 10, cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <span style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 13 }}>{p.label}</span>
                <span style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: active ? '#22c55e' : '#334155',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, color: '#fff',
                }}>
                  {active ? '✓' : ''}
                </span>
              </button>
            )
          })}
        </div>
      </Section>

      {/* ═══════ NOTIFICAÇÕES ═══════ */}
      <Section icon={<Bell size={16} color='#a855f7' />} title='Notificações Push'>
        <p style={{ fontSize: 12, color: '#64748b', marginBottom: 14, lineHeight: 1.5 }}>
          Receba alertas mesmo com o app minimizado: metas alcançadas, riscos, prejuízo e conquistas.
        </p>

        {notifStatus === 'unsupported' && (
          <div style={{ background: '#334155', borderRadius: 10, padding: 12 }}>
            <p style={{ fontSize: 13, color: '#94a3b8' }}>❌ Seu dispositivo não suporta notificações push.</p>
          </div>
        )}

        {notifStatus === 'granted' && (
          <>
            <div style={{
              background: '#22c55e15', border: '1px solid #22c55e40',
              borderRadius: 10, padding: '12px 14px', marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <Bell size={18} color='#22c55e' />
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: 14, color: '#22c55e' }}>Notificações ativas</p>
                <p style={{ fontSize: 12, color: '#64748b' }}>Você receberá alertas de metas e riscos</p>
              </div>
              <span style={{ fontSize: 20 }}>✅</span>
            </div>

            <Label>Tipos de alerta</Label>
            {[
              { key: 'notifGoals', label: '🎯 Metas (alcançadas e em risco)', defaultOn: true },
              { key: 'notifLoss', label: '🔴 Prejuízo (combustível > ganhos)', defaultOn: true },
              { key: 'notifSafety', label: '🚨 Riscos de segurança', defaultOn: true },
              { key: 'notifAchievements', label: '🏆 Conquistas desbloqueadas', defaultOn: true },
              { key: 'notifStreak', label: '🔥 Sequência em risco', defaultOn: true },
            ].map(({ key, label, defaultOn }) => {
              const on = form[key] !== false // padrão: ativo
              return (
                <button
                  key={key}
                  onClick={() => setForm({ ...form, [key]: !on })}
                  style={{
                    width: '100%', padding: '11px 14px', marginBottom: 8,
                    background: on ? '#a855f715' : '#1e293b',
                    border: `1px solid ${on ? '#a855f7' : '#334155'}`,
                    borderRadius: 10, cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <span style={{ color: '#f1f5f9', fontSize: 13 }}>{label}</span>
                  <span style={{
                    width: 40, height: 22, borderRadius: 11,
                    background: on ? '#a855f7' : '#334155',
                    position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                  }}>
                    <span style={{
                      position: 'absolute', top: 3,
                      left: on ? 20 : 3,
                      width: 16, height: 16, borderRadius: '50%',
                      background: '#fff', transition: 'left 0.2s',
                    }} />
                  </span>
                </button>
              )
            })}

            <button
              onClick={() => {
                // Desativar: orienta o usuário a revogar pelo browser
                alert('Para desativar, vá em Configurações do navegador > Permissões de Sites > Notificações e bloqueie este site.')
              }}
              style={{
                width: '100%', padding: '10px', marginTop: 6,
                background: 'none', border: '1px solid #334155',
                borderRadius: 10, color: '#64748b',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                cursor: 'pointer', fontSize: 13,
              }}
            >
              <BellOff size={15} />
              Desativar notificações
            </button>
          </>
        )}

        {(notifStatus === 'default' || notifStatus === 'denied') && (
          <button
            onClick={async () => {
              const granted = await requestNotificationPermission()
              if (granted) { registerServiceWorker(); setNotifStatus('granted') }
              else setNotifStatus(getPermissionStatus())
            }}
            style={{
              width: '100%', padding: '14px',
              background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
              border: 'none', borderRadius: 12, color: '#fff',
              fontSize: 15, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Bell size={18} />
            {notifStatus === 'denied' ? '🔒 Bloqueado — ative nas configurações do browser' : 'Ativar Notificações Push'}
          </button>
        )}
      </Section>

      {/* ═══════ SEGURANÇA ═══════ */}
      {supabase && user?.email && (
        <Section icon={<Lock size={16} color='#f59e0b' />} title='Segurança'>
          <Label>Alterar senha</Label>
          {pwdOk && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#22c55e20', border: '1px solid #22c55e40', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
              <CheckCircle size={14} color='#22c55e' />
              <span style={{ fontSize: 13, color: '#22c55e' }}>Senha alterada com sucesso!</span>
            </div>
          )}
          {['current', 'new', 'confirm'].map((field) => (
            <div key={field} style={{ position: 'relative', marginBottom: 10 }}>
              <Lock size={14} color='#64748b' style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type={showPwd ? 'text' : 'password'}
                value={pwdForm[field]}
                onChange={(e) => setPwdForm({ ...pwdForm, [field]: e.target.value })}
                placeholder={field === 'current' ? 'Senha atual' : field === 'new' ? 'Nova senha (mín. 6 char)' : 'Confirmar nova senha'}
                style={{ ...inputStyle, paddingLeft: 36, paddingRight: 36 }}
              />
              {field === 'confirm' && (
                <button type='button' onClick={() => setShowPwd(!showPwd)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  {showPwd ? <EyeOff size={16} color='#64748b' /> : <Eye size={16} color='#64748b' />}
                </button>
              )}
            </div>
          ))}
          {pwdError && (
            <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 10, paddingLeft: 4 }}>{pwdError}</p>
          )}
          <button onClick={handleChangePassword} disabled={pwdLoading} style={{
            width: '100%', padding: '12px', background: '#f59e0b20', border: '1px solid #f59e0b60',
            borderRadius: 12, color: '#f59e0b', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: pwdLoading ? 0.7 : 1,
          }}>
            <Lock size={15} />
            {pwdLoading ? 'Alterando...' : 'Alterar senha'}
          </button>
        </Section>
      )}

      {/* Salvar */}
      <button onClick={handleSave} style={{
        width: '100%', padding: '16px', marginBottom: 12,
        background: saved ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'linear-gradient(135deg, #22c55e, #15803d)',
        border: 'none', borderRadius: 14, color: '#fff',
        fontSize: 16, fontWeight: 700, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        <Save size={18} />
        {saved ? 'Salvo!' : 'Salvar configurações'}
      </button>

      <button onClick={handleExport} style={{
        width: '100%', padding: '14px', background: 'var(--bg3)', border: '1px solid var(--border)',
        borderRadius: 14, color: 'var(--text2)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        marginBottom: 12,
      }}>
        <Download size={16} />
        Exportar dados (JSON)
      </button>

      {/* Faturamento */}
      {onTab && (
        <button onClick={() => onTab('billing')} style={{
          width: '100%', padding: '14px', background: '#3b82f615', border: '1px solid #3b82f640',
          borderRadius: 14, color: '#3b82f6', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          marginBottom: 12,
        }}>
          <CreditCard size={16} />
          Faturamento & Assinatura
          {subscription && !subscription.active && (
            <span style={{ background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20 }}>Vencida</span>
          )}
        </button>
      )}

      {/* Logout */}
      {onLogout && (
        <button onClick={onLogout} style={{
          width: '100%', padding: '14px', background: 'none', border: '1px solid #ef444440',
          borderRadius: 14, color: '#ef4444', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          marginBottom: 12,
        }}>
          <LogOut size={16} />
          Sair da conta
        </button>
      )}

      <div style={{ marginTop: 12, padding: 14, background: 'var(--bg3)', borderRadius: 12, border: '1px solid var(--border)' }}>
        <p style={{ fontSize: 12, color: 'var(--text4)', textAlign: 'center' }}>EasyDrive v1.0 by Seven Xperts</p>
        <p style={{ fontSize: 12, color: 'var(--text4)', textAlign: 'center', marginTop: 4 }}>{trips.length} corridas • {expenses.length} gastos registrados</p>
        {user?.email && <p style={{ fontSize: 11, color: 'var(--text4)', textAlign: 'center', marginTop: 4 }}>{user.email}</p>}
      </div>
    </div>
  )
}

function Section({ icon, title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
        {icon}
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Label({ children }) {
  return <p style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{children}</p>
}

const inputStyle = {
  width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
  borderRadius: 10, padding: '12px 14px', color: 'var(--text)',
  fontSize: 15, outline: 'none', marginBottom: 14, boxSizing: 'border-box',
}
