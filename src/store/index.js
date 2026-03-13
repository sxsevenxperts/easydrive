import { create } from 'zustand'
import { syncTrip, syncExpense, syncDeleteTrip, syncDeleteExpense, syncDailyStats } from '../lib/sync'

// Persistência manual — sem middleware para evitar hook order instável
const STORAGE_KEY = 'motoapp-v1'

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveState(partial) {
  try {
    const prev = loadState()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prev, ...partial }))
  } catch {}
}

const saved = loadState()

const defaultSettings = {
  vehicle: 'moto',
  fuelType: 'gasolina',
  fuelPrice: 6.49,
  fuelConsumption: 35,
  plate: '',
  name: '',
  platforms: ['uber', '99'],
  goalDailyRevenue: 0,
  goalDailyProfit: 0,
  goalWeeklyRevenue: 0,
  goalWeeklyProfit: 0,
  goalMonthlyRevenue: 0,
  goalMonthlyProfit: 0,
  goalYearlyRevenue: 0,
  notifSafety: true,
  notifAchievements: true,
  notifStreak: true,
}

const defaultStats = {
  totalEarnings: 0, totalExpenses: 0, totalKm: 0,
  totalFuelCost: 0, totalTrips: 0,
  todayEarnings: 0, todayKm: 0, todayTrips: 0,
}

export const useStore = create((set, get) => ({
  // ── USUÁRIO LOGADO (para sync) ──
  userId: null,
  userEmail: null,
  setUser: (id, email) => set({ userId: id, userEmail: email }),

  // ── CONFIGURAÇÕES ──
  settings: { ...defaultSettings, ...(saved.settings || {}) },
  updateSettings: (data) => {
    set((s) => { const settings = { ...s.settings, ...data }; saveState({ settings }); return { settings } })
  },

  // ── VIAGEM ATIVA ──
  activeTrip: null,
  tripStatus: 'idle',

  startWaiting: () => set({
    activeTrip: {
      id: Date.now(), platform: 'uber', startTime: Date.now(),
      pickupLocation: null, destination: null,
      route: [], earnings: 0, km: 0,
      statusLog: [{ status: 'waiting', at: Date.now() }],
    },
    tripStatus: 'waiting',
  }),

  setPickup: (location) => set((s) => ({
    activeTrip: s.activeTrip ? { ...s.activeTrip, pickupLocation: location } : null,
  })),

  setDestination: (location) => set((s) => ({
    activeTrip: s.activeTrip ? { ...s.activeTrip, destination: location } : null,
  })),

  startTrip: (platform = 'uber') => set((s) => {
    if (!s.activeTrip) return {}
    return {
      activeTrip: { ...s.activeTrip, platform, tripStartTime: Date.now() },
      tripStatus: 'trip',
    }
  }),

  pauseTrip: () => set((s) => ({
    activeTrip: s.activeTrip ? {
      ...s.activeTrip,
      statusLog: [...(s.activeTrip.statusLog || []), { status: 'paused', at: Date.now() }],
    } : null,
    tripStatus: 'paused',
  })),

  resumeTrip: () => set((s) => ({
    activeTrip: s.activeTrip ? {
      ...s.activeTrip,
      statusLog: [...(s.activeTrip.statusLog || []), { status: 'trip', at: Date.now() }],
    } : null,
    tripStatus: 'trip',
  })),

  addRoutePoint: (point) => set((s) => ({
    activeTrip: s.activeTrip ? { ...s.activeTrip, route: [...(s.activeTrip.route || []), point] } : null,
  })),

  updateTripKm: (km) => set((s) => ({
    activeTrip: s.activeTrip ? { ...s.activeTrip, km } : null,
  })),

  finishTrip: (earnings) => {
    const s = get()
    if (!s.activeTrip) return
    const trip = {
      ...s.activeTrip, earnings,
      endTime: Date.now(),
      duration: Date.now() - s.activeTrip.startTime,
      fuelCost: (s.activeTrip.km / s.settings.fuelConsumption) * s.settings.fuelPrice,
    }
    const trips = [trip, ...(get().trips || [])].slice(0, 500)
    saveState({ trips })
    set({ trips, activeTrip: null, tripStatus: 'idle' })
    get()._recalcStats()

    // Sync com Supabase em background
    if (s.userId) {
      syncTrip(trip, s.userId)
      syncDailyStats(trips, get().expenses, s.settings, s.userId)
    }
  },

  cancelTrip: () => set({ activeTrip: null, tripStatus: 'idle' }),

  // ── HISTÓRICO ──
  trips: saved.trips || [],
  addManualTrip: (tripData) => {
    const trip = {
      id: Date.now(), ...tripData, manual: true,
      fuelCost: (tripData.km / get().settings.fuelConsumption) * get().settings.fuelPrice,
    }
    const trips = [trip, ...get().trips].slice(0, 500)
    saveState({ trips })
    set({ trips })
    get()._recalcStats()

    // Sync
    const userId = get().userId
    if (userId) syncTrip(trip, userId)
  },
  deleteTrip: (id) => {
    const trips = get().trips.filter((t) => t.id !== id)
    saveState({ trips })
    set({ trips })
    get()._recalcStats()

    // Sync
    const userId = get().userId
    if (userId) syncDeleteTrip(id, userId)
  },

  // Substituir trips local por dados do Supabase (full sync)
  setTripsFromSync: (trips) => {
    saveState({ trips })
    set({ trips })
    get()._recalcStats()
  },

  // ── GASTOS ──
  expenses: saved.expenses || [],
  addExpense: (expense) => {
    const exp = { id: Date.now(), ...expense }
    const expenses = [exp, ...get().expenses].slice(0, 200)
    saveState({ expenses })
    set({ expenses })
    get()._recalcStats()

    // Sync
    const userId = get().userId
    if (userId) syncExpense(exp, userId)
  },
  deleteExpense: (id) => {
    const expenses = get().expenses.filter((e) => e.id !== id)
    saveState({ expenses })
    set({ expenses })
    get()._recalcStats()

    // Sync
    const userId = get().userId
    if (userId) syncDeleteExpense(id, userId)
  },

  setExpensesFromSync: (expenses) => {
    saveState({ expenses })
    set({ expenses })
    get()._recalcStats()
  },

  // ── MANUTENÇÕES ──
  maintenances: saved.maintenances || [],
  addMaintenance: (item) => {
    const m = { id: Date.now(), done: false, createdAt: Date.now(), ...item }
    const maintenances = [m, ...get().maintenances]
    saveState({ maintenances })
    set({ maintenances })
  },
  updateMaintenance: (id, data) => {
    const maintenances = get().maintenances.map((m) => m.id === id ? { ...m, ...data } : m)
    saveState({ maintenances })
    set({ maintenances })
  },
  deleteMaintenance: (id) => {
    const maintenances = get().maintenances.filter((m) => m.id !== id)
    saveState({ maintenances })
    set({ maintenances })
  },

  // ── ESTATÍSTICAS ──
  stats: saved.stats || defaultStats,
  _recalcStats: () => {
    const { trips, expenses, settings } = get()
    const today = new Date().toDateString()
    const todayTrips = trips.filter((t) => new Date(t.endTime || t.startTime).toDateString() === today)
    const totalEarnings = trips.reduce((a, t) => a + (t.earnings || 0), 0)
    const totalKm = trips.reduce((a, t) => a + (t.km || 0), 0)
    const totalFuelCost = trips.reduce((a, t) => a + (t.fuelCost || 0), 0)
    const totalOtherExpenses = expenses.reduce((a, e) => a + (e.value || 0), 0)
    const stats = {
      totalEarnings, totalKm, totalFuelCost,
      totalExpenses: totalFuelCost + totalOtherExpenses,
      totalTrips: trips.length,
      todayEarnings: todayTrips.reduce((a, t) => a + (t.earnings || 0), 0),
      todayKm: todayTrips.reduce((a, t) => a + (t.km || 0), 0),
      todayTrips: todayTrips.length,
    }
    saveState({ stats })
    set({ stats })
  },

  // ── LOCALIZAÇÃO E SEGURANÇA ──
  currentLocation: null,
  currentAddress: null,
  safetyScore: null,
  setLocation: (loc) => set({ currentLocation: loc }),
  setAddress: (addr) => set({ currentAddress: addr }),
  setSafetyScore: (score) => set({ safetyScore: score }),

  // ── ALERTAS ──
  alerts: [],
  addAlert: (alert) => set((s) => ({ alerts: [{ id: Date.now(), ...alert }, ...s.alerts.slice(0, 19)] })),
  clearAlerts: () => set({ alerts: [] }),
}))
