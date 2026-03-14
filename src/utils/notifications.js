// EasyDrive — Sistema de Notificações Push
// Gerencia permissões, envio e verificação automática de metas/riscos

import { useStore } from '../store'

// ── PERMISSÃO ────────────────────────────────────────────────────
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function getPermissionStatus() {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission // 'granted' | 'denied' | 'default'
}

// ── ENVIAR NOTIFICAÇÃO ───────────────────────────────────────────
export function sendNotification(title, body, options = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return

  const defaults = {
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    lang: 'pt-BR',
    vibrate: [200, 100, 200],
    requireInteraction: false,
    ...options,
  }

  // Usa Service Worker se disponível (funciona com app minimizado)
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_NOTIFICATION',
      title,
      body,
      options: defaults,
    })
  } else {
    // Fallback direto
    new Notification(title, { body, ...defaults })
  }
}

// ── ADICIONAR ALERT AO STORE (para toast visual) ────────────────────
// Chamado pelos NOTIFY métodos para exibir toast no app
export function addToastAlert(title, message, type = 'info', duration = 5000) {
  try {
    useStore.getState().addAlert({
      title,
      message,
      type,
      duration,
    })
  } catch {
    // Store não carregado ou não disponível
  }
}

// ── TIPOS DE ALERTA ──────────────────────────────────────────────
export const NOTIFY = {
  // ✅ Meta alcançada
  goalReached: (label, value) => {
    sendNotification(
      `✅ Meta Alcançada! — ${label}`,
      `Você atingiu ${value}! Continue assim! 🎉`,
      { tag: `goal-reached-${label}`, requireInteraction: false }
    )
    addToastAlert(`✅ Meta Alcançada!`, `${label}: ${value}`, 'success')
  },

  // ⚠️ Meta em risco
  goalAtRisk: (label, current, target, pct) => sendNotification(
    `⚠️ Meta em risco — ${label}`,
    `Você está em ${pct}% (${current} de ${target}). Ainda dá tempo!`,
    { tag: `goal-risk-${label}`, requireInteraction: false, vibrate: [300, 100, 300] }
  ),

  // ❌ Meta não alcançada (fim do dia)
  goalMissed: (label, current, target) => sendNotification(
    `❌ Meta não alcançada — ${label}`,
    `Você fez ${current} de ${target} hoje. Amanhã é uma nova chance! 💪`,
    { tag: `goal-missed-${label}` }
  ),

  // 🔴 Prejuízo (combustível > ganhos)
  loss: (fuelCost, earnings) => {
    sendNotification(
      `🔴 ATENÇÃO: Você está no prejuízo!`,
      `Combustível (${fuelCost}) está maior que ganhos (${earnings}). Considere pausar.`,
      { tag: 'loss-alert', requireInteraction: true, vibrate: [500, 200, 500, 200, 500] }
    )
    addToastAlert('🔴 Prejuízo Detectado!', `Combustível (${fuelCost}) > Ganhos (${earnings})`, 'error', 7000)
  },

  // 🟡 Prejuízo potencial (custo alto por km)
  highCostWarning: (costPerKm) => sendNotification(
    `🟡 Custo elevado detectado`,
    `Você está gastando ${costPerKm}/km hoje. Avalie se vale a pena continuar.`,
    { tag: 'high-cost-warn' }
  ),

  // 🔥 Streak ameaçado
  streakRisk: (days) => sendNotification(
    `🔥 Sua sequência de ${days} dias está em risco!`,
    `Você ainda não trabalhou hoje. Entre e complete ao menos uma corrida!`,
    { tag: 'streak-risk', requireInteraction: false }
  ),

  // 🏆 Conquista desbloqueada
  achievement: (title, desc) => {
    sendNotification(
      `🏆 Conquista desbloqueada: ${title}`,
      desc,
      { tag: `achievement-${title}` }
    )
    addToastAlert(`🏆 Conquista!`, title, 'achievement')
  },

  // 🚨 Segurança
  safetyAlert: (message) => {
    sendNotification(
      `🚨 Alerta de Segurança`,
      message,
      { tag: 'safety-alert', requireInteraction: true, vibrate: [500, 200, 500] }
    )
    addToastAlert(`🚨 Segurança`, message, 'error', 7000)
  },

  // 🔧 Manutenção próxima
  maintenanceReminder: (title, daysLeft) => sendNotification(
    `🔧 Manutenção em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}`,
    `${title} está se aproximando. Agende já para não perder o prazo!`,
    { tag: `maint-remind-${title}`, requireInteraction: false, vibrate: [300, 100, 300] }
  ),

  // ⛽ Consumo piorou
  consumptionDrop: (current, avg, pct) => sendNotification(
    `⛽ Consumo caiu ${pct}% vs média`,
    `Último abastecimento: ${current} km/L (média: ${avg} km/L). Verifique pneus, filtro e óleo.`,
    { tag: 'consumption-drop', requireInteraction: false, vibrate: [300, 100, 300] }
  ),

  // ⚠️ Manutenção atrasada
  maintenanceOverdue: (title, daysLate) => sendNotification(
    `⚠️ Manutenção ATRASADA: ${title}`,
    daysLate > 0
      ? `Passou ${daysLate} dia${daysLate !== 1 ? 's' : ''} do prazo previsto. Providencie urgente!`
      : `A data prevista passou. Providencie o quanto antes!`,
    { tag: `maint-overdue-${title}`, requireInteraction: true, vibrate: [500, 200, 500, 200, 500] }
  ),

  // ⏰ Alerta de fadiga
  fatigueAlert: (hours) => sendNotification(
    `⏰ Você já dirigiu por ${hours} horas!`,
    `Faça uma pausa de pelo menos 15 minutos. Sua segurança é nossa prioridade.`,
    { tag: 'fatigue-alert', requireInteraction: true, vibrate: [300, 100, 300, 100, 300] }
  ),
}

// ── VERIFICAÇÃO AUTOMÁTICA DE METAS ─────────────────────────────
// Guarda estado para não disparar a mesma notif duas vezes
const notifState = {}

function fmtCurrency(v) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`
}

export function checkGoalNotifications(trips, settings, expenses = []) {
  if (!settings || Notification.permission !== 'granted') return
  // Respeita toggles individuais (padrão: todos ativos)
  const goalsOn = settings.notifGoals !== false
  const lossOn  = settings.notifLoss  !== false

  const now = new Date()
  const hour = now.getHours()

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const todayTrips = trips.filter(t => (t.endTime || t.startTime) >= todayStart)

  const todayRevenue = todayTrips.reduce((a, t) => a + (t.earnings || 0), 0)
  const todayFuel = todayTrips.reduce((a, t) => a + (t.fuelCost || (t.km / settings.fuelConsumption) * settings.fuelPrice), 0)
  const todayProfit = todayRevenue - todayFuel

  const stateKey = now.toDateString()

  // ─── PREJUÍZO ───────────────────────────────────────────────
  if (lossOn && todayRevenue > 0 && todayFuel > todayRevenue) {
    const key = `loss-${stateKey}`
    if (!notifState[key]) {
      notifState[key] = true
      NOTIFY.loss(fmtCurrency(todayFuel), fmtCurrency(todayRevenue))
    }
  }

  // ─── CUSTO ALTO POR KM ──────────────────────────────────────
  const todayKm = todayTrips.reduce((a, t) => a + (t.km || 0), 0)
  if (lossOn && todayKm > 10 && todayFuel / todayKm > settings.fuelPrice / settings.fuelConsumption * 1.5) {
    const key = `highcost-${stateKey}`
    if (!notifState[key]) {
      notifState[key] = true
      NOTIFY.highCostWarning(fmtCurrency(todayFuel / todayKm))
    }
  }

  // ─── META DIÁRIA ALCANÇADA ───────────────────────────────────
  if (goalsOn && settings.goalDailyRevenue > 0) {
    const key = `rev-reached-${stateKey}`
    if (!notifState[key] && todayRevenue >= settings.goalDailyRevenue) {
      notifState[key] = true
      NOTIFY.goalReached('Faturamento Diário', fmtCurrency(todayRevenue))
    }
  }

  if (goalsOn && settings.goalDailyProfit > 0) {
    const key = `profit-reached-${stateKey}`
    if (!notifState[key] && todayProfit >= settings.goalDailyProfit) {
      notifState[key] = true
      NOTIFY.goalReached('Lucro Diário', fmtCurrency(todayProfit))
    }
  }

  // ─── META EM RISCO (a partir das 17h) ───────────────────────
  if (goalsOn && hour >= 17) {
    if (settings.goalDailyRevenue > 0) {
      const pct = Math.round((todayRevenue / settings.goalDailyRevenue) * 100)
      const key = `rev-risk-${stateKey}`
      if (!notifState[key] && pct < 70 && todayRevenue < settings.goalDailyRevenue) {
        notifState[key] = true
        NOTIFY.goalAtRisk('Faturamento do Dia', fmtCurrency(todayRevenue), fmtCurrency(settings.goalDailyRevenue), pct)
      }
    }

    if (settings.goalDailyProfit > 0) {
      const pct = Math.round((todayProfit / settings.goalDailyProfit) * 100)
      const key = `profit-risk-${stateKey}`
      if (!notifState[key] && pct < 70 && todayProfit < settings.goalDailyProfit) {
        notifState[key] = true
        NOTIFY.goalAtRisk('Lucro do Dia', fmtCurrency(todayProfit), fmtCurrency(settings.goalDailyProfit), Math.max(0, pct))
      }
    }
  }

  // ─── META NÃO ALCANÇADA (23h59) ─────────────────────────────
  if (hour === 23) {
    if (settings.goalDailyRevenue > 0 && todayRevenue < settings.goalDailyRevenue) {
      const key = `rev-missed-${stateKey}`
      if (!notifState[key]) {
        notifState[key] = true
        NOTIFY.goalMissed('Faturamento', fmtCurrency(todayRevenue), fmtCurrency(settings.goalDailyRevenue))
      }
    }
  }
}

// ── VERIFICAÇÃO DE CONSUMO DE COMBUSTÍVEL ────────────────────────
export function checkConsumptionAlerts(fuelLogs) {
  if (!fuelLogs?.length || Notification.permission !== 'granted') return

  // Apenas logs com km/L calculado (tanque cheio)
  const measured = fuelLogs.filter((l) => l.kmPerLiter > 0).sort((a, b) => b.date - a.date)
  if (measured.length < 2) return

  const latest = measured[0]
  const prev   = measured.slice(1, 5) // últimas 4 medições anteriores
  const avg    = prev.reduce((a, l) => a + l.kmPerLiter, 0) / prev.length

  const drop = ((avg - latest.kmPerLiter) / avg) * 100
  if (drop < 10) return // não alerta se queda < 10%

  const key = `consumption-drop-${latest.id}`
  if (notifState[key]) return
  notifState[key] = true

  NOTIFY.consumptionDrop(
    latest.kmPerLiter.toFixed(1),
    avg.toFixed(1),
    Math.round(drop)
  )
}

// ── VERIFICAÇÃO DE MANUTENÇÕES ───────────────────────────────────
export function checkMaintenanceReminders(maintenances) {
  if (!maintenances?.length || Notification.permission !== 'granted') return

  const now  = Date.now()
  const today = new Date().toDateString()

  maintenances.forEach((m) => {
    if (m.done || !m.dueDate) return
    const msLeft     = m.dueDate - now
    const daysLeft   = Math.ceil(msLeft / 86_400_000)
    const remDays    = m.reminderDays ?? 7
    const key        = `maint-${m.id}-${today}`
    if (notifState[key]) return

    if (daysLeft < 0) {
      notifState[key] = true
      NOTIFY.maintenanceOverdue(m.title, Math.abs(daysLeft))
    } else if (daysLeft <= remDays) {
      notifState[key] = true
      NOTIFY.maintenanceReminder(m.title, daysLeft)
    }
  })
}

// ── REGISTRAR SERVICE WORKER ─────────────────────────────────────
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    return reg
  } catch (e) {
    console.warn('[SW] Falha ao registrar:', e)
    return null
  }
}
