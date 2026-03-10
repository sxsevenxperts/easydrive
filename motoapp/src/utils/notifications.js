// EasyDrive — Sistema de Notificações Push
// Gerencia permissões, envio e verificação automática de metas/riscos

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

// ── TIPOS DE ALERTA ──────────────────────────────────────────────
export const NOTIFY = {
  // ✅ Meta alcançada
  goalReached: (label, value) => sendNotification(
    `✅ Meta Alcançada! — ${label}`,
    `Você atingiu ${value}! Continue assim! 🎉`,
    { tag: `goal-reached-${label}`, requireInteraction: false }
  ),

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
  loss: (fuelCost, earnings) => sendNotification(
    `🔴 ATENÇÃO: Você está no prejuízo!`,
    `Combustível (${fuelCost}) está maior que ganhos (${earnings}). Considere pausar.`,
    { tag: 'loss-alert', requireInteraction: true, vibrate: [500, 200, 500, 200, 500] }
  ),

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
  achievement: (title, desc) => sendNotification(
    `🏆 Conquista desbloqueada: ${title}`,
    desc,
    { tag: `achievement-${title}` }
  ),

  // 🚨 Segurança
  safetyAlert: (message) => sendNotification(
    `🚨 Alerta de Segurança`,
    message,
    { tag: 'safety-alert', requireInteraction: true, vibrate: [500, 200, 500] }
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
