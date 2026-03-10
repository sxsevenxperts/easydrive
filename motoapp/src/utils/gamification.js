// EasyDrive — Sistema de Gamificação
// Calcula recordes, conquistas e streaks a partir do histórico de corridas

import { format, differenceInCalendarDays, startOfDay, subDays, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ── RECORDES DIÁRIOS ────────────────────────────────────────────
export function calcDailyRecords(trips, settings) {
  if (!trips || trips.length === 0) return null

  const byDay = {}
  trips.forEach((t) => {
    const ts = t.endTime || t.startTime
    if (!ts) return
    const key = startOfDay(new Date(ts)).toISOString()
    if (!byDay[key]) byDay[key] = { date: key, earnings: 0, km: 0, fuel: 0, trips: 0, netProfit: 0 }
    const fuel = t.fuelCost || (t.km / settings.fuelConsumption) * settings.fuelPrice
    byDay[key].earnings += t.earnings || 0
    byDay[key].km += t.km || 0
    byDay[key].fuel += fuel
    byDay[key].trips += 1
    byDay[key].netProfit += (t.earnings || 0) - fuel
  })

  const days = Object.values(byDay).filter(d => d.trips > 0)
  if (days.length === 0) return null

  // Melhor dia de ganho bruto
  const bestEarnings = days.reduce((best, d) => d.earnings > best.earnings ? d : best, days[0])

  // Melhor dia de lucro líquido (ganho - combustível)
  const bestProfit = days.reduce((best, d) => d.netProfit > best.netProfit ? d : best, days[0])

  // Dia que mais economizou (menor gasto de combustível por R$ ganho)
  const daysWithEarnings = days.filter(d => d.earnings > 0)
  const bestEfficiency = daysWithEarnings.length > 0
    ? daysWithEarnings.reduce((best, d) => {
        const ratio = d.fuel / d.earnings
        const bestRatio = best.fuel / best.earnings
        return ratio < bestRatio ? d : best
      }, daysWithEarnings[0])
    : null

  // Mais corridas em um dia
  const mostTrips = days.reduce((best, d) => d.trips > best.trips ? d : best, days[0])

  // Mais km em um dia
  const mostKm = days.reduce((best, d) => d.km > best.km ? d : best, days[0])

  return {
    bestEarnings: { ...bestEarnings, label: formatDayLabel(bestEarnings.date) },
    bestProfit: { ...bestProfit, label: formatDayLabel(bestProfit.date) },
    bestEfficiency: bestEfficiency ? { ...bestEfficiency, label: formatDayLabel(bestEfficiency.date), ratio: (bestEfficiency.fuel / bestEfficiency.earnings * 100).toFixed(0) } : null,
    mostTrips: { ...mostTrips, label: formatDayLabel(mostTrips.date) },
    mostKm: { ...mostKm, label: formatDayLabel(mostKm.date) },
    totalDays: days.length,
  }
}

// ── STREAK (DIAS CONSECUTIVOS) ──────────────────────────────────
export function calcStreak(trips) {
  if (!trips || trips.length === 0) return { current: 0, best: 0 }

  // Pega datas únicas de trabalho
  const workDays = new Set()
  trips.forEach((t) => {
    const ts = t.endTime || t.startTime
    if (ts) workDays.add(startOfDay(new Date(ts)).toISOString())
  })

  const sorted = [...workDays].sort().reverse() // mais recente primeiro
  if (sorted.length === 0) return { current: 0, best: 0 }

  // Streak atual
  let current = 0
  let cursor = startOfDay(new Date())

  // Se hoje ainda não trabalhou, começa de ontem
  if (!workDays.has(cursor.toISOString())) {
    cursor = subDays(cursor, 1)
  }

  while (workDays.has(cursor.toISOString())) {
    current++
    cursor = subDays(cursor, 1)
  }

  // Melhor streak histórico
  let best = 0
  let tempStreak = 1
  const sortedAsc = [...workDays].sort()
  for (let i = 1; i < sortedAsc.length; i++) {
    const diff = differenceInCalendarDays(new Date(sortedAsc[i]), new Date(sortedAsc[i - 1]))
    if (diff === 1) {
      tempStreak++
    } else {
      best = Math.max(best, tempStreak)
      tempStreak = 1
    }
  }
  best = Math.max(best, tempStreak, current)

  return { current, best }
}

// ── CONQUISTAS / BADGES ─────────────────────────────────────────
export function calcAchievements(trips, settings) {
  const total = trips?.length || 0
  const totalKm = trips?.reduce((a, t) => a + (t.km || 0), 0) || 0
  const totalEarnings = trips?.reduce((a, t) => a + (t.earnings || 0), 0) || 0
  const streak = calcStreak(trips)

  const achievements = [
    // Corridas
    { id: 'first_ride', emoji: '🏁', title: 'Primeira Corrida', desc: 'Completou sua primeira corrida', unlocked: total >= 1 },
    { id: 'rides_10', emoji: '⭐', title: 'Iniciante', desc: '10 corridas completadas', unlocked: total >= 10, progress: Math.min(total, 10), max: 10 },
    { id: 'rides_50', emoji: '🌟', title: 'Experiente', desc: '50 corridas completadas', unlocked: total >= 50, progress: Math.min(total, 50), max: 50 },
    { id: 'rides_100', emoji: '💫', title: 'Veterano', desc: '100 corridas completadas', unlocked: total >= 100, progress: Math.min(total, 100), max: 100 },
    { id: 'rides_500', emoji: '👑', title: 'Rei da Estrada', desc: '500 corridas completadas', unlocked: total >= 500, progress: Math.min(total, 500), max: 500 },

    // Km
    { id: 'km_100', emoji: '🛣️', title: 'Desbravador', desc: '100 km rodados', unlocked: totalKm >= 100, progress: Math.min(Math.round(totalKm), 100), max: 100 },
    { id: 'km_1000', emoji: '🗺️', title: 'Explorador', desc: '1.000 km rodados', unlocked: totalKm >= 1000, progress: Math.min(Math.round(totalKm), 1000), max: 1000 },
    { id: 'km_5000', emoji: '🌎', title: 'Viajante', desc: '5.000 km rodados', unlocked: totalKm >= 5000, progress: Math.min(Math.round(totalKm), 5000), max: 5000 },

    // Ganhos
    { id: 'earn_500', emoji: '💵', title: 'Primeiros R$500', desc: 'Ganhou R$500 no total', unlocked: totalEarnings >= 500, progress: Math.min(Math.round(totalEarnings), 500), max: 500 },
    { id: 'earn_5000', emoji: '💰', title: 'Cofre Cheio', desc: 'Ganhou R$5.000 no total', unlocked: totalEarnings >= 5000, progress: Math.min(Math.round(totalEarnings), 5000), max: 5000 },
    { id: 'earn_20000', emoji: '🏆', title: 'Máquina de Lucro', desc: 'Ganhou R$20.000 no total', unlocked: totalEarnings >= 20000, progress: Math.min(Math.round(totalEarnings), 20000), max: 20000 },

    // Streaks
    { id: 'streak_3', emoji: '🔥', title: 'Fogo!', desc: '3 dias seguidos trabalhando', unlocked: streak.best >= 3, progress: Math.min(streak.best, 3), max: 3 },
    { id: 'streak_7', emoji: '🔥🔥', title: 'Semana Perfeita', desc: '7 dias seguidos', unlocked: streak.best >= 7, progress: Math.min(streak.best, 7), max: 7 },
    { id: 'streak_30', emoji: '🔥🔥🔥', title: 'Mês de Ferro', desc: '30 dias seguidos', unlocked: streak.best >= 30, progress: Math.min(streak.best, 30), max: 30 },
  ]

  return achievements
}

// ── HELPERS ──────────────────────────────────────────────────────
function formatDayLabel(dateStr) {
  const d = new Date(dateStr)
  if (isToday(d)) return 'Hoje'
  if (isYesterday(d)) return 'Ontem'
  return format(d, "dd/MM (EEEE)", { locale: ptBR })
}
