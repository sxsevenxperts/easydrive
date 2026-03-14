import { useState, useMemo } from 'react'
import { useStore } from '../store'
import { fmt } from '../utils/format'
import { calcDailyRecords, calcStreak, calcAchievements } from '../utils/gamification'
import PDFReport from '../components/PDFReport'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import {
  CalendarDays, TrendingUp, Fuel, Clock, Navigation,
  Trophy, Flame, Target, Star, Medal, Zap, Droplet, Plus, Trash2, AlertTriangle,
  MapPin, ExternalLink, Download,
} from 'lucide-react'

// ── HOTSPOT HELPERS ──────────────────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function buildHotspots(trips, radiusKm = 0.4) {
  const clusters = []
  trips.forEach((trip) => {
    const loc = trip.pickupLocation
    if (!loc?.lat || !loc?.lng) return
    const { lat, lng } = loc
    let best = null, bestDist = Infinity
    clusters.forEach((c) => {
      const d = haversineKm(c.lat, c.lng, lat, lng)
      if (d < bestDist) { best = c; bestDist = d }
    })
    const addr = loc.address || loc.street || loc.neighborhood || null
    if (best && bestDist <= radiusKm) {
      const n = best.count
      best.lat = (best.lat * n + lat) / (n + 1)
      best.lng = (best.lng * n + lng) / (n + 1)
      best.count++
      best.earnings += trip.earnings || 0
      // Keep longest/most descriptive address
      if (addr && addr.length > (best.label?.length || 0)) best.label = addr
    } else {
      clusters.push({ lat, lng, count: 1, earnings: trip.earnings || 0, label: addr || `${lat.toFixed(4)}, ${lng.toFixed(4)}` })
    }
  })
  return clusters.sort((a, b) => b.count - a.count).slice(0, 12)
}

function buildPeakHours(trips) {
  const hours = Array(24).fill(0).map((_, h) => ({ hour: h, count: 0, earnings: 0 }))
  trips.forEach((trip) => {
    const h = new Date(trip.startTime).getHours()
    hours[h].count++
    hours[h].earnings += trip.earnings || 0
  })
  return hours
}

// Presets de período
const PERIODS = [
  { id: '7d', label: '7 dias' },
  { id: '15d', label: '15 dias' },
  { id: '30d', label: '30 dias' },
  { id: 'custom', label: 'Personalizado' },
]

// Tabs: Lucro | Pontos | Gráficos | Combustível | Conquistas
const TABS = [
  { id: 'profits',      label: 'Lucro',    icon: TrendingUp },
  { id: 'hotspots',     label: 'Pontos',   icon: MapPin },
  { id: 'charts',       label: 'Gráficos', icon: CalendarDays },
  { id: 'fuel',         label: 'Combustível', icon: Fuel },
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
  const { trips, settings, expenses, fuelLogs, addFuelLog, deleteFuelLog } = useStore()
  const [tab, setTab]       = useState('profits')
  const [period, setPeriod] = useState('7d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo]     = useState('')

  // ── Estado dos hotspots ───────────────────────────────────────
  const [hsPeriod, setHsPeriod] = useState('week') // 'today' | 'week' | 'month'

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

  // ── Estado do Relatório PDF ────────────────────────────────────
  const [showPDFReport, setShowPDFReport] = useState(false)

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

  // ── HOTSPOTS E HORÁRIO DE PICO ───────────────────────────────────
  const { hotspots, peakHours, tripsWithLocation, totalHsTrips } = useMemo(() => {
    const now = Date.now()
    const cutoff = hsPeriod === 'today'
      ? new Date().setHours(0, 0, 0, 0)
      : hsPeriod === 'week'
        ? now - 7 * 86_400_000
        : now - 30 * 86_400_000
    const filtered = trips.filter((t) => (t.endTime || t.startTime) >= cutoff)
    const withLoc = filtered.filter((t) => t.pickupLocation?.lat)
    return {
      hotspots: buildHotspots(withLoc),
      peakHours: buildPeakHours(filtered),
      tripsWithLocation: withLoc.length,
      totalHsTrips: filtered.length,
    }
  }, [trips, hsPeriod])

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

  // ── DADOS DE LUCRO (aba Lucro) ────────────────────────────────────
  const profitData = useMemo(() => {
    // Filtra pelo período selecionado
    const pTrips = trips.filter((t) => {
      const ts = t.endTime || t.startTime
      return ts >= fromDate.getTime() && ts < toDate.getTime()
    })
    const pExpenses = (expenses || []).filter((e) => {
      const ts = e.date || e.createdAt || 0
      return ts >= fromDate.getTime() && ts < toDate.getTime()
    })

    const totalRevenue      = pTrips.reduce((a, t) => a + (t.earnings || 0), 0)
    const totalFuelCost     = pTrips.reduce((a, t) => a + (t.fuelCost || 0), 0)
    const totalOtherExp     = pExpenses.reduce((a, e) => a + (e.value || 0), 0)
    const totalCost         = totalFuelCost + totalOtherExp
    const netProfit         = totalRevenue - totalCost
    const profitMargin      = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0
    const totalKm           = pTrips.reduce((a, t) => a + (t.km || 0), 0)
    const tripCount         = pTrips.length

    // Dias ativos
    const daySet = new Set(pTrips.map((t) => new Date(t.endTime || t.startTime).toDateString()))
    const activeDays = daySet.size || 1

    // Médias por dia ativo
    const avgDailyRevenue = totalRevenue / activeDays
    const avgDailyCost    = totalCost / activeDays
    const avgDailyProfit  = netProfit / activeDays

    // Médias por corrida
    const avgRevPerTrip  = tripCount > 0 ? totalRevenue / tripCount : 0
    const avgCostPerTrip = tripCount > 0 ? totalCost / tripCount : 0
    const avgProfitPerTrip = tripCount > 0 ? netProfit / tripCount : 0
    const avgProfitPerKm = totalKm > 0 ? netProfit / totalKm : 0

    // Dias acima da meta de faturamento
    const goalDaily = settings.goalDailyRevenue || 0
    const goalDailyProfit = settings.goalDailyProfit || 0
    const byDay = {}
    pTrips.forEach((t) => {
      const dk = new Date(t.endTime || t.startTime).toDateString()
      if (!byDay[dk]) byDay[dk] = { revenue: 0, fuel: 0 }
      byDay[dk].revenue += t.earnings || 0
      byDay[dk].fuel    += t.fuelCost || 0
    })
    pExpenses.forEach((e) => {
      const dk = new Date(e.date || e.createdAt || 0).toDateString()
      if (!byDay[dk]) byDay[dk] = { revenue: 0, fuel: 0, other: 0 }
      byDay[dk].other = (byDay[dk].other || 0) + (e.value || 0)
    })
    const dayValues = Object.values(byDay)
    const daysAboveRevGoal   = goalDaily > 0   ? dayValues.filter((d) => d.revenue >= goalDaily).length : 0
    const daysAboveProfGoal  = goalDailyProfit > 0 ? dayValues.filter((d) => (d.revenue - (d.fuel || 0) - (d.other || 0)) >= goalDailyProfit).length : 0

    // Break-even: corridas mínimas por dia ativo para cobrir custos
    const breakevenRevenue = avgDailyCost
    const breakevenTrips   = avgRevPerTrip > 0 ? Math.ceil(breakevenRevenue / avgRevPerTrip) : 0

    // Projeção mensal (baseada em dias úteis do período)
    const periodDays = period === '7d' ? 7 : period === '15d' ? 15 : period === '30d' ? 30 : 30
    const workRatio = activeDays / periodDays
    const projMonthly = { revenue: avgDailyRevenue * 30 * workRatio, profit: avgDailyProfit * 30 * workRatio }

    // Gráfico de lucro diário
    const profitByDay = Object.entries(byDay).map(([dk, d]) => ({
      date: new Date(dk).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      lucro: parseFloat((d.revenue - (d.fuel || 0) - (d.other || 0)).toFixed(2)),
      receita: parseFloat(d.revenue.toFixed(2)),
      custo: parseFloat(((d.fuel || 0) + (d.other || 0)).toFixed(2)),
    })).sort((a, b) => a.date.localeCompare(b.date))

    // Recomendações inteligentes
    const recs = []
    const fuelRatio = totalRevenue > 0 ? (totalFuelCost / totalRevenue) * 100 : 0
    if (fuelRatio > 40) recs.push({ icon: '⛽', text: `Combustível consome ${fuelRatio.toFixed(0)}% do faturamento (ideal < 35%). Otimize rotas e evite trajetos vazios.`, color: '#ef4444' })
    else if (fuelRatio > 30) recs.push({ icon: '⛽', text: `Combustível em ${fuelRatio.toFixed(0)}% do faturamento. Atenção ao consumo.`, color: '#f59e0b' })
    else if (fuelRatio > 0) recs.push({ icon: '⛽', text: `Ótimo! Combustível apenas ${fuelRatio.toFixed(0)}% do faturamento.`, color: '#22c55e' })

    if (profitMargin < 0) recs.push({ icon: '🔴', text: 'Você está no PREJUÍZO. Os custos superam o faturamento. Reduza despesas ou aumente as corridas.', color: '#ef4444' })
    else if (profitMargin < 20) recs.push({ icon: '⚠️', text: `Margem de ${profitMargin.toFixed(0)}% está baixa. Meta: acima de 30%.`, color: '#f59e0b' })
    else if (profitMargin >= 40) recs.push({ icon: '🚀', text: `Excelente! Margem de ${profitMargin.toFixed(0)}% — você está indo muito bem.`, color: '#22c55e' })

    if (goalDaily > 0 && daysAboveRevGoal < activeDays * 0.5) recs.push({ icon: '🎯', text: `Meta diária atingida em ${daysAboveRevGoal}/${activeDays} dias. Tente aumentar o horário ou aceitar mais corridas nas horas de pico.`, color: '#f59e0b' })
    if (avgProfitPerKm < 0.5 && totalKm > 10) recs.push({ icon: '🛣️', text: `Lucro de R$${avgProfitPerKm.toFixed(2)}/km — prefira corridas mais longas para melhorar a eficiência.`, color: '#f97316' })
    if (totalOtherExp > totalFuelCost * 0.5) recs.push({ icon: '💸', text: `Despesas diversas (R$${totalOtherExp.toFixed(2)}) estão altas. Revise seus gastos operacionais.`, color: '#f59e0b' })

    return {
      totalRevenue, totalFuelCost, totalOtherExp, totalCost, netProfit,
      profitMargin, totalKm, tripCount, activeDays,
      avgDailyRevenue, avgDailyCost, avgDailyProfit,
      avgRevPerTrip, avgCostPerTrip, avgProfitPerTrip, avgProfitPerKm,
      goalDaily, goalDailyProfit, daysAboveRevGoal, daysAboveProfGoal,
      breakevenTrips, breakevenRevenue,
      projMonthly, profitByDay, recs, fuelRatio,
    }
  }, [trips, expenses, fromDate, toDate, settings, period])

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
      <div style={{ display: 'flex', gap: 3, marginBottom: 20, background: '#1e293b', borderRadius: 12, padding: 4 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '8px 0',
              background: tab === t.id ? '#22c55e20' : 'transparent',
              border: tab === t.id ? '1px solid #22c55e50' : '1px solid transparent',
              borderRadius: 9, color: tab === t.id ? '#22c55e' : '#64748b',
              fontSize: 10, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 2,
            }}
          >
            <t.icon size={13} />
            <span style={{ lineHeight: 1.2, textAlign: 'center' }}>{t.label}</span>
            {t.id === 'achievements' && <span style={{
              background: '#22c55e', color: '#000', fontSize: 8,
              fontWeight: 800, borderRadius: 8, padding: '1px 4px', marginTop: -1,
            }}>{unlockedCount}</span>}
          </button>
        ))}
      </div>

      {/* ═══════ TAB: LUCRO ═══════ */}
      {tab === 'profits' && (() => {
        const p = profitData
        const verdictColor = p.profitMargin < 0 ? '#ef4444' : p.profitMargin < 20 ? '#f59e0b' : p.profitMargin < 40 ? '#3b82f6' : '#22c55e'
        const verdictEmoji = p.profitMargin < 0 ? '🔴' : p.profitMargin < 20 ? '⚠️' : p.profitMargin < 40 ? '📈' : '🚀'
        const verdictText  = p.profitMargin < 0 ? 'Você está no prejuízo!' : p.profitMargin < 20 ? 'Margem baixa — melhore!' : p.profitMargin < 40 ? 'OK, mas pode crescer' : 'Ótimo desempenho!'
        const fmtR = (v) => `R$ ${v.toFixed(2).replace('.', ',')}`
        return (
          <>
            {/* Seletor de período + Botão PDF */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              {PERIODS.map((pp) => (
                <button key={pp.id} onClick={() => setPeriod(pp.id)}
                  style={{
                    padding: '7px 14px',
                    background: period === pp.id ? '#22c55e20' : '#1e293b',
                    border: `1px solid ${period === pp.id ? '#22c55e' : '#334155'}`,
                    borderRadius: 20, color: period === pp.id ? '#22c55e' : '#64748b',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >{pp.label}</button>
              ))}
              <button onClick={() => setShowPDFReport(true)}
                style={{
                  padding: '7px 14px',
                  background: '#3b82f620',
                  border: '1px solid #3b82f6',
                  borderRadius: 20, color: '#3b82f6',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Download size={14} /> PDF
              </button>
            </div>

            {/* Veredicto */}
            <div style={{
              background: `${verdictColor}15`, border: `2px solid ${verdictColor}50`,
              borderRadius: 16, padding: '16px 18px', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <span style={{ fontSize: 36 }}>{verdictEmoji}</span>
              <div>
                <p style={{ fontSize: 16, fontWeight: 900, color: verdictColor }}>{verdictText}</p>
                <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>
                  Margem líquida: <strong style={{ color: verdictColor }}>{p.profitMargin.toFixed(1)}%</strong>
                  {p.tripCount > 0 ? ` · ${p.tripCount} corridas · ${p.activeDays} dias ativos` : ''}
                </p>
              </div>
            </div>

            {/* Cards principais */}
            {p.tripCount === 0 ? (
              <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: 24, textAlign: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 40 }}>📊</span>
                <p style={{ fontWeight: 700, color: '#f1f5f9', marginTop: 10, marginBottom: 4 }}>Sem corridas no período</p>
                <p style={{ fontSize: 13, color: '#64748b' }}>Selecione um período com corridas para ver a análise de lucro.</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                  <AvgCard icon={<TrendingUp size={16} color='#22c55e' />} label='Faturamento' value={fmtR(p.totalRevenue)} sub={`Média ${fmtR(p.avgDailyRevenue)}/dia`} />
                  <AvgCard icon={<Fuel size={16} color='#ef4444' />} label='Custo Total' value={fmtR(p.totalCost)} sub={`${p.fuelRatio.toFixed(0)}% combustível`} />
                  <AvgCard icon={<Zap size={16} color={verdictColor} />} label='Lucro Líquido' value={fmtR(p.netProfit)} sub={`Média ${fmtR(p.avgDailyProfit)}/dia`} />
                  <AvgCard icon={<Target size={16} color='#a855f7' />} label='Margem Lucro' value={`${p.profitMargin.toFixed(1)}%`} sub='sobre faturamento' />
                </div>

                {/* Gráfico lucro diário */}
                {p.profitByDay.length > 1 && (
                  <ChartCard title='Lucro líquido por dia (R$)'>
                    <ResponsiveContainer width='100%' height={200}>
                      <BarChart data={p.profitByDay} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray='3 3' stroke='#334155' />
                        <XAxis dataKey='date' tick={{ fill: '#64748b', fontSize: 11 }} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                        <Tooltip content={customTooltip} />
                        <ReferenceLine y={0} stroke='#64748b' strokeDasharray='4 2' />
                        {settings.goalDailyProfit > 0 && <ReferenceLine y={settings.goalDailyProfit} stroke='#22c55e' strokeDasharray='6 3' label={{ value: 'Meta', fill: '#22c55e', fontSize: 10 }} />}
                        <Bar dataKey='lucro' name='Lucro R$' fill={verdictColor} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )}

                {/* Receita vs Custo */}
                {p.profitByDay.length > 1 && (
                  <ChartCard title='Receita × Custo por dia (R$)'>
                    <ResponsiveContainer width='100%' height={180}>
                      <LineChart data={p.profitByDay} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray='3 3' stroke='#334155' />
                        <XAxis dataKey='date' tick={{ fill: '#64748b', fontSize: 11 }} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                        <Tooltip content={customTooltip} />
                        <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                        <Line type='monotone' dataKey='receita' name='Receita' stroke='#22c55e' strokeWidth={2} dot={false} />
                        <Line type='monotone' dataKey='custo'   name='Custo'   stroke='#ef4444' strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )}

                {/* Breakdown de custos */}
                <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: 14, marginBottom: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 12 }}>💸 Breakdown de custos</p>
                  {[
                    { label: 'Combustível', value: p.totalFuelCost, color: '#f97316', pct: p.totalCost > 0 ? p.totalFuelCost / p.totalCost * 100 : 0 },
                    { label: 'Despesas diversas', value: p.totalOtherExp, color: '#ef4444', pct: p.totalCost > 0 ? p.totalOtherExp / p.totalCost * 100 : 0 },
                  ].map((item) => (
                    <div key={item.label} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, color: '#f1f5f9' }}>{item.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{fmtR(item.value)} ({item.pct.toFixed(0)}%)</span>
                      </div>
                      <div style={{ height: 8, borderRadius: 4, background: '#0f172a', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${item.pct}%`, background: item.color, borderRadius: 4, transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Métricas por corrida */}
                <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: 14, marginBottom: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 12 }}>📋 Por corrida / por km</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      { label: 'Receita/corrida', value: fmtR(p.avgRevPerTrip), color: '#22c55e' },
                      { label: 'Custo/corrida', value: fmtR(p.avgCostPerTrip), color: '#ef4444' },
                      { label: 'Lucro/corrida', value: fmtR(p.avgProfitPerTrip), color: p.avgProfitPerTrip >= 0 ? '#3b82f6' : '#ef4444' },
                      { label: 'Lucro/km rodado', value: `R$ ${p.avgProfitPerKm.toFixed(2)}/km`, color: p.avgProfitPerKm >= 0 ? '#a855f7' : '#ef4444' },
                    ].map((m) => (
                      <div key={m.label} style={{ background: '#0f172a', borderRadius: 10, padding: '10px 12px', border: '1px solid #1e293b' }}>
                        <p style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>{m.label}</p>
                        <p style={{ fontSize: 16, fontWeight: 800, color: m.color }}>{m.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ponto de equilíbrio e metas */}
                <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: 14, marginBottom: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 12 }}>🎯 Metas e ponto de equilíbrio</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Break-even */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#0f172a', borderRadius: 10, border: '1px solid #1e293b' }}>
                      <div>
                        <p style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Ponto de equilíbrio</p>
                        <p style={{ fontSize: 11, color: '#475569' }}>Corridas mínimas por dia para não ter prejuízo</p>
                      </div>
                      <p style={{ fontSize: 20, fontWeight: 900, color: '#f59e0b' }}>{p.breakevenTrips} corridas</p>
                    </div>
                    {/* Meta faturamento */}
                    {p.goalDaily > 0 && (
                      <div style={{ padding: '10px 12px', background: '#0f172a', borderRadius: 10, border: '1px solid #1e293b' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Meta faturamento/dia ({fmtR(p.goalDaily)})</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color: p.daysAboveRevGoal >= p.activeDays * 0.7 ? '#22c55e' : '#f59e0b' }}>
                            {p.daysAboveRevGoal}/{p.activeDays} dias ✓
                          </span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: '#334155', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${p.activeDays > 0 ? (p.daysAboveRevGoal / p.activeDays * 100) : 0}%`, background: '#22c55e', borderRadius: 3 }} />
                        </div>
                      </div>
                    )}
                    {/* Meta lucro */}
                    {p.goalDailyProfit > 0 && (
                      <div style={{ padding: '10px 12px', background: '#0f172a', borderRadius: 10, border: '1px solid #1e293b' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Meta lucro/dia ({fmtR(p.goalDailyProfit)})</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color: p.daysAboveProfGoal >= p.activeDays * 0.7 ? '#22c55e' : '#f59e0b' }}>
                            {p.daysAboveProfGoal}/{p.activeDays} dias ✓
                          </span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: '#334155', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${p.activeDays > 0 ? (p.daysAboveProfGoal / p.activeDays * 100) : 0}%`, background: '#3b82f6', borderRadius: 3 }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Projeção mensal */}
                {p.activeDays > 0 && (
                  <div style={{ background: 'linear-gradient(135deg, #22c55e15, #3b82f615)', border: '1px solid #22c55e30', borderRadius: 14, padding: 14, marginBottom: 16 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 10 }}>📅 Projeção mensal (se manter ritmo)</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div style={{ background: '#0f172a80', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                        <p style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Faturamento</p>
                        <p style={{ fontSize: 18, fontWeight: 900, color: '#22c55e' }}>{fmtR(p.projMonthly.revenue)}</p>
                      </div>
                      <div style={{ background: '#0f172a80', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                        <p style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Lucro líquido</p>
                        <p style={{ fontSize: 18, fontWeight: 900, color: p.projMonthly.profit >= 0 ? '#3b82f6' : '#ef4444' }}>{fmtR(p.projMonthly.profit)}</p>
                      </div>
                    </div>
                    {settings.goalMonthlyRevenue > 0 && (
                      <p style={{ fontSize: 11, color: '#64748b', marginTop: 10, textAlign: 'center' }}>
                        Meta mensal: {fmtR(settings.goalMonthlyRevenue)} — projeção é {p.projMonthly.revenue >= settings.goalMonthlyRevenue ? '✅ acima' : '⚠️ abaixo'} da meta
                      </p>
                    )}
                  </div>
                )}

                {/* Recomendações */}
                {p.recs.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 10 }}>💡 Recomendações</p>
                    {p.recs.map((r, i) => (
                      <div key={i} style={{
                        background: `${r.color}10`, border: `1px solid ${r.color}40`,
                        borderRadius: 12, padding: '11px 13px', marginBottom: 8,
                        display: 'flex', gap: 10, alignItems: 'flex-start',
                      }}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>{r.icon}</span>
                        <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5 }}>{r.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )
      })()}

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

      {/* ═══════ TAB: PONTOS QUENTES ═══════ */}
      {tab === 'hotspots' && (() => {
        const maxCount = hotspots[0]?.count || 1
        const maxPeak  = Math.max(...peakHours.map((h) => h.count), 1)
        const medals   = ['🥇', '🥈', '🥉']
        const fmtR     = (v) => `R$ ${v.toFixed(2).replace('.', ',')}`
        const topPeak  = [...peakHours].sort((a, b) => b.count - a.count).slice(0, 3)

        return (
          <>
            {/* Seletor de período */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[
                { id: 'today', label: 'Hoje' },
                { id: 'week',  label: '7 dias' },
                { id: 'month', label: '30 dias' },
              ].map((pp) => (
                <button key={pp.id} onClick={() => setHsPeriod(pp.id)}
                  style={{
                    flex: 1, padding: '9px 0',
                    background: hsPeriod === pp.id ? '#22c55e20' : '#1e293b',
                    border: `1px solid ${hsPeriod === pp.id ? '#22c55e' : '#334155'}`,
                    borderRadius: 20, color: hsPeriod === pp.id ? '#22c55e' : '#64748b',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}
                >{pp.label}</button>
              ))}
            </div>

            {/* Horários de pico */}
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: 14, marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 10 }}>
                🕐 Horários de maior demanda
              </p>
              <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 64 }}>
                {peakHours.map((h) => {
                  const pct = (h.count / maxPeak) * 100
                  const isPeak = topPeak.some((p) => p.hour === h.hour)
                  return (
                    <div key={h.hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{
                        width: '100%', borderRadius: '3px 3px 0 0',
                        background: isPeak ? '#22c55e' : '#334155',
                        height: `${Math.max(pct * 0.9, h.count > 0 ? 5 : 1)}%`,
                        minHeight: h.count > 0 ? 4 : 1,
                        transition: 'height 0.4s ease',
                      }} />
                      {h.hour % 6 === 0 && (
                        <span style={{ fontSize: 9, color: '#475569' }}>{h.hour}h</span>
                      )}
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                {topPeak.filter((p) => p.count > 0).map((p, i) => (
                  <span key={p.hour} style={{
                    fontSize: 12, fontWeight: 700, padding: '4px 10px',
                    background: '#22c55e20', border: '1px solid #22c55e50',
                    borderRadius: 20, color: '#22c55e',
                  }}>
                    {medals[i]} {p.hour}:00–{p.hour + 1}:00 ({p.count} corridas)
                  </span>
                ))}
                {topPeak.every((p) => p.count === 0) && (
                  <span style={{ fontSize: 12, color: '#475569' }}>Sem dados no período</span>
                )}
              </div>
            </div>

            {/* Ranking de hotspots */}
            <p style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 10 }}>
              📍 Ranking de locais com mais embarques
            </p>

            {tripsWithLocation === 0 ? (
              <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: 24, textAlign: 'center' }}>
                <span style={{ fontSize: 40 }}>📡</span>
                <p style={{ fontWeight: 700, color: '#f1f5f9', marginTop: 10, marginBottom: 4 }}>
                  Sem dados de localização
                </p>
                <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
                  {totalHsTrips > 0
                    ? `${totalHsTrips} corridas no período, mas sem GPS registrado. Use o modo rastreado (GPS ativo) para mapear os pontos de embarque.`
                    : 'Complete corridas com GPS ativo para ver os pontos de maior demanda.'}
                </p>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>
                  {tripsWithLocation} de {totalHsTrips} corridas com localização registrada
                </p>
                {hotspots.map((hs, i) => (
                  <div key={i} style={{
                    background: i < 3 ? `#22c55e${i === 0 ? '18' : i === 1 ? '10' : '08'}` : '#1e293b',
                    border: `1px solid ${i < 3 ? '#22c55e40' : '#334155'}`,
                    borderRadius: 12, padding: '12px 14px', marginBottom: 8,
                  }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: i < 3 ? 22 : 16, flexShrink: 0 }}>
                        {i < 3 ? medals[i] : `#${i + 1}`}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {hs.label}
                        </p>
                        <p style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                          {hs.count} embarques · Média {fmtR(hs.earnings / hs.count)}/corrida
                        </p>
                      </div>
                      <a
                        href={`https://www.google.com/maps?q=${hs.lat},${hs.lng}`}
                        target='_blank'
                        rel='noopener noreferrer'
                        style={{ color: '#3b82f6', flexShrink: 0 }}
                        title='Ver no Google Maps'
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>
                    {/* Barra de popularidade */}
                    <div style={{ height: 5, borderRadius: 3, background: '#0f172a', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${(hs.count / maxCount) * 100}%`,
                        background: i === 0 ? '#22c55e' : i === 1 ? '#3b82f6' : i === 2 ? '#f59e0b' : '#475569',
                        borderRadius: 3, transition: 'width 0.5s ease',
                      }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: '#475569' }}>
                        {hs.count} embarques · {fmtR(hs.earnings)} total
                      </span>
                      <span style={{ fontSize: 10, color: '#475569' }}>
                        {Math.round((hs.count / maxCount) * 100)}% do líder
                      </span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )
      })()}

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

      {/* PDFReport Modal */}
      <PDFReport isOpen={showPDFReport} onClose={() => setShowPDFReport(false)} trips={trips} expenses={expenses} settings={settings} />
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
