/**
 * EasyDrive — Sync Layer
 * Sincroniza dados locais (Zustand/localStorage) com Supabase.
 * Estratégia: local-first, sync em background.
 * O motorista sempre vê seus dados locais (rápido).
 * Em background, dados são enviados pro Supabase (admin vê tudo).
 */

import { supabase } from './supabase'

const SYNC_KEY = 'easydrive_sync_queue'
const LAST_SYNC_KEY = 'easydrive_last_sync'

// ── Fila de sync (quando offline) ──
function getQueue() {
  try { return JSON.parse(localStorage.getItem(SYNC_KEY)) || [] } catch { return [] }
}

function addToQueue(action) {
  const queue = getQueue()
  queue.push({ ...action, queued_at: Date.now() })
  localStorage.setItem(SYNC_KEY, JSON.stringify(queue.slice(-200)))
}

function clearQueue() {
  localStorage.setItem(SYNC_KEY, '[]')
}

// ── Sync de corridas ──
export async function syncTrip(trip, userId) {
  if (!supabase || !userId) return

  const row = {
    id: trip.id,
    user_id: userId,
    platform: trip.platform,
    start_time: trip.startTime,
    end_time: trip.endTime,
    duration: trip.duration,
    earnings: trip.earnings || 0,
    km: trip.km || 0,
    fuel_cost: trip.fuelCost || 0,
    pickup_address: trip.pickupLocation?.address || null,
    pickup_lat: trip.pickupLocation?.lat || null,
    pickup_lon: trip.pickupLocation?.lon || null,
    dest_address: trip.destination?.address || null,
    dest_lat: trip.destination?.lat || null,
    dest_lon: trip.destination?.lon || null,
    manual: trip.manual || false,
  }

  try {
    const { error } = await supabase
      .from('trips')
      .upsert(row, { onConflict: 'id' })
    if (error) throw error
  } catch {
    addToQueue({ type: 'trip', data: row })
  }
}

// ── Sync de despesas ──
export async function syncExpense(expense, userId) {
  if (!supabase || !userId) return

  const row = {
    id: expense.id,
    user_id: userId,
    category: expense.category,
    value: expense.value || 0,
    note: expense.note || null,
    date: expense.date || expense.id,
  }

  try {
    const { error } = await supabase
      .from('expenses')
      .upsert(row, { onConflict: 'id' })
    if (error) throw error
  } catch {
    addToQueue({ type: 'expense', data: row })
  }
}

// ── Deletar corrida no Supabase ──
export async function syncDeleteTrip(tripId, userId) {
  if (!supabase || !userId) return
  try {
    await supabase.from('trips').delete().eq('id', tripId).eq('user_id', userId)
  } catch {
    addToQueue({ type: 'delete_trip', data: { id: tripId, user_id: userId } })
  }
}

// ── Deletar despesa no Supabase ──
export async function syncDeleteExpense(expenseId, userId) {
  if (!supabase || !userId) return
  try {
    await supabase.from('expenses').delete().eq('id', expenseId).eq('user_id', userId)
  } catch {
    addToQueue({ type: 'delete_expense', data: { id: expenseId, user_id: userId } })
  }
}

// ── Sync daily_stats (snapshot diário para admin) ──
export async function syncDailyStats(trips, expenses, settings, userId) {
  if (!supabase || !userId) return

  const today = new Date()
  const dateStr = today.toISOString().split('T')[0]
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()

  const todayTrips = trips.filter(t => (t.endTime || t.startTime) >= todayStart)
  const todayExpenses = expenses.filter(e => (e.date || e.id) >= todayStart)

  const totalEarnings = todayTrips.reduce((a, t) => a + (t.earnings || 0), 0)
  const totalKm = todayTrips.reduce((a, t) => a + (t.km || 0), 0)
  const totalFuelCost = todayTrips.reduce((a, t) => a + (t.fuelCost || 0), 0)
  const totalExpenses = totalFuelCost + todayExpenses.reduce((a, e) => a + (e.value || 0), 0)

  const hoursWorked = todayTrips.reduce((a, t) => a + ((t.duration || 0) / 3600000), 0)
  const platformsUsed = [...new Set(todayTrips.map(t => t.platform).filter(Boolean))]

  try {
    await supabase.from('daily_stats').upsert({
      user_id: userId,
      date: dateStr,
      total_trips: todayTrips.length,
      total_earnings: totalEarnings,
      total_km: totalKm,
      total_fuel_cost: totalFuelCost,
      total_expenses: totalExpenses,
      hours_worked: Math.round(hoursWorked * 100) / 100,
      platforms_used: platformsUsed,
    }, { onConflict: 'user_id,date' })
  } catch {}
}

// ── Processar fila pendente ──
export async function processQueue(userId) {
  if (!supabase || !userId) return
  const queue = getQueue()
  if (queue.length === 0) return

  const failed = []

  for (const item of queue) {
    try {
      switch (item.type) {
        case 'trip':
          await supabase.from('trips').upsert(item.data, { onConflict: 'id' })
          break
        case 'expense':
          await supabase.from('expenses').upsert(item.data, { onConflict: 'id' })
          break
        case 'delete_trip':
          await supabase.from('trips').delete().eq('id', item.data.id)
          break
        case 'delete_expense':
          await supabase.from('expenses').delete().eq('id', item.data.id)
          break
      }
    } catch {
      failed.push(item)
    }
  }

  localStorage.setItem(SYNC_KEY, JSON.stringify(failed))
}

// ── Sync completo (pull do Supabase → local) ──
// Usado na primeira abertura ou após longo período offline
export async function fullSync(userId) {
  if (!supabase || !userId) return null

  try {
    const [tripsRes, expensesRes] = await Promise.all([
      supabase.from('trips').select('*').eq('user_id', userId).order('start_time', { ascending: false }).limit(500),
      supabase.from('expenses').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(200),
    ])

    const remoteTripsList = (tripsRes.data || []).map(t => ({
      id: t.id,
      platform: t.platform,
      startTime: t.start_time,
      endTime: t.end_time,
      duration: t.duration,
      earnings: Number(t.earnings) || 0,
      km: Number(t.km) || 0,
      fuelCost: Number(t.fuel_cost) || 0,
      pickupLocation: t.pickup_address ? { address: t.pickup_address, lat: t.pickup_lat, lon: t.pickup_lon } : null,
      destination: t.dest_address ? { address: t.dest_address, lat: t.dest_lat, lon: t.dest_lon } : null,
      manual: t.manual,
    }))

    const remoteExpensesList = (expensesRes.data || []).map(e => ({
      id: e.id,
      category: e.category,
      value: Number(e.value) || 0,
      note: e.note,
      date: e.date,
    }))

    localStorage.setItem(LAST_SYNC_KEY, Date.now().toString())

    return { trips: remoteTripsList, expenses: remoteExpensesList }
  } catch {
    return null
  }
}

// ── Iniciar sync periódico ──
let syncInterval = null

export function startPeriodicSync(userId, getState) {
  if (syncInterval) clearInterval(syncInterval)

  // Processar fila pendente imediatamente
  processQueue(userId)

  // A cada 5 minutos, sync daily stats + processar fila
  syncInterval = setInterval(() => {
    const { trips, expenses, settings } = getState()
    syncDailyStats(trips, expenses, settings, userId)
    processQueue(userId)
  }, 5 * 60 * 1000)

  return () => clearInterval(syncInterval)
}

export function stopPeriodicSync() {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  }
}
