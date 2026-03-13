import { useState, useMemo } from 'react'
import { useStore } from '../store'
import { fmt } from '../utils/format'
import { calcDailyRecords, calcStreak, calcAchievements } from '../utils/gamification'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import {
  CalendarDays, TrendingUp, Fuel, Clock, Navigation,
  Trophy, Flame, Target, Star, Medal, Zap, Droplet, Plus, Trash2, AlertTriangle,
} from 'lucide-react'

// Presets de período
const PERIODS = [
  { id: '7d', label: '7 dias' },
  { id: '15d', label: '15 dias' },
  { id: '30d', label: '30 dias' },
  { id: 'custom', label: 'Personalizado' },
]

// Tabs: Gráficos | Combustível | Conquistas
const TABS = [
  { id: 'charts',  label: 'Gráficos',    icon: TrendingUp },
  { id: 'fuel',    label: 'Combustível', icon: Fuel },
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
  const { trips, settings, fuelLogs, addFuelLog, deleteFuelLog } = useStore()
  const [tab, setTab]       = useState('charts')
  const [period, setPeriod] = useState('7d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo]     = useState('')

  // ── Estado do formulário de abastecimento ─────────────────────
  const [showFuelForm, setShowFuelForm] = useState(false)
  const [fuelPeriod, setFuelPeriod]     = useState('30d')
  const [fuelForm, setFuelForm] = useState({
    date: new Date().toISOString().split('T')[0],
    liters: '',
    pricePerLiter: String(settings.fuelPrice ?? 6.49),
    odometer: '',
    partialFill: false,
    notes: '',
  })

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

  // ── DADOS DE CONSUMO (aba Combustível) ───────────────────────────
  const fuelPeriodDays = fuelPeriod === '7d' ? 7 : fuelPeriod === '30d' ? 30 : 90
  const fuelFromTs = Date.now() - fuelPeriodDays * 86_400_000

  // Dados diários estimados do período (das corridas)
  const dailyFuelData = useMemo(() => {
    const days = fuelPeriodDays
    const result = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      d.setHours(0, 0, 0, 0)
      const dayEnd = new Date(d).setHours(23, 59, 59, 999)
      const dayTrips = trips.filter((t) => {
        const ts = t.endTime || t.startTime
        return ts >= d.getTime() && ts <= dayEnd
      })
      const km  = dayTrips.reduce((a, t) => a + (t.km || 0), 0)
      const liters = km / (settings.fuelConsumption || 35)
      const cost = liters * (settings.fuelPrice || 6)
      result.push({
        date: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        km: parseFloat(km.toFixed(1)),
        liters: parseFloat(liters.toFixed(2)),
        cost: parseFloat(cost.toFixed(2)),
        kmL: km > 0 ? parseFloat((settings.fuelConsumption || 35).toFixed(1)) : 0,
      })
    }
    return result
  }, [trips, settings, fuelPeriodDays])

  // Logs de abastecimento reais no período
  const filteredLogs = useMemo(() =>
    [...fuelLogs]
      .filter((l) => l.date >= fuelFromTs)
      .sort((a, b) => b.date - a.date),
    [fuelLogs, fuelFromTs]
  )

  // Gráfico de km/L real (por abastecimento)
  const kmLChart = useMemo(() => {
    const measured = fuelLogs
      .filter((l) => l.kmPerLiter > 0)
      .sort((a, b) => a.date - b.date)
      .slice(-20)
    return measured.map((l) => ({
      date: new Date(l.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      kmL: l.kmPerLiter,
      ref: settings.fuelConsumption || 35,
    }))
  }, [fuelLogs, settings])

  // Stats resumidos dos abastecimentos
  const fuelStats = useMemo(() => {
    const measured = fuelLogs.filter((l) => l.kmPerLiter > 0)
    if (!measured.length) return null
    const kmLValues = measured.map((l) => l.kmPerLiter)
    const avg = kmLValues.reduce((a, v) => a + v, 0) / kmLValues.length
    const best  = Math.max(...kmLValues)
    const worst = Math.min(...kmLValues)
    const last  = measured.sort((a, b) => b.date - a.date)[0]
    const prevAvg = measured.length >= 2
      ? kmLValues.slice(1, 5).reduce((a, v) => a + v, 0) / Math.min(4, kmLValues.length - 1)
      : null
    return {
      avg:      parseFloat(avg.toFixed(2)),
      best:     parseFloat(best.toFixed(2)),
      worst:    parseFloat(worst.toFixed(2)),
      lastKmL:  last?.kmPerLiter ?? null,
      prevAvg:  prevAvg ? parseFloat(prevAvg.toFixed(2)) : null,
      dropPct:  prevAvg ? Math.round(((prevAvg - (last?.kmPerLiter ?? prevAvg)) / prevAvg) * 100) : 0,
    }
  }, [fuelLogs])

  // Agrupa por semana (gráfico semanal de litros)
  const weeklyFuel = useMemo(() => {
    const weeks = {}
    trips.forEach((t) => {
      const d = new Date(t.endTime || t.startTime)
      const weekStart = new Date(d)
      weekStart.setDate(d.getDate() - d.getDay())
      weekStart.setHours(0, 0, 0, 0)
      const key = weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      if (!weeks[key]) weeks[key] = { week: key, km: 0, liters: 0, cost: 0 }
      weeks[key].km     += t.km || 0
      weeks[key].liters += (t.km || 0) / (settings.fuelConsumption || 35)
      weeks[key].cost   += (t.km || 0) / (settings.fuelConsumption || 35) * (settings.fuelPrice || 6)
    })
    return Object.values(weeks)
      .sort((a, b) => a.week.localeCompare(b.week))
      .slice(-12)
      .map((w) => ({
        ...w,
        liters: parseFloat(w.liters.toFixed(1)),
        cost:   parseFloat(w.cost.toFixed(2)),
        km:     parseFloat(w.km.toFixed(1)),
      }))
  }, [trips, settings])

  // Agrupa por mês
  const monthlyFuel = useMemo(() => {
    const months = {}
    trips.forEach((t) => {
      const d = new Date(t.endTime || t.startTime)
      const key = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      if (!months[key]) months[key] = { month: key, km: 0, liters: 0, cost: 0 }
      months[key].km     += t.km || 0
      months[key].liters += (t.km || 0) / (settings.fuelConsumption || 35)
      months[key].cost   += (t.km || 0) / (settings.fuelConsumption || 35) * (settings.fuelPrice || 6)
    })
    return Object.values(months)
      .slice(-6)
      .map((m) => ({
        ...m,
        liters: parseFloat(m.liters.toFixed(1)),
        cost:   parseFloat(m.cost.toFixed(2)),
        km:     parseFloat(m.km.toFixed(1)),
      }))
  }, [trips, settings])

  const handleAddFuelLog = () => {
    if (!fuelForm.liters || parseFloat(fuelForm.liters) <= 0) return
    addFuelLog({
      date:         new Date(fuelForm.date + 'T12:00:00').getTime(),
      liters:       parseFloat(fuelForm.liters),
      pricePerLiter:parseFloat(fuelForm.pricePerLiter) || settings.fuelPrice,
      totalCost:    parseFloat(fuelForm.liters) * (parseFloat(fuelForm.pricePerLiter) || settings.fuelPrice),
      odometer:     fuelForm.odometer ? parseInt(fuelForm.odometer) : null,
      partialFill:  fuelForm.partialFill,
      notes:        fuelForm.notes,
    })
    setFuelForm({
      date: new Date().toISOString().split('T')[0],
      liters: '',
      pricePerLiter: String(settings.fuelPrice ?? 6.49),
      odometer: '',
      partialFill: false,
      notes: '',
    })
    setShowFuelForm(false)
  }

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

      {/* ══════════════════════ TAB: COMBUSTÍVEL ══════════════════════ */}
      {tab === 'fuel' && (
        <>
          {/* Alerta de consumo piorado */}
          {fuelStats?.dropPct > 10 && (
            <div style={{
              background: '#ef444412', border: '1px solid #ef444450',
              borderRadius: 14, padding: '12px 14px', marginBottom: 16,
              display: 'flex', gap: 10, alignItems: 'flex-start',
            }}>
              <AlertTriangle size={18} color='#ef4444' style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ fontWeight: 800, fontSize: 14, color: '#ef4444' }}>
                  ⚠️ Consumo caiu {fuelStats.dropPct}% vs média anterior
                </p>
                <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
                  Último: {fuelStats.lastKmL} km/L · Média anterior: {fuelStats.prevAvg} km/L
                </p>
                <p style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                  Verifique calibragem dos pneus, filtro de ar e estado do óleo.
                </p>
              </div>
            </div>
          )}

          {/* Cards resumo */}
          {fuelStats ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              <AvgCard icon={<Fuel size={16} color='#f97316' />} label='Km/L médio'
                value={`${fuelStats.avg} km/L`} sub={`Referência: ${settings.fuelConsumption} km/L`} />
              <AvgCard icon={<Droplet size={16} color='#3b82f6' />} label='Último abastec.'
                value={fuelStats.lastKmL ? `${fuelStats.lastKmL} km/L` : '—'}
                sub={fuelStats.dropPct > 0 ? `↓ ${fuelStats.dropPct}% vs média` : fuelStats.dropPct < 0 ? `↑ ${Math.abs(fuelStats.dropPct)}% vs média` : 'Na média'} />
              <AvgCard icon={<TrendingUp size={16} color='#22c55e' />} label='Melhor km/L'
                value={`${fuelStats.best} km/L`} sub='seu recorde' />
              <AvgCard icon={<AlertTriangle size={16} color='#ef4444' />} label='Pior km/L'
                value={`${fuelStats.worst} km/L`} sub='a melhorar' />
            </div>
          ) : (
            <div style={{
              background: '#1e293b', border: '1px solid #334155',
              borderRadius: 14, padding: '18px 16px', marginBottom: 16, textAlign: 'center',
            }}>
              <Droplet size={28} color='#3b82f6' style={{ marginBottom: 8 }} />
              <p style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>
                Registre abastecimentos
              </p>
              <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                Com tanque cheio e odômetro, calculamos seu km/L real e avisamos quando piorar.
              </p>
            </div>
          )}

          {/* Seletor de período para gráficos estimados */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[{ id: '7d', label: '7d' }, { id: '30d', label: '30d' }, { id: '90d', label: '3 meses' }].map((p) => (
              <button
                key={p.id}
                onClick={() => setFuelPeriod(p.id)}
                style={{
                  padding: '7px 14px',
                  background: fuelPeriod === p.id ? '#f9731620' : '#1e293b',
                  border: `1px solid ${fuelPeriod === p.id ? '#f97316' : '#334155'}`,
                  borderRadius: 20, color: fuelPeriod === p.id ? '#f97316' : '#64748b',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Gráfico km/L real por abastecimento */}
          {kmLChart.length >= 2 ? (
            <ChartCard title={`Km/L real — por abastecimento (${kmLChart.length} medições)`}>
              <ResponsiveContainer width='100%' height={200}>
                <LineChart data={kmLChart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray='3 3' stroke='#334155' />
                  <XAxis dataKey='date' tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Tooltip content={customTooltip} />
                  <ReferenceLine y={settings.fuelConsumption} stroke='#64748b' strokeDasharray='4 2' label={{ value: 'Meta', fill: '#64748b', fontSize: 10 }} />
                  <Line type='monotone' dataKey='kmL'  name='km/L real' stroke='#f97316' strokeWidth={2.5} dot={{ r: 5, fill: '#f97316', strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          ) : kmLChart.length > 0 ? null : null}

          {/* Gráfico litros por dia */}
          <ChartCard title='Litros estimados por dia'>
            <ResponsiveContainer width='100%' height={180}>
              <BarChart data={dailyFuelData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray='3 3' stroke='#334155' />
                <XAxis dataKey='date' tick={{ fill: '#64748b', fontSize: 10 }} interval={fuelPeriodDays > 15 ? 2 : 0} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip content={customTooltip} />
                <Bar dataKey='liters' name='Litros' fill='#3b82f6' radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Gráfico litros por semana */}
          {weeklyFuel.length > 1 && (
            <ChartCard title='Litros por semana'>
              <ResponsiveContainer width='100%' height={180}>
                <BarChart data={weeklyFuel} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray='3 3' stroke='#334155' />
                  <XAxis dataKey='week' tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Tooltip content={customTooltip} />
                  <Bar dataKey='liters' name='Litros' fill='#a855f7' radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Gráfico custo por mês */}
          {monthlyFuel.length > 1 && (
            <ChartCard title='Custo combustível por mês (R$)'>
              <ResponsiveContainer width='100%' height={180}>
                <BarChart data={monthlyFuel} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray='3 3' stroke='#334155' />
                  <XAxis dataKey='month' tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Tooltip content={customTooltip} />
                  <Bar dataKey='cost' name='R$ combustível' fill='#ef4444' radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Formulário de abastecimento */}
          {showFuelForm ? (
            <div style={{
              background: '#1e293b', border: '1px solid #334155',
              borderRadius: 14, padding: 16, marginBottom: 16,
            }}>
              <p style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9', marginBottom: 14 }}>
                ⛽ Registrar Abastecimento
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Data</label>
                  <input type='date' value={fuelForm.date}
                    onChange={(e) => setFuelForm((f) => ({ ...f, date: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Litros abastecidos</label>
                  <input type='number' value={fuelForm.liters} step='0.1' placeholder='Ex: 12.5'
                    onChange={(e) => setFuelForm((f) => ({ ...f, liters: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Preço/litro (R$)</label>
                  <input type='number' value={fuelForm.pricePerLiter} step='0.01' placeholder='Ex: 6.49'
                    onChange={(e) => setFuelForm((f) => ({ ...f, pricePerLiter: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Odômetro (km)</label>
                  <input type='number' value={fuelForm.odometer} placeholder='Ex: 24500'
                    onChange={(e) => setFuelForm((f) => ({ ...f, odometer: e.target.value }))} style={inputStyle} />
                </div>
              </div>

              <button
                onClick={() => setFuelForm((f) => ({ ...f, partialFill: !f.partialFill }))}
                style={{
                  width: '100%', padding: '10px 14px', marginBottom: 10,
                  background: fuelForm.partialFill ? '#1e293b' : '#22c55e15',
                  border: `1px solid ${fuelForm.partialFill ? '#334155' : '#22c55e50'}`,
                  borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 13, color: '#f1f5f9' }}>🚗 Tanque cheio</span>
                <span style={{
                  width: 40, height: 22, borderRadius: 11,
                  background: !fuelForm.partialFill ? '#22c55e' : '#334155',
                  position: 'relative', display: 'inline-block', flexShrink: 0,
                }}>
                  <span style={{
                    position: 'absolute', top: 3,
                    left: !fuelForm.partialFill ? 20 : 3,
                    width: 16, height: 16, borderRadius: '50%',
                    background: '#fff', transition: 'left 0.2s',
                  }} />
                </span>
              </button>

              <label style={labelStyle}>Observações (opcional)</label>
              <input type='text' value={fuelForm.notes} placeholder='Ex: Posto BR, gasolina aditivada'
                onChange={(e) => setFuelForm((f) => ({ ...f, notes: e.target.value }))} style={{ ...inputStyle, marginBottom: 14 }} />

              {!fuelForm.partialFill && fuelForm.odometer && (
                <div style={{
                  background: '#3b82f615', border: '1px solid #3b82f630',
                  borderRadius: 10, padding: '10px 12px', marginBottom: 12, fontSize: 12, color: '#94a3b8',
                }}>
                  💡 Com odômetro + tanque cheio, o km/L será calculado automaticamente vs. abastecimento anterior.
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowFuelForm(false)}
                  style={{ flex: 1, padding: 13, background: '#0f172a', border: '1px solid #334155', borderRadius: 10, color: '#94a3b8', cursor: 'pointer', fontWeight: 600 }}>
                  Cancelar
                </button>
                <button onClick={handleAddFuelLog} disabled={!fuelForm.liters}
                  style={{ flex: 2, padding: 13, background: fuelForm.liters ? '#f97316' : '#334155', border: 'none', borderRadius: 10, color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
                  Salvar abastecimento
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowFuelForm(true)}
              style={{
                width: '100%', padding: '13px',
                background: '#f9731615', border: '1px dashed #f9731660',
                borderRadius: 12, color: '#f97316', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16,
              }}
            >
              <Plus size={16} />
              Registrar Abastecimento
            </button>
          )}

          {/* Lista de abastecimentos recentes */}
          {filteredLogs.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                Histórico de abastecimentos
              </p>
              {filteredLogs.map((l) => (
                <div key={l.id} style={{
                  background: '#1e293b', borderRadius: 12, padding: '12px 14px', marginBottom: 8,
                  border: '1px solid #334155', display: 'flex', gap: 10, alignItems: 'center',
                }}>
                  <span style={{ fontSize: 22 }}>⛽</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>
                        {l.liters}L — R$ {l.totalCost?.toFixed(2)}
                      </p>
                      {l.kmPerLiter && (
                        <span style={{
                          fontSize: 12, fontWeight: 800, padding: '2px 8px', borderRadius: 20,
                          background: l.kmPerLiter >= (settings.fuelConsumption || 35) ? '#22c55e20' : '#ef444420',
                          color: l.kmPerLiter >= (settings.fuelConsumption || 35) ? '#22c55e' : '#ef4444',
                        }}>
                          {l.kmPerLiter} km/L
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      📅 {new Date(l.date).toLocaleDateString('pt-BR')}
                      {l.odometer ? ` · 🛣️ ${l.odometer.toLocaleString('pt-BR')} km` : ''}
                      {l.kmSinceLast ? ` · rodou ${l.kmSinceLast.toLocaleString('pt-BR')} km` : ''}
                      {l.partialFill ? ' · parcial' : ' · tanque cheio'}
                    </p>
                    {l.notes ? <p style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{l.notes}</p> : null}
                  </div>
                  <button onClick={() => deleteFuelLog(l.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 4 }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
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
