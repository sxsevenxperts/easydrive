import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { createClient } from '@supabase/supabase-js'

// Admin client with service role key (used only in this admin-only page)
const adminSupabase = (() => {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_SERVICE_KEY
  if (!url || !key) return supabase
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
})()
import {
  Users, TrendingUp, DollarSign, MapPin, Trophy,
  ArrowLeft, Search, ChevronRight, BarChart3, Clock,
  CreditCard, AlertTriangle, Activity, RefreshCw, Loader,
  Car, Fuel, Wrench, FileText, Shield, Star, Eye,
  UserPlus, CheckCircle, XCircle,
} from 'lucide-react'

// ── Admin Dashboard KPIs ──
function AdminDashboard({ data, onViewUsers, onViewRankings, onViewPeakHours, onViewSubscriptions, onAddSubscriber }) {
  if (!data) return null

  const kpis = [
    { icon: <Users size={18} />, label: 'Motoristas', value: data.total_drivers, color: '#3b82f6' },
    { icon: <Shield size={18} />, label: 'Assinaturas ativas', value: data.active_subscriptions, color: '#22c55e' },
    { icon: <AlertTriangle size={18} />, label: 'Assinaturas vencidas', value: data.expired_subscriptions, color: '#ef4444' },
    { icon: <Activity size={18} />, label: 'Corridas hoje', value: data.total_trips_today, color: '#f59e0b' },
  ]

  const financials = [
    { label: 'Ganhos motoristas (hoje)', value: `R$ ${Number(data.total_earnings_today || 0).toFixed(2).replace('.', ',')}`, color: '#22c55e' },
    { label: 'Ganhos motoristas (mês)', value: `R$ ${Number(data.total_earnings_month || 0).toFixed(2).replace('.', ',')}`, color: '#3b82f6' },
    { label: 'Corridas no mês', value: data.total_trips_month, color: '#a855f7' },
    { label: 'KM rodados no mês', value: `${Number(data.total_km_month || 0).toFixed(0)} km`, color: '#06b6d4' },
    { label: 'Receita Hotmart (mês)', value: `R$ ${Number(data.revenue_hotmart || 0).toFixed(2).replace('.', ',')}`, color: '#f59e0b' },
  ]

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{
            background: '#1e293b', borderRadius: 14, padding: 16,
            border: '1px solid #334155',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: k.color }}>
              {k.icon}
              <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>{k.label}</span>
            </div>
            <p style={{ fontSize: 28, fontWeight: 900, color: '#f1f5f9' }}>{k.value ?? 0}</p>
          </div>
        ))}
      </div>

      {/* Financeiro */}
      <SectionTitle icon={<DollarSign size={14} color='#22c55e' />}>Financeiro</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {financials.map((f) => (
          <div key={f.label} style={{
            background: '#1e293b', borderRadius: 12, padding: '12px 16px',
            border: '1px solid #334155',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 13, color: '#94a3b8' }}>{f.label}</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: f.color }}>{f.value}</span>
          </div>
        ))}
      </div>

      {/* Top motoristas hoje */}
      {data.top_earners_today?.length > 0 && (
        <>
          <SectionTitle icon={<Trophy size={14} color='#f59e0b' />}>Top Motoristas Hoje</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {data.top_earners_today.map((t, i) => (
              <div key={i} style={{
                background: '#1e293b', borderRadius: 12, padding: '10px 14px',
                border: '1px solid #334155',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : '#cd7f32',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 900, color: '#000',
                }}>
                  {i + 1}º
                </span>
                {t.avatar_url ? (
                  <img src={t.avatar_url} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Users size={14} color='#64748b' />
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{t.display_name || 'Sem nome'}</p>
                  <p style={{ fontSize: 11, color: '#64748b' }}>{t.trips} corridas</p>
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#22c55e' }}>
                  R$ {Number(t.earnings).toFixed(2).replace('.', ',')}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Cadastros recentes */}
      {data.recent_signups?.length > 0 && (
        <>
          <SectionTitle icon={<Users size={14} color='#3b82f6' />}>Cadastros Recentes</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
            {data.recent_signups.map((s, i) => (
              <div key={i} style={{
                background: '#1e293b', borderRadius: 10, padding: '10px 14px',
                border: '1px solid #334155',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{s.display_name || s.email}</p>
                  <p style={{ fontSize: 11, color: '#64748b' }}>{s.city || 'Sem cidade'}</p>
                </div>
                <span style={{ fontSize: 11, color: '#475569' }}>
                  {new Date(s.created_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Ações rápidas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <ActionButton icon={<Users size={18} />} label='Ver Motoristas' color='#3b82f6' onClick={onViewUsers} />
        <ActionButton icon={<Trophy size={18} />} label='Rankings' color='#f59e0b' onClick={onViewRankings} />
        <ActionButton icon={<BarChart3 size={18} />} label='Pico de Horários' color='#06b6d4' onClick={onViewPeakHours} />
        <ActionButton icon={<CreditCard size={18} />} label='Assinaturas' color='#a855f7' onClick={onViewSubscriptions} />
      </div>
      <ActionButton icon={<UserPlus size={18} />} label='+ Novo Assinante' color='#22c55e' onClick={onAddSubscriber} full />
    </div>
  )
}

// ── Lista de todos os motoristas ──
function UserList({ users, onSelect, onDelete, onBack }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search) return users
    const q = search.toLowerCase()
    return users.filter(u =>
      (u.display_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.city || '').toLowerCase().includes(q) ||
      (u.vehicle_plate || '').toLowerCase().includes(q)
    )
  }, [users, search])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={onBack} style={S.backBtn}><ArrowLeft size={18} /></button>
        <h2 style={{ fontSize: 18, fontWeight: 800 }}>Motoristas ({users.length})</h2>
      </div>

      {/* Busca */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: '#1e293b', borderRadius: 12, padding: '10px 14px',
        border: '1px solid #334155', marginBottom: 16,
      }}>
        <Search size={16} color='#64748b' />
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder='Buscar por nome, email, cidade ou placa...'
          style={{
            background: 'none', border: 'none', color: '#f1f5f9',
            fontSize: 14, outline: 'none', flex: 1,
          }}
        />
      </div>

      {/* Lista */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map((u) => {
          const subColor = u.sub_status === 'active' && u.sub_expires && new Date(u.sub_expires) > new Date()
            ? '#22c55e' : '#ef4444'

          return (
            <div key={u.user_id} onClick={() => onSelect(u.user_id)}
              style={{
                background: '#1e293b', borderRadius: 14, padding: 14,
                border: '1px solid #334155', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12,
              }}
            >
              {u.avatar_url ? (
                <img src={u.avatar_url} style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={18} color='#64748b' />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>
                  {u.display_name || 'Sem nome'}
                </p>
                <p style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.email}
                </p>
                <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  {u.city && <Tag>{u.city}</Tag>}
                  {u.vehicle_type && <Tag>{u.vehicle_type === 'moto' ? '🏍️ Moto' : '🚗 Carro'}</Tag>}
                  {u.vehicle_plate && <Tag>{u.vehicle_plate}</Tag>}
                  <Tag color={subColor}>
                    {subColor === '#22c55e' ? '● Ativo' : '● Vencido'}
                  </Tag>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: '#22c55e' }}>
                  R$ {Number(u.total_earnings || 0).toFixed(0)}
                </p>
                <p style={{ fontSize: 11, color: '#64748b' }}>{u.total_trips || 0} corridas</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, justifyContent: 'flex-end' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete?.(u.user_id); }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#ef4444', padding: '4px 6px', display: 'flex', alignItems: 'center',
                    }}
                    title='Remover usuário'
                  >
                    <XCircle size={18} />
                  </button>
                  <ChevronRight size={14} color='#475569' />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Detalhe de um motorista ──
function UserDetail({ userId, onBack }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [grantingFree, setGrantingFree] = useState(false)
  const [tab, setTab] = useState('overview') // overview | trips | expenses | payments

  useEffect(() => {
    loadData()
  }, [userId])

  async function loadData() {
    setLoading(true)
    supabase.rpc('admin_get_user_detail', { target_user_id: userId })
      .then(({ data: d }) => setData(d))
      .finally(() => setLoading(false))
  }

  async function grantFreeSubscription() {
    setGrantingFree(true)
    try {
      const expiresAt = new Date()
      expiresAt.setFullYear(expiresAt.getFullYear() + 1) // 1 ano grátis
      
      const { error } = await adminSupabase.from('subscriptions').upsert({
        user_id: userId,
        status: 'active',
        plan: 'basic',
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

      if (error) throw error
      alert('✅ Assinatura gratuita ativada por 1 ano!')
      await loadData()
    } catch (err) {
      alert('❌ Erro: ' + (err.message || 'Tente novamente'))
    }
    setGrantingFree(false)
  }

  if (loading) return <Loading />
  if (!data) return <p style={{ color: '#ef4444', textAlign: 'center', marginTop: 40 }}>Erro ao carregar dados</p>

  const p = data.profile
  const tabs = [
    { id: 'overview', label: 'Resumo', icon: <BarChart3 size={14} /> },
    { id: 'trips', label: 'Corridas', icon: <MapPin size={14} /> },
    { id: 'expenses', label: 'Gastos', icon: <DollarSign size={14} /> },
    { id: 'payments', label: 'Pagamentos', icon: <CreditCard size={14} /> },
  ]

  return (
    <div>
      {/* Header com perfil */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={onBack} style={S.backBtn}><ArrowLeft size={18} /></button>
        {p?.avatar_url ? (
          <img src={p.avatar_url} style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={18} color='#64748b' />
          </div>
        )}
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9' }}>{p?.display_name || p?.email}</h2>
          <p style={{ fontSize: 12, color: '#64748b' }}>
            {p?.city || ''} • {p?.vehicle_type === 'moto' ? '🏍️' : '🚗'} {p?.vehicle_plate || ''}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto' }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '8px 14px', borderRadius: 10, border: 'none',
              background: tab === t.id ? '#3b82f6' : '#1e293b',
              color: tab === t.id ? '#fff' : '#94a3b8',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Conteúdo por tab */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <KpiCard label='Total Corridas' value={data.trips_count} icon={<Car size={16} />} color='#3b82f6' />
          <KpiCard label='Total Ganho' value={`R$ ${Number(data.trips_total_earnings || 0).toFixed(2).replace('.', ',')}`} icon={<DollarSign size={16} />} color='#22c55e' />
          <KpiCard label='KM Rodados' value={`${Number(data.trips_total_km || 0).toFixed(0)} km`} icon={<MapPin size={16} />} color='#06b6d4' />
          <KpiCard label='Total Gastos' value={`R$ ${Number(data.expenses_total || 0).toFixed(2).replace('.', ',')}`} icon={<Fuel size={16} />} color='#f59e0b' />
          <KpiCard label='Abastecimentos' value={data.fuel_logs_count} icon={<Fuel size={16} />} color='#a855f7' />
          <KpiCard label='Manutenções' value={data.maintenance_count} icon={<Wrench size={16} />} color='#ec4899' />
          <KpiCard label='Documentos' value={data.documents_count} icon={<FileText size={16} />} color='#64748b' />
          <KpiCard
            label='Assinatura'
            value={data.subscription?.status === 'active' ? '✅ Ativa' : '❌ Inativa'}
            icon={<Shield size={16} />}
            color={data.subscription?.status === 'active' ? '#22c55e' : '#ef4444'}
          />
        </div>
      )}

      {/* Botão Assinatura Grátis — aparece na tab overview */}
      {tab === 'overview' && (
        <div style={{ marginTop: 14 }}>
          <button
            onClick={grantFreeSubscription}
            disabled={grantingFree}
            style={{
              width: '100%', padding: '14px', borderRadius: 12, border: 'none',
              background: data.subscription?.status === 'active' ? '#1e293b' : '#22c55e',
              color: data.subscription?.status === 'active' ? '#64748b' : '#fff',
              fontWeight: 800, fontSize: 15, cursor: grantingFree ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              border: '1px solid',
              borderColor: data.subscription?.status === 'active' ? '#334155' : '#22c55e',
            }}
          >
            <CheckCircle size={18} />
            {grantingFree ? 'Ativando...' : data.subscription?.status === 'active' ? '🔁 Renovar por mais 1 ano' : '🎁 Dar Assinatura Grátis (1 ano)'}
          </button>
        </div>
      )}

      {tab === 'trips' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(data.recent_trips || []).length === 0 && <EmptyState text='Nenhuma corrida registrada' />}
          {(data.recent_trips || []).map((t) => (
            <div key={t.id} style={{
              background: '#1e293b', borderRadius: 12, padding: 12,
              border: '1px solid #334155',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
                  {t.platform?.toUpperCase()} {t.manual ? '(manual)' : ''}
                </span>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#22c55e' }}>
                  R$ {Number(t.earnings || 0).toFixed(2).replace('.', ',')}
                </span>
              </div>
              <p style={{ fontSize: 12, color: '#64748b' }}>
                {t.pickup_address || '—'} → {t.dest_address || '—'}
              </p>
              <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 11, color: '#475569' }}>
                <span>{Number(t.km || 0).toFixed(1)} km</span>
                <span>Comb: R$ {Number(t.fuel_cost || 0).toFixed(2)}</span>
                <span>{t.start_time ? new Date(t.start_time).toLocaleDateString('pt-BR') : '—'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'expenses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(data.recent_expenses || []).length === 0 && <EmptyState text='Nenhum gasto registrado' />}
          {(data.recent_expenses || []).map((e) => (
            <div key={e.id} style={{
              background: '#1e293b', borderRadius: 12, padding: 12,
              border: '1px solid #334155',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>
                  {e.category === 'combustivel' ? '⛽ Combustível' :
                   e.category === 'manutencao' ? '🔧 Manutenção' :
                   e.category === 'seguro' ? '🛡️ Seguro' :
                   e.category === 'multa' ? '🚫 Multa' :
                   e.category === 'lanche' ? '🍔 Lanche' :
                   e.category || '📋 Outro'}
                </p>
                {e.note && <p style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{e.note}</p>}
              </div>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#f59e0b' }}>
                R$ {Number(e.value || 0).toFixed(2).replace('.', ',')}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === 'payments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(data.payments || []).length === 0 && <EmptyState text='Nenhum pagamento registrado' />}
          {(data.payments || []).map((p) => (
            <div key={p.id} style={{
              background: '#1e293b', borderRadius: 12, padding: 12,
              border: '1px solid #334155',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>
                  {p.status === 'approved' ? '✅' : '❌'} {p.event_type || 'Pagamento'}
                </p>
                <p style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  {new Date(p.created_at).toLocaleDateString('pt-BR')}
                  {p.payment_method && ` • ${p.payment_method}`}
                </p>
              </div>
              <span style={{ fontSize: 14, fontWeight: 800, color: p.status === 'approved' ? '#22c55e' : '#ef4444' }}>
                R$ {Number(p.amount || 0).toFixed(2).replace('.', ',')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Rankings ──
const PERIODS = [
  { id: 'day', label: 'Hoje' },
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mês' },
  { id: 'year', label: 'Ano' },
  { id: 'custom', label: 'Período' },
]
const METRICS = [
  { id: 'earnings', label: 'Faturamento', icon: <DollarSign size={14} />, color: '#22c55e', key: 'total_earnings', fmt: (v) => `R$ ${Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}` },
  { id: 'trips',    label: 'Corridas',    icon: <Activity size={14} />,   color: '#3b82f6', key: 'total_trips',    fmt: (v) => `${v||0} corridas` },
  { id: 'profit',   label: 'Lucro',       icon: <TrendingUp size={14} />, color: '#a855f7', key: 'total_profit',   fmt: (v) => `R$ ${Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}` },
  { id: 'km',       label: 'KM',          icon: <MapPin size={14} />,     color: '#f59e0b', key: 'total_km',       fmt: (v) => `${Number(v||0).toFixed(0)} km` },
]
const MEDAL = ['#f59e0b', '#94a3b8', '#cd7f32']

function Rankings({ onBack }) {
  const [period, setPeriod] = useState('month')
  const [metric, setMetric] = useState('earnings')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    const params = { sort_by: metric }
    if (period === 'custom' && dateFrom) {
      params.date_from = new Date(dateFrom).toISOString()
      params.date_to = dateTo ? new Date(dateTo).toISOString() : new Date().toISOString()
    } else {
      params.period = period
    }
    supabase.rpc('admin_get_rankings', params)
      .then(({ data: d }) => setData(d || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [period, metric])

  const activeMeta = METRICS.find(m => m.id === metric)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={onBack} style={S.backBtn}><ArrowLeft size={18} /></button>
        <h2 style={{ fontSize: 18, fontWeight: 800 }}>🏆 Rankings</h2>
      </div>

      {/* Métrica */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 12 }}>
        {METRICS.map((m) => (
          <button key={m.id} onClick={() => setMetric(m.id)} style={{
            padding: '9px 4px', borderRadius: 10, border: `1px solid ${metric===m.id ? m.color : '#1e293b'}`,
            background: metric===m.id ? m.color+'20' : '#1e293b',
            color: metric===m.id ? m.color : '#64748b',
            fontSize: 11, fontWeight: 700, cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          }}>
            {m.icon}
            {m.label}
          </button>
        ))}
      </div>

      {/* Período */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
        {PERIODS.map((p) => (
          <button key={p.id} onClick={() => setPeriod(p.id)} style={{
            flex: 1, padding: '8px 0', borderRadius: 10, border: 'none',
            background: period===p.id ? '#3b82f6' : '#1e293b',
            color: period===p.id ? '#fff' : '#64748b',
            fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date range */}
      {period === 'custom' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input type='date' value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '9px 10px', color: '#f1f5f9', fontSize: 13 }} />
          <input type='date' value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '9px 10px', color: '#f1f5f9', fontSize: 13 }} />
          <button onClick={load} style={{
            background: '#3b82f6', border: 'none', borderRadius: 10, padding: '9px 14px',
            color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
          }}>Filtrar</button>
        </div>
      )}

      {loading ? <Loading /> : data.length === 0 ? (
        <EmptyState text='Nenhum dado para este período' />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.map((r) => (
            <div key={r.user_id} style={{
              background: r.rank <= 3 ? `${MEDAL[r.rank-1]}10` : '#1e293b',
              border: `1px solid ${r.rank <= 3 ? `${MEDAL[r.rank-1]}40` : '#334155'}`,
              borderRadius: 14, padding: 14,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: r.rank <= 3 ? MEDAL[r.rank-1] : '#334155',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 900, color: r.rank <= 3 ? '#000' : '#94a3b8',
              }}>
                {r.rank <= 3 ? ['🥇','🥈','🥉'][r.rank-1] : `${r.rank}º`}
              </span>
              {r.avatar_url
                ? <img src={r.avatar_url} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                : <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Users size={14} color='#64748b' />
                  </div>
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>{r.display_name || 'Sem nome'}</p>
                <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#64748b', marginTop: 3, flexWrap: 'wrap' }}>
                  <span>{r.total_trips} corridas</span>
                  <span>{Number(r.total_km||0).toFixed(0)} km</span>
                  {r.city && <span>{r.city}{r.state ? `/${r.state}` : ''}</span>}
                </div>
                <div style={{ display: 'flex', gap: 10, fontSize: 11, marginTop: 4 }}>
                  <span style={{ color: '#22c55e' }}>Fat: R${Number(r.total_earnings||0).toFixed(0)}</span>
                  <span style={{ color: '#ef4444' }}>Desp: R${Number(r.total_expenses||0).toFixed(0)}</span>
                  <span style={{ color: '#a855f7' }}>Lucro: R${Number(r.total_profit||0).toFixed(0)}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontSize: 17, fontWeight: 900, color: activeMeta.color }}>
                  {activeMeta.fmt(r[activeMeta.key])}
                </p>
                <p style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                  R${Number(r.avg_per_hour||0).toFixed(0)}/h
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Horários de Pico ──
const DAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

function PeakHours({ onBack }) {
  const [period, setPeriod] = useState('month')
  const [filterCity, setFilterCity] = useState('')
  const [filterState, setFilterState] = useState('')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    supabase.rpc('admin_get_peak_hours', {
      period,
      filter_city: filterCity || null,
      filter_state: filterState || null,
    }).then(({ data: d }) => setData(d || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [period])

  // Build grid: day × hour → driver_count
  const maxDrivers = Math.max(1, ...data.map(d => d.driver_count || 0))
  const grid = {}
  data.forEach(d => { grid[`${d.day_of_week}-${d.hour_of_day}`] = d })

  const cellColor = (count) => {
    if (!count) return '#0f172a'
    const intensity = count / maxDrivers
    if (intensity > 0.75) return '#ef4444'
    if (intensity > 0.5)  return '#f59e0b'
    if (intensity > 0.25) return '#22c55e'
    return '#1e293b'
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={onBack} style={S.backBtn}><ArrowLeft size={18} /></button>
        <h2 style={{ fontSize: 18, fontWeight: 800 }}>📊 Horários de Pico</h2>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
        {PERIODS.filter(p => p.id !== 'custom').map((p) => (
          <button key={p.id} onClick={() => setPeriod(p.id)} style={{
            flex: 1, padding: '8px 0', borderRadius: 10, border: 'none',
            background: period===p.id ? '#3b82f6' : '#1e293b',
            color: period===p.id ? '#fff' : '#64748b',
            fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}>{p.label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input value={filterCity} onChange={e => setFilterCity(e.target.value)}
          placeholder='Cidade (ex: São Paulo)'
          style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '9px 12px', color: '#f1f5f9', fontSize: 12 }} />
        <input value={filterState} onChange={e => setFilterState(e.target.value)}
          placeholder='Estado (ex: SP)'
          style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '9px 12px', color: '#f1f5f9', fontSize: 12 }} />
        <button onClick={load} style={{
          background: '#3b82f6', border: 'none', borderRadius: 10, padding: '9px 12px',
          color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
        }}>Filtrar</button>
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
        {[['#1e293b','Baixo'],['#22c55e','Médio'],['#f59e0b','Alto'],['#ef4444','Pico']].map(([c,l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: c }} />
            <span style={{ fontSize: 10, color: '#64748b' }}>{l}</span>
          </div>
        ))}
      </div>

      {loading ? <Loading /> : data.length === 0 ? <EmptyState text='Sem dados de corridas neste período' /> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 400 }}>
            <thead>
              <tr>
                <th style={{ fontSize: 10, color: '#475569', padding: '4px 6px', textAlign: 'left' }}>Hora</th>
                {DAYS.map(d => (
                  <th key={d} style={{ fontSize: 10, color: '#475569', padding: '4px 3px', textAlign: 'center', width: 38 }}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({length: 24}, (_, hr) => (
                <tr key={hr}>
                  <td style={{ fontSize: 10, color: '#475569', padding: '2px 6px', whiteSpace: 'nowrap' }}>
                    {String(hr).padStart(2,'0')}h
                  </td>
                  {Array.from({length: 7}, (_, dow) => {
                    const cell = grid[`${dow}-${hr}`]
                    return (
                      <td key={dow} style={{ padding: 2 }}>
                        <div
                          title={cell ? `${DAYS[dow]} ${hr}h — ${cell.driver_count} motoristas, ${cell.total_trips} corridas` : ''}
                          style={{
                            width: 34, height: 22, borderRadius: 4,
                            background: cellColor(cell?.driver_count || 0),
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          {cell?.driver_count > 0 && (
                            <span style={{ fontSize: 9, fontWeight: 700, color: '#fff' }}>{cell.driver_count}</span>
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ fontSize: 10, color: '#334155', marginTop: 8, textAlign: 'center' }}>
        Números = motoristas ativos naquela faixa horária
      </p>
    </div>
  )
}

// ── Assinaturas ──
function SubscriptionStats({ onBack }) {
  const [period, setPeriod] = useState('month')
  const [stats, setStats] = useState(null)
  const [defaulters, setDefaulters] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      supabase.rpc('admin_get_subscription_stats', { period }),
      supabase.from('subscriptions')
        .select('user_id, plan, status, expires_at, suspended_at, profiles!inner(display_name, email, city)')
        .in('status', ['suspended', 'active'])
        .lt('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: true })
        .limit(50),
    ]).then(([{ data: s }, { data: d }]) => {
      setStats(s)
      setDefaulters(d || [])
    }).finally(() => setLoading(false))
  }, [period])

  const fmt = (v) => Number(v || 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={onBack} style={S.backBtn}><ArrowLeft size={18} /></button>
        <h2 style={{ fontSize: 18, fontWeight: 800 }}>💳 Assinaturas</h2>
      </div>

      {/* Período */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 14 }}>
        {PERIODS.filter(p => p.id !== 'custom').map((p) => (
          <button key={p.id} onClick={() => setPeriod(p.id)} style={{
            flex: 1, padding: '8px 0', borderRadius: 10, border: 'none',
            background: period===p.id ? '#3b82f6' : '#1e293b',
            color: period===p.id ? '#fff' : '#64748b',
            fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}>{p.label}</button>
        ))}
      </div>

      {loading ? <Loading /> : (
        <>
          {/* KPIs */}
          {stats && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
              {[
                { label: 'Ativas', value: fmt(stats.active), color: '#22c55e' },
                { label: 'Expiradas', value: fmt(stats.expired), color: '#ef4444' },
                { label: 'Suspensas', value: fmt(stats.suspended), color: '#f59e0b' },
                { label: 'Novas (período)', value: fmt(stats.new_period), color: '#3b82f6' },
                { label: 'Canceladas (período)', value: fmt(stats.churned_period), color: '#a855f7' },
                { label: 'Total', value: fmt(stats.total), color: '#64748b' },
              ].map(k => (
                <div key={k.label} style={{
                  background: '#1e293b', borderRadius: 12, padding: '12px 10px',
                  border: `1px solid ${k.color}30`,
                }}>
                  <p style={{ fontSize: 10, color: '#64748b', marginBottom: 4, textTransform: 'uppercase' }}>{k.label}</p>
                  <p style={{ fontSize: 22, fontWeight: 900, color: k.color }}>{k.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Inadimplentes */}
          <SectionTitle icon={<AlertTriangle size={14} color='#ef4444' />}>
            Inadimplentes ({defaulters.length})
          </SectionTitle>
          {defaulters.length === 0 ? (
            <EmptyState text='Nenhum inadimplente no momento 🎉' />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {defaulters.map((d, i) => (
                <div key={i} style={{
                  background: '#1e293b', borderRadius: 12, padding: '12px 14px',
                  border: `1px solid ${d.status === 'suspended' ? '#f59e0b40' : '#ef444440'}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>
                        {d.profiles?.display_name || d.profiles?.email || 'Sem nome'}
                      </p>
                      <p style={{ fontSize: 11, color: '#64748b' }}>
                        {d.profiles?.city} · Plano: {d.plan?.toUpperCase()}
                      </p>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                      background: d.status === 'suspended' ? '#f59e0b20' : '#ef444420',
                      color: d.status === 'suspended' ? '#f59e0b' : '#ef4444',
                    }}>
                      {d.status === 'suspended' ? 'Suspenso' : 'Expirado'}
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>
                    Venceu: {new Date(d.expires_at).toLocaleDateString('pt-BR')}
                    {d.suspended_at && ` · Suspenso: ${new Date(d.suspended_at).toLocaleDateString('pt-BR')}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ══════════════════════════════════════
// COMPONENTE PRINCIPAL — AdminPanel
// ══════════════════════════════════════
export default function AdminPanel({ user, onLogout }) {
  const [view, setView] = useState('dashboard') // 'dashboard' | 'users' | 'user_detail' | 'rankings' | 'peak_hours' | 'subscriptions' | 'add_subscriber'
  const [dashboard, setDashboard] = useState(null)
  const [users, setUsers] = useState([])
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [loading, setLoading] = useState(true)

  // Carregar dashboard data
  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    setLoading(true)
    try {
      const { data } = await supabase.rpc('admin_get_dashboard')
      setDashboard(data)
    } catch {}
    setLoading(false)
  }

  async function loadUsers() {
    try {
      const { data } = await supabase.rpc('admin_get_all_users')
      setUsers(data || [])
    } catch {}
    setView('users')
  }

  async function deleteUser(userId) {
    if (!window.confirm('⚠️ Tem certeza que deseja remover este usuário? Esta ação não pode ser desfeita!')) {
      return
    }
    
    try {
      const { error } = await adminSupabase.auth.admin.deleteUser(userId)
      if (error) throw error
      
      // Remover da lista local
      setUsers(users.filter(u => u.user_id !== userId))
      
      // Recarregar dashboard
      await loadDashboard()
      
      alert('✅ Usuário removido com sucesso!')
    } catch (err) {
      alert('❌ Erro ao remover usuário: ' + (err.message || 'Tente novamente'))
    }
  }

  return (
    <div style={{
      background: '#0f172a', minHeight: '100dvh', color: '#f1f5f9',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '16px 16px 30px' }}>

        {/* Header */}
        {view === 'dashboard' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 900 }}>🛡️ Admin EasyDrive</h1>
              <p style={{ fontSize: 12, color: '#64748b' }}>
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={loadDashboard} style={{ ...S.backBtn, borderRadius: 10, padding: 8 }}>
                <RefreshCw size={16} />
              </button>
              <button onClick={onLogout} style={{
                background: '#ef444420', border: '1px solid #ef444440',
                borderRadius: 10, padding: '8px 14px', color: '#ef4444',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>
                Sair
              </button>
            </div>
          </div>
        )}

        {/* Conteúdo */}
        {loading && view === 'dashboard' ? <Loading /> : (
          <>
            {view === 'dashboard' && (
              <AdminDashboard
                data={dashboard}
                onViewUsers={loadUsers}
                onViewRankings={() => setView('rankings')}
                onViewPeakHours={() => setView('peak_hours')}
                onViewSubscriptions={() => setView('subscriptions')}
                onAddSubscriber={() => setView('add_subscriber')}
              />
            )}
            {view === 'users' && (
              <UserList
                users={users}
                onSelect={(id) => { setSelectedUserId(id); setView('user_detail') }}
                onDelete={deleteUser}
                onBack={() => setView('dashboard')}
              />
            )}
            {view === 'user_detail' && (
              <UserDetail
                userId={selectedUserId}
                onBack={() => setView('users')}
              />
            )}
            {view === 'rankings' && (
              <Rankings onBack={() => setView('dashboard')} />
            )}
            {view === 'peak_hours' && (
              <PeakHours onBack={() => setView('dashboard')} />
            )}
            {view === 'subscriptions' && (
              <SubscriptionStats onBack={() => setView('dashboard')} />
            )}
            {view === 'add_subscriber' && (
              <AddSubscriber onBack={() => setView('dashboard')} onSuccess={() => { setView('dashboard'); loadDashboard() }} />
            )}
          </>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 40, padding: '10px 0' }}>
          <p style={{ fontSize: 11, color: '#475569' }}>
            Powered by <strong>Seven Xperts</strong>
          </p>
          <p style={{ fontSize: 10, color: '#334155' }}>
            CNPJ 32.794.007/0001-19
          </p>
        </div>
      </div>
    </div>
  )
}

// ═══ Componentes auxiliares ═══

function SectionTitle({ icon, children }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10 }}>
      {icon}
      <h3 style={{ fontSize: 13, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>{children}</h3>
    </div>
  )
}

function KpiCard({ label, value, icon, color }) {
  return (
    <div style={{
      background: '#1e293b', borderRadius: 12, padding: 14,
      border: '1px solid #334155',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color }}>
        {icon}
        <span style={{ fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <p style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9' }}>{value ?? 0}</p>
    </div>
  )
}

function ActionButton({ icon, label, color, onClick, full }) {
  return (
    <button onClick={onClick} style={{
      background: `${color}15`, border: `1px solid ${color}40`,
      borderRadius: 14, padding: 16, cursor: 'pointer',
      display: 'flex', flexDirection: full ? 'row' : 'column',
      alignItems: 'center', justifyContent: full ? 'center' : undefined,
      gap: 8, color, width: full ? '100%' : undefined,
    }}>
      {icon}
      <span style={{ fontSize: 13, fontWeight: 700 }}>{label}</span>
    </button>
  )
}

// ── Componente: Criar novo assinante manualmente ──
function AddSubscriber({ onBack, onSuccess }) {
  const [email, setEmail] = useState('')
  const [plan, setPlan] = useState('basic')
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const plans = [
    { id: 'basic', label: 'Basic', desc: 'Acesso padrão' },
    { id: 'premium', label: 'Premium', desc: 'Todos os recursos' },
    { id: 'trial', label: 'Trial', desc: 'Avaliação grátis' },
  ]

  const handleCreate = async () => {
    if (!email || !email.includes('@')) { setError('Email inválido'); return }
    setError('')
    setLoading(true)
    try {
      const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
      let userId
      let isNew = false

      // 1. Check if user exists
      const { data: listData } = await adminSupabase.auth.admin.listUsers({ perPage: 1000 })
      const existing = listData?.users?.find(u => u.email === email)

      if (existing) {
        userId = existing.id
      } else {
        // 2. Create new user
        const tempPwd = Math.random().toString(36).slice(-10) + 'A1!'
        const { data: newUser, error: createErr } = await adminSupabase.auth.admin.createUser({
          email,
          password: tempPwd,
          email_confirm: true,
        })
        if (createErr) throw createErr
        userId = newUser.user.id
        isNew = true

        // 3. Send password reset email
        await adminSupabase.auth.admin.generateLink({ type: 'recovery', email })
      }

      // 4. Upsert subscription
      const { error: subErr } = await adminSupabase.from('subscriptions').upsert({
        user_id: userId,
        plan,
        status: 'active',
        starts_at: new Date().toISOString(),
        expires_at: expiresAt,
        suspended_at: null,
        purge_at: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      if (subErr) throw subErr

      // 5. Ensure profile
      await adminSupabase.from('profiles').upsert({
        id: userId,
        email,
        display_name: email.split('@')[0],
        role: 'driver',
        active: true,
      }, { onConflict: 'id' })

      setResult({ ok: true, user_id: userId, email, plan, expires_at: expiresAt, is_new_user: isNew,
        message: isNew ? 'Usuário criado! Email de redefinição de senha foi enviado.' : 'Assinatura ativada para usuário existente.' })
    } catch (err) {
      setError(err.message || 'Erro ao criar assinante')
    }
    setLoading(false)
  }

  if (result) {
    return (
      <div>
        <button onClick={onBack} style={S.backBtn}><ArrowLeft size={18} /> Voltar</button>
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#22c55e20', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <CheckCircle size={32} color='#22c55e' />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
            {result.is_new_user ? 'Usuário criado!' : 'Assinatura ativada!'}
          </h2>
          <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 20 }}>
            {result.message}
          </p>
          <div style={{ background: '#1e293b', borderRadius: 14, padding: 16, textAlign: 'left', marginBottom: 20 }}>
            <Row label='Email' value={result.email} />
            <Row label='Plano' value={result.plan?.toUpperCase()} />
            <Row label='Expira em' value={result.expires_at ? new Date(result.expires_at).toLocaleDateString('pt-BR') : '—'} />
          </div>
          {result.is_new_user && (
            <div style={{ background: '#f59e0b15', border: '1px solid #f59e0b40', borderRadius: 12, padding: 14, marginBottom: 20 }}>
              <p style={{ fontSize: 13, color: '#f59e0b' }}>
                ⚠️ Um email de redefinição de senha foi enviado para <strong>{result.email}</strong>. O usuário deve verificar a caixa de entrada.
              </p>
            </div>
          )}
          <button onClick={onSuccess} style={{
            width: '100%', padding: 14, background: '#22c55e', border: 'none',
            borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer',
          }}>Voltar ao Dashboard</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <button onClick={onBack} style={S.backBtn}><ArrowLeft size={18} /> Voltar</button>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Novo Assinante</h2>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>
        Cria conta e ativa assinatura automaticamente. Se o email já existe, renova a assinatura.
      </p>

      <label style={S.label}>Email do assinante</label>
      <input
        type='email'
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder='motorista@email.com'
        style={{ ...S.input, marginBottom: 16 }}
      />

      <label style={S.label}>Plano</label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        {plans.map((p) => (
          <button key={p.id} onClick={() => setPlan(p.id)} style={{
            padding: '12px 8px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
            background: plan === p.id ? '#3b82f620' : '#1e293b',
            border: `2px solid ${plan === p.id ? '#3b82f6' : '#334155'}`,
          }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: plan === p.id ? '#3b82f6' : '#f1f5f9' }}>{p.label}</p>
            <p style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{p.desc}</p>
          </button>
        ))}
      </div>

      <label style={S.label}>Duração (dias)</label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
        {[7, 15, 30, 365].map((d) => (
          <button key={d} onClick={() => setDays(d)} style={{
            padding: '10px 0', borderRadius: 10, cursor: 'pointer',
            background: days === d ? '#22c55e20' : '#1e293b',
            border: `2px solid ${days === d ? '#22c55e' : '#334155'}`,
            fontSize: 13, fontWeight: 700, color: days === d ? '#22c55e' : '#94a3b8',
          }}>{d === 365 ? '1 ano' : `${d}d`}</button>
        ))}
      </div>

      {error && <p style={{ fontSize: 13, color: '#ef4444', marginBottom: 12 }}>{error}</p>}

      <button onClick={handleCreate} disabled={loading} style={{
        width: '100%', padding: 16, background: loading ? '#334155' : '#22c55e',
        border: 'none', borderRadius: 14, color: '#fff', fontWeight: 700,
        fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        {loading ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <UserPlus size={18} />}
        {loading ? 'Criando...' : 'Criar Assinante'}
      </button>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid #334155' }}>
      <span style={{ fontSize: 12, color: '#64748b' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{value}</span>
    </div>
  )
}

function Tag({ children, color }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600,
      color: color || '#64748b',
      background: `${color || '#64748b'}15`,
      padding: '2px 8px', borderRadius: 6,
    }}>
      {children}
    </span>
  )
}

function EmptyState({ text }) {
  return (
    <div style={{
      background: '#1e293b', borderRadius: 14, padding: 30,
      textAlign: 'center', border: '1px solid #334155',
    }}>
      <Eye size={28} color='#334155' style={{ marginBottom: 8 }} />
      <p style={{ fontSize: 14, color: '#64748b' }}>{text}</p>
    </div>
  )
}

function Loading() {
  return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <Loader size={28} color='#3b82f6' style={{ animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

const S = {
  backBtn: {
    background: 'none', border: '1px solid #334155',
    borderRadius: 10, padding: 6, cursor: 'pointer',
    color: '#94a3b8', display: 'flex', alignItems: 'center',
  },
}
