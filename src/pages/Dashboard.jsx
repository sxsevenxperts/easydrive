import { useMemo, useEffect, useCallback, useState } from 'react'
import { useStore } from '../store'
import { fmt } from '../utils/format'
import { calcStreak } from '../utils/gamification'
import { usePiP } from '../hooks/usePiP'
import SafetyCard from '../components/SafetyCard'
import StatCard from '../components/StatCard'
import { fetchWeather } from '../utils/weather'
import {
  TrendingUp, Navigation, Fuel, AlertTriangle, Bell,
  Target, Flame, Lightbulb, MonitorSmartphone,
} from 'lucide-react'

export default function Dashboard({ onTab }) {
  const { stats, settings, alerts, clearAlerts, activeTrip, tripStatus, trips, expenses, currentLocation } = useStore()
  const { startPiP, stopPiP, updateData, isOpen, isSupported } = usePiP()
  const [weather, setWeather] = useState(null)

  // Busca clima quando GPS disponível (refresh a cada 15 min)
  useEffect(() => {
    if (!currentLocation?.lat) return
    fetchWeather(currentLocation.lat, currentLocation.lon).then(setWeather)
    const id = setInterval(() => {
      fetchWeather(currentLocation.lat, currentLocation.lon).then(setWeather)
    }, 15 * 60 * 1000)
    return () => clearInterval(id)
  }, [currentLocation?.lat, currentLocation?.lon])

  const netToday = stats.todayEarnings - (stats.todayKm / settings.fuelConsumption * settings.fuelPrice)
  const fuelToday = stats.todayKm / settings.fuelConsumption * settings.fuelPrice

  const dangerAlerts = alerts.filter(a => a.type === 'danger')
  const streak = useMemo(() => calcStreak(trips), [trips])

  // ── CALCULAR PROGRESSO DAS METAS ──────────────────────────────
  const goals = useMemo(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(todayStart)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()) // domingo
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const yearStart = new Date(now.getFullYear(), 0, 1)

    const calcPeriod = (startTs) => {
      const filtered = trips.filter(t => (t.endTime || t.startTime) >= startTs.getTime())
      const revenue = filtered.reduce((a, t) => a + (t.earnings || 0), 0)
      const fuel = filtered.reduce((a, t) => a + (t.fuelCost || (t.km / settings.fuelConsumption) * settings.fuelPrice), 0)
      const otherExp = expenses.filter(e => (e.date || e.id) >= startTs.getTime()).reduce((a, e) => a + (e.value || 0), 0)
      return { revenue, profit: revenue - fuel - otherExp, fuel }
    }

    return {
      day: calcPeriod(todayStart),
      week: calcPeriod(weekStart),
      month: calcPeriod(monthStart),
      year: calcPeriod(yearStart),
    }
  }, [trips, expenses, settings])

  // ── ECONOMIA POTENCIAL ────────────────────────────────────────
  const savings = useMemo(() => {
    if (trips.length < 3) return null
    // Calcula custo médio por km (quanto o motorista gasta)
    const totalKm = trips.reduce((a, t) => a + (t.km || 0), 0)
    const totalFuel = trips.reduce((a, t) => a + (t.fuelCost || (t.km / settings.fuelConsumption) * settings.fuelPrice), 0)
    if (totalKm <= 0 || totalFuel <= 0) return null

    const avgCostPerKm = totalFuel / totalKm

    // Melhor custo/km alcançado (dia com mais eficiência)
    const bestTrip = trips.filter(t => t.km > 2).reduce((best, t) => {
      const cost = (t.fuelCost || (t.km / settings.fuelConsumption) * settings.fuelPrice) / t.km
      return (!best || cost < best.cost) ? { cost, trip: t } : best
    }, null)

    if (!bestTrip) return null

    // Se tivesse mantido o melhor custo/km em todas as corridas
    const potentialSaving = totalFuel - (totalKm * bestTrip.cost)

    return {
      avgCostPerKm,
      bestCostPerKm: bestTrip.cost,
      potentialSaving: Math.max(0, potentialSaving),
      totalFuel,
    }
  }, [trips, settings])

  const hasGoals = settings.goalDailyRevenue || settings.goalDailyProfit

  // ── DADOS PARA HUD PiP ──────────────────────────────────────────
  const pipData = useMemo(() => ({
    earnings: stats.todayEarnings,
    net: netToday,
    km: stats.todayKm,
    trips: stats.todayTrips,
    streak: streak.current,
    goalRevPct: settings.goalDailyRevenue > 0
      ? (goals.day.revenue / settings.goalDailyRevenue) * 100 : null,
    goalProfPct: settings.goalDailyProfit > 0
      ? (goals.day.profit / settings.goalDailyProfit) * 100 : null,
    platform: activeTrip?.platform || '',
    tripActive: !!activeTrip,
  }), [stats, netToday, streak, settings, goals, activeTrip])

  // Atualiza HUD sempre que dados mudam
  useEffect(() => { updateData(pipData) }, [pipData, updateData])

  const handlePiP = useCallback(async () => {
    if (isOpen()) { stopPiP(); return }
    await startPiP(pipData)
  }, [isOpen, stopPiP, startPiP, pipData])

  return (
    <div style={{ padding: '16px 16px 90px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9' }}>
            {settings.name ? `Olá, ${settings.name.split(' ')[0]}` : 'EasyDrive'}
          </h1>
          <p style={{ fontSize: 12, color: '#64748b' }}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Chip de temperatura */}
          {weather && (
            <div style={{
              background: 'var(--bg3, #1e293b)', border: '1px solid var(--border, #334155)',
              borderRadius: 10, padding: '6px 10px',
              display: 'flex', alignItems: 'center', gap: 5,
            }} title={`${weather.label} · ${weather.tip}`}>
              <span style={{ fontSize: 16 }}>{weather.icon}</span>
              <span style={{ color: 'var(--text, #f1f5f9)', fontSize: 13, fontWeight: 800 }}>{weather.temp}°</span>
            </div>
          )}
          {streak.current > 0 && (
            <div style={{
              background: '#f97316', borderRadius: 10, padding: '6px 10px',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Flame size={14} color='#fff' />
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>{streak.current}</span>
            </div>
          )}
          {isSupported && (
            <button
              onClick={handlePiP}
              title={isOpen() ? 'Fechar HUD flutuante' : 'HUD flutuante — fica sobre outros apps'}
              style={{
                background: isOpen() ? '#22c55e20' : '#1e293b',
                border: `1px solid ${isOpen() ? '#22c55e' : '#334155'}`,
                borderRadius: 10, padding: '6px 10px',
                display: 'flex', alignItems: 'center', gap: 5,
                cursor: 'pointer', color: isOpen() ? '#22c55e' : '#94a3b8',
              }}
            >
              <MonitorSmartphone size={15} />
              <span style={{ fontSize: 11, fontWeight: 700 }}>HUD</span>
            </button>
          )}
        </div>
      </div>

      {/* Alerta de viagem ativa */}
      {activeTrip && (
        <div onClick={() => onTab('trip')} style={{
          background: tripStatus === 'trip' ? '#22c55e20' : '#f59e0b20',
          border: `1px solid ${tripStatus === 'trip' ? '#22c55e' : '#f59e0b'}`,
          borderRadius: 12, padding: '12px 16px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
        }}>
          <span style={{
            width: 10, height: 10, borderRadius: '50%',
            background: tripStatus === 'trip' ? '#22c55e' : '#f59e0b',
            animation: 'pulse 1.5s infinite',
          }} />
          <div>
            <p style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 14 }}>
              {tripStatus === 'trip' ? 'Viagem em andamento' : 'Aguardando corrida'}
            </p>
            <p style={{ fontSize: 12, color: '#94a3b8' }}>
              {fmt.km(activeTrip.km)} • {activeTrip.platform?.toUpperCase()}
            </p>
          </div>
          <Navigation size={18} style={{ marginLeft: 'auto', color: '#64748b' }} />
        </div>
      )}

      {/* Alertas de segurança */}
      {dangerAlerts.slice(0, 2).map((a) => (
        <div key={a.id} style={{
          background: '#ef444415', border: '1px solid #ef4444',
          borderRadius: 12, padding: '10px 14px', marginBottom: 10,
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <AlertTriangle size={16} color='#ef4444' style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontWeight: 700, color: '#ef4444', fontSize: 13 }}>{a.title}</p>
            <p style={{ fontSize: 12, color: '#94a3b8' }}>{a.body}</p>
          </div>
        </div>
      ))}

      {/* Segurança */}
      <div style={{ marginBottom: 16 }}>
        <SafetyCard />
      </div>

      {/* ═══════ METAS DO DIA ═══════ */}
      {hasGoals && (
        <>
          <SectionLabel icon={<Target size={14} color='#f59e0b' />}>Metas de Hoje</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {settings.goalDailyRevenue > 0 && (
              <GoalCard label='Faturamento' current={goals.day.revenue} target={settings.goalDailyRevenue} color='#22c55e' />
            )}
            {settings.goalDailyProfit > 0 && (
              <GoalCard label='Lucro' current={goals.day.profit} target={settings.goalDailyProfit} color='#3b82f6' />
            )}
          </div>
        </>
      )}

      {/* Metas Semana / Mês / Ano */}
      {(settings.goalWeeklyRevenue > 0 || settings.goalMonthlyRevenue > 0) && (
        <>
          <SectionLabel icon={<TrendingUp size={14} color='#22c55e' />}>Progresso Geral</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {settings.goalWeeklyRevenue > 0 && (
              <GoalBar label='Semana' emoji='📅' current={goals.week.revenue} target={settings.goalWeeklyRevenue} color='#22c55e' />
            )}
            {settings.goalWeeklyProfit > 0 && (
              <GoalBar label='Lucro semanal' emoji='📈' current={goals.week.profit} target={settings.goalWeeklyProfit} color='#3b82f6' />
            )}
            {settings.goalMonthlyRevenue > 0 && (
              <GoalBar label='Mês' emoji='📆' current={goals.month.revenue} target={settings.goalMonthlyRevenue} color='#a855f7' />
            )}
            {settings.goalMonthlyProfit > 0 && (
              <GoalBar label='Lucro mensal' emoji='💎' current={goals.month.profit} target={settings.goalMonthlyProfit} color='#06b6d4' />
            )}
            {settings.goalYearlyRevenue > 0 && (
              <GoalBar label='Ano' emoji='🏆' current={goals.year.revenue} target={settings.goalYearlyRevenue} color='#f59e0b' />
            )}
          </div>
        </>
      )}

      {/* Ganhos de hoje */}
      <SectionLabel>Hoje</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <StatCard icon='💰' label='Ganhos brutos' value={fmt.currency(stats.todayEarnings)} color='#22c55e' />
        <StatCard icon='🟢' label='Líquido' value={fmt.currency(netToday)} color={netToday >= 0 ? '#22c55e' : '#ef4444'} />
        <StatCard icon='🛣️' label='Quilômetros' value={fmt.km(stats.todayKm)} color='#3b82f6' />
        <StatCard icon='⛽' label='Combustível' value={fmt.currency(fuelToday)} color='#f97316' />
      </div>

      {/* ═══════ ECONOMIA POTENCIAL ═══════ */}
      {savings && savings.potentialSaving > 5 && (
        <div style={{
          background: 'linear-gradient(135deg, #22c55e15, #06b6d415)',
          border: '1px solid #22c55e40', borderRadius: 14,
          padding: 16, marginBottom: 16,
        }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <Lightbulb size={16} color='#22c55e' />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>Dica de Economia</span>
          </div>
          <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, marginBottom: 8 }}>
            Seu custo médio é <strong style={{ color: '#f1f5f9' }}>{fmt.currency(savings.avgCostPerKm)}/km</strong>.
            Sua melhor marca foi <strong style={{ color: '#22c55e' }}>{fmt.currency(savings.bestCostPerKm)}/km</strong>.
          </p>
          <div style={{
            background: '#0f172a', borderRadius: 10, padding: '10px 14px',
            border: '1px solid #334155',
          }}>
            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>Se mantivesse sua melhor eficiência:</p>
            <p style={{ fontSize: 20, fontWeight: 900, color: '#22c55e' }}>
              💰 {fmt.currency(savings.potentialSaving)} economizados
            </p>
          </div>
        </div>
      )}

      {/* Stats totais */}
      <SectionLabel>Total acumulado</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <StatCard icon='🏆' label='Total ganho' value={fmt.currency(stats.totalEarnings)} color='#22c55e' small />
        <StatCard icon='📊' label='Total gastos' value={fmt.currency(stats.totalExpenses)} color='#f97316' small />
        <StatCard icon='🛣️' label='KM totais' value={fmt.km(stats.totalKm)} color='#3b82f6' small />
        <StatCard icon='🚗' label='Corridas' value={stats.totalTrips} color='#a78bfa' small />
      </div>

      {/* Médias */}
      {stats.totalTrips > 0 && (
        <>
          <SectionLabel>Médias</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <StatCard icon='💵' label='Por corrida' value={fmt.currency(stats.totalEarnings / stats.totalTrips)} color='#22c55e' small />
            <StatCard icon='📍' label='KM por corrida' value={fmt.km(stats.totalKm / stats.totalTrips)} color='#3b82f6' small />
          </div>
        </>
      )}

      {/* CTA sem metas */}
      {!hasGoals && (
        <div onClick={() => onTab('settings')} style={{
          marginTop: 16, background: '#1e293b', borderRadius: 14, padding: 16,
          border: '1px dashed #334155', cursor: 'pointer', textAlign: 'center',
        }}>
          <Target size={24} color='#f59e0b' style={{ marginBottom: 8 }} />
          <p style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 14, marginBottom: 4 }}>Defina suas metas!</p>
          <p style={{ fontSize: 12, color: '#64748b' }}>Toque aqui para configurar metas de faturamento e lucro</p>
        </div>
      )}

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }`}</style>
    </div>
  )
}

// ── COMPONENTES ─────────────────────────────────────────────────

function SectionLabel({ icon, children }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10 }}>
      {icon}
      <h2 style={{ fontSize: 13, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>{children}</h2>
    </div>
  )
}

function GoalCard({ label, current, target, color }) {
  const pct = Math.min((current / target) * 100, 100)
  const achieved = current >= target
  return (
    <div style={{
      background: achieved ? `${color}15` : '#1e293b',
      border: `1px solid ${achieved ? color : '#334155'}`,
      borderRadius: 12, padding: 12,
    }}>
      <p style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 900, color: achieved ? color : '#f1f5f9' }}>
        {achieved ? '✅ ' : ''}{fmt.currency(current)}
      </p>
      <p style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>de {fmt.currency(target)}</p>
      <div style={{ width: '100%', height: 5, background: '#334155', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', background: color,
          borderRadius: 3, transition: 'width 0.5s ease',
        }} />
      </div>
      <p style={{ fontSize: 10, color: '#64748b', marginTop: 4, textAlign: 'right' }}>{Math.round(pct)}%</p>
    </div>
  )
}

function GoalBar({ label, emoji, current, target, color }) {
  const pct = Math.min((current / target) * 100, 100)
  const achieved = current >= target
  return (
    <div style={{
      background: '#1e293b', borderRadius: 10, padding: '10px 14px',
      border: `1px solid ${achieved ? color : '#334155'}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{emoji} {label}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: achieved ? color : '#f1f5f9' }}>
          {achieved ? '✅ ' : ''}{fmt.currency(current)} / {fmt.currency(target)}
        </span>
      </div>
      <div style={{ width: '100%', height: 6, background: '#334155', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', background: color,
          borderRadius: 3, transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  )
}
