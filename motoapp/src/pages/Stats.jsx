import { useState, useMemo } from 'react'
import { useStore } from '../store'
import { fmt } from '../utils/format'
import { calcDailyRecords, calcStreak, calcAchievements } from '../utils/gamification'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, Legend,
} from 'recharts'
import {
  CalendarDays, TrendingUp, Fuel, Clock, Navigation,
  Trophy, Flame, Target, Star, Medal, Zap,
} from 'lucide-react'

// Presets de período
const PERIODS = [
  { id: '7d', label: '7 dias' },
  { id: '15d', label: '15 dias' },
  { id: '30d', label: '30 dias' },
  { id: 'custom', label: 'Personalizado' },
]

// Tabs: Gráficos | Conquistas
const TABS = [
  { id: 'charts', label: 'Gráficos', icon: TrendingUp },
  { id: 'achievements', label: 'Conquistas', icon: Trophy },
]

function dateKey(ts) {
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function subtractDays(n) {
  const d = new Date()
  d.setDate(d.getDate() - n + 1)
  return startOfDay(d)
}

const customTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#1e293b', border: '1px solid #334155',
      borderRadius: 10, padding: '10px 14px', fontSize: 12,
    }}>
      <p style={{ fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

export default function Stats() {
  const { trips, settings } = useStore()
  const [tab, setTab] = useState('charts')
  const [period, setPeriod] = useState('7d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  // Gamificação
  const records = useMemo(() => calcDailyRecords(trips, settings), [trips, settings])
  const streak = useMemo(() => calcStreak(trips), [trips])
  const achievements = useMemo(() => calcAchievements(trips, settings), [trips, settings])

  // Define intervalo de datas
  const { fromDate, toDate } = useMemo(() => {
    const to = startOfDay(new Date())
    to.setDate(to.getDate() + 1)

    if (period === 'custom' && customFrom && customTo) {
      return {
        fromDate: startOfDay(new Date(customFrom)),
        toDate: new Date(new Date(customTo).setHours(23, 59, 59, 999)),
      }
    }
    const days = period === '15d' ? 15 : period === '30d' ? 30 : 7
    return { fromDate: subtractDays(days), toDate: to }
  }, [period, customFrom, customTo])

  // Agrupa corridas por dia
  const dailyData = useMemo(() => {
    const filtered = trips.filter((t) => {
      const ts = t.endTime || t.startTime
      return ts >= fromDate.getTime() && ts < toDate.getTime()
    })

    const byDay = {}
    filtered.forEach((t) => {
      const key = dateKey(t.endTime || t.startTime)
      if (!byDay[key]) byDay[key] = { date: key, earnings: 0, km: 0, fuel: 0, trips: 0, waitTime: 0 }
      byDay[key].earnings += t.earnings || 0
      byDay[key].km += t.km || 0
      byDay[key].fuel += t.fuelCost || (t.km / settings.fuelConsumption) * settings.fuelPrice
      byDay[key].trips += 1
      const waitMs = (t.tripStartTime || t.startTime) - t.startTime
      byDay[key].waitTime += Math.max(0, waitMs / 60000)
    })

    const result = []
    const cursor = new Date(fromDate)
    while (cursor < toDate) {
      const key = cursor.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      result.push({ date: key, earnings: 0, km: 0, fuel: 0, trips: 0, waitTime: 0, ...(byDay[key] || {}) })
      cursor.setDate(cursor.getDate() + 1)
    }
    return result
  }, [trips, fromDate, toDate, settings])

  const totals = useMemo(() => {
    const activeDays = dailyData.filter((d) => d.trips > 0).length || 1
    return {
      avgEarnings: dailyData.reduce((a, d) => a + d.earnings, 0) / activeDays,
      avgKm: dailyData.reduce((a, d) => a + d.km, 0) / activeDays,
      avgFuel: dailyData.reduce((a, d) => a + d.fuel, 0) / activeDays,
      avgWait: dailyData.reduce((a, d) => a + d.waitTime, 0) / activeDays,
      totalEarnings: dailyData.reduce((a, d) => a + d.earnings, 0),
      totalTrips: dailyData.reduce((a, d) => a + d.trips, 0),
    }
  }, [dailyData])

  const formatted = dailyData.map((d) => ({
    ...d,
    earnings: parseFloat(d.earnings.toFixed(2)),
    km: parseFloat(d.km.toFixed(1)),
    fuel: parseFloat(d.fuel.toFixed(2)),
    waitTime: Math.round(d.waitTime),
  }))

  const unlockedCount = achievements.filter(a => a.unlocked).length

  return (
    <div style={{ padding: '20px 16px 100px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Desempenho</h1>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>Análise e conquistas</p>

      {/* Tabs: Gráficos | Conquistas */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: '#1e293b', borderRadius: 12, padding: 4 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '10px 0',
              background: tab === t.id ? '#22c55e20' : 'transparent',
              border: tab === t.id ? '1px solid #22c55e50' : '1px solid transparent',
              borderRadius: 10, color: tab === t.id ? '#22c55e' : '#64748b',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <t.icon size={15} />
            {t.label}
            {t.id === 'achievements' && <span style={{
              background: '#22c55e', color: '#000', fontSize: 10,
              fontWeight: 800, borderRadius: 8, padding: '2px 6px', marginLeft: 2,
            }}>{unlockedCount}</span>}
          </button>
        ))}
      </div>

      {/* ═══════ TAB: CONQUISTAS ═══════ */}
      {tab === 'achievements' && (
        <>
          {/* Streak */}
          <div style={{
            background: 'linear-gradient(135deg, #f97316, #ef4444)',
            borderRadius: 16, padding: 16, marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: '#fff2', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 28,
            }}>
              🔥
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#fff9', textTransform: 'uppercase' }}>Sequência atual</p>
              <p style={{ fontSize: 28, fontWeight: 900, color: '#fff' }}>{streak.current} {streak.current === 1 ? 'dia' : 'dias'}</p>
              <p style={{ fontSize: 11, color: '#fff9' }}>Recorde: {streak.best} dias</p>
            </div>
          </div>

          {/* Recordes diários */}
          {records && (
            <>
              <SectionTitle icon={<Medal size={16} color='#f59e0b' />} title='Seus Recordes' />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                <RecordCard
                  emoji='💰' title='Melhor Ganho'
                  value={fmt.currency(records.bestEarnings.earnings)}
                  sub={records.bestEarnings.label}
                  detail={`${records.bestEarnings.trips} corridas`}
                  color='#22c55e'
                />
                <RecordCard
                  emoji='📈' title='Melhor Lucro'
                  value={fmt.currency(records.bestProfit.netProfit)}
                  sub={records.bestProfit.label}
                  detail='líquido (- combustível)'
                  color='#3b82f6'
                />
                {records.bestEfficiency && (
                  <RecordCard
                    emoji='⛽' title='Mais Econômico'
                    value={`${records.bestEfficiency.ratio}% custo`}
                    sub={records.bestEfficiency.label}
                    detail={`Gastou só ${records.bestEfficiency.ratio}% do ganho`}
                    color='#f97316'
                  />
                )}
                <RecordCard
                  emoji='🏎️' title='Mais Corridas'
                  value={`${records.mostTrips.trips} corridas`}
                  sub={records.mostTrips.label}
                  detail={fmt.currency(records.mostTrips.earnings)}
                  color='#a855f7'
                />
                <RecordCard
                  emoji='🛣️' title='Mais Km'
                  value={fmt.km(records.mostKm.km)}
                  sub={records.mostKm.label}
                  detail={`${records.mostKm.trips} corridas`}
                  color='#06b6d4'
                />
                <RecordCard
                  emoji='📅' title='Dias Ativos'
                  value={`${records.totalDays} dias`}
                  sub='no total'
                  detail='desde o início'
                  color='#64748b'
                />
              </div>
            </>
          )}

          {!records && (
            <div style={{
              background: '#1e293b', borderRadius: 14, padding: 20,
              border: '1px solid #334155', textAlign: 'center', marginBottom: 20,
            }}>
              <p style={{ fontSize: 40, marginBottom: 8 }}>🏁</p>
              <p style={{ fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>Nenhuma corrida ainda</p>
              <p style={{ fontSize: 13, color: '#64748b' }}>Complete sua primeira corrida para desbloquear os recordes!</p>
            </div>
          )}

          {/* Conquistas */}
          <SectionTitle icon={<Trophy size={16} color='#22c55e' />} title='Conquistas' />
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
            {unlockedCount} de {achievements.length} desbloqueadas
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {achievements.map((a) => (
              <AchievementRow key={a.id} {...a} />
            ))}
          </div>
        </>
      )}

      {/* ═══════ TAB: GRÁFICOS ═══════ */}
      {tab === 'charts' && (
        <>
          {/* Seletor de período */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                style={{
                  padding: '7px 14px',
                  background: period === p.id ? '#22c55e20' : '#1e293b',
                  border: `1px solid ${period === p.id ? '#22c55e' : '#334155'}`,
                  borderRadius: 20, color: period === p.id ? '#22c55e' : '#64748b',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>De</label>
                <input type='date' value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Até</label>
                <input type='date' value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={inputStyle} />
              </div>
            </div>
          )}

          {/* Cards de média */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            <AvgCard icon={<TrendingUp size={16} color='#22c55e' />} label='Média/dia' value={fmt.currency(totals.avgEarnings)} sub={`Total: ${fmt.currency(totals.totalEarnings)}`} />
            <AvgCard icon={<Navigation size={16} color='#3b82f6' />} label='Km médio/dia' value={fmt.km(totals.avgKm)} sub={`${totals.totalTrips} corridas`} />
            <AvgCard icon={<Fuel size={16} color='#f97316' />} label='Combustível/dia' value={fmt.currency(totals.avgFuel)} sub='gasto médio' />
            <AvgCard icon={<Clock size={16} color='#f59e0b' />} label='Espera ociosa/dia' value={`${Math.round(totals.avgWait)} min`} sub='aguardando' />
          </div>

          {/* Gráficos */}
          <ChartCard title='Ganhos por dia (R$)'>
            <ResponsiveContainer width='100%' height={180}>
              <BarChart data={formatted} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray='3 3' stroke='#1e293b' />
                <XAxis dataKey='date' tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip content={customTooltip} />
                <Bar dataKey='earnings' name='R$' fill='#22c55e' radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title='Km rodados por dia'>
            <ResponsiveContainer width='100%' height={180}>
              <LineChart data={formatted} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray='3 3' stroke='#1e293b' />
                <XAxis dataKey='date' tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip content={customTooltip} />
                <Line type='monotone' dataKey='km' name='Km' stroke='#3b82f6' strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title='Gasto de combustível (R$)'>
            <ResponsiveContainer width='100%' height={180}>
              <BarChart data={formatted} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray='3 3' stroke='#1e293b' />
                <XAxis dataKey='date' tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip content={customTooltip} />
                <Bar dataKey='fuel' name='R$ combust.' fill='#f97316' radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title='Ganhos vs Combustível (R$)'>
            <ResponsiveContainer width='100%' height={200}>
              <LineChart data={formatted} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray='3 3' stroke='#1e293b' />
                <XAxis dataKey='date' tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip content={customTooltip} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                <Line type='monotone' dataKey='earnings' name='Ganhos' stroke='#22c55e' strokeWidth={2} dot={false} />
                <Line type='monotone' dataKey='fuel' name='Combustível' stroke='#ef4444' strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </>
      )}
    </div>
  )
}

// ── COMPONENTES ─────────────────────────────────────────────────

function SectionTitle({ icon, title }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
      {icon}
      <h2 style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9' }}>{title}</h2>
    </div>
  )
}

function RecordCard({ emoji, title, value, sub, detail, color }) {
  return (
    <div style={{
      background: '#1e293b', borderRadius: 14, padding: 14,
      border: '1px solid #334155', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: -8, right: -8,
        fontSize: 40, opacity: 0.08,
      }}>{emoji}</div>
      <p style={{ fontSize: 20, marginBottom: 6 }}>{emoji}</p>
      <p style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{title}</p>
      <p style={{ fontSize: 18, fontWeight: 900, color }}>{value}</p>
      <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{sub}</p>
      {detail && <p style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{detail}</p>}
    </div>
  )
}

function AchievementRow({ emoji, title, desc, unlocked, progress, max }) {
  const pct = max ? Math.min((progress || 0) / max * 100, 100) : unlocked ? 100 : 0
  return (
    <div style={{
      background: unlocked ? '#22c55e10' : '#1e293b',
      border: `1px solid ${unlocked ? '#22c55e40' : '#334155'}`,
      borderRadius: 12, padding: '12px 14px',
      opacity: unlocked ? 1 : 0.6,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <span style={{ fontSize: 24, filter: unlocked ? 'none' : 'grayscale(1)' }}>{emoji}</span>
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 700, fontSize: 14, color: unlocked ? '#f1f5f9' : '#94a3b8' }}>{title}</p>
        <p style={{ fontSize: 11, color: '#64748b' }}>{desc}</p>
        {max && !unlocked && (
          <div style={{ marginTop: 6 }}>
            <div style={{
              width: '100%', height: 4, background: '#334155',
              borderRadius: 2, overflow: 'hidden',
            }}>
              <div style={{
                width: `${pct}%`, height: '100%',
                background: '#22c55e', borderRadius: 2,
                transition: 'width 0.5s ease',
              }} />
            </div>
            <p style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{progress}/{max}</p>
          </div>
        )}
      </div>
      {unlocked && <span style={{ fontSize: 18 }}>✅</span>}
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div style={{
      background: '#1e293b', borderRadius: 14, padding: '14px 10px 10px',
      border: '1px solid #334155', marginBottom: 16,
    }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 12, paddingLeft: 4 }}>{title}</p>
      {children}
    </div>
  )
}

function AvgCard({ icon, label, value, sub }) {
  return (
    <div style={{ background: '#1e293b', borderRadius: 12, padding: 12, border: '1px solid #334155' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
        {icon}
        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>{label}</span>
      </div>
      <p style={{ fontWeight: 800, fontSize: 18, color: '#f1f5f9' }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{sub}</p>}
    </div>
  )
}

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: '#64748b', marginBottom: 4, textTransform: 'uppercase',
}

const inputStyle = {
  width: '100%', background: '#0f172a', border: '1px solid #334155',
  borderRadius: 8, padding: '9px 12px', color: '#f1f5f9',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
  colorScheme: 'dark',
}
