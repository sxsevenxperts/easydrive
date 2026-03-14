import { useEffect } from 'react'
import { useStore } from '../store'
import { analyzeSafety, calcDistance, calcSpeed, reverseGeocode } from '../utils/safety'

const MOVING_THRESHOLD = 5
const SAFETY_INTERVAL = 60_000
const GEOCODE_INTERVAL = 15_000
const FATIGUE_CHECK_INTERVAL = 60_000
const FATIGUE_THRESHOLD_MIN = 360  // 6 horas em minutos

// Singleton — GPS roda fora do ciclo React, lê/escreve store via getState()
let gpsStarted = false
let wakeLock = null
const gps = {
  watchId: null,
  lastSafety: 0,
  lastGeo: 0,
  lastFatigueCheck: 0,
  lastPt: null,
  totalKm: 0,
  lastTripId: null,
  sessionStartTime: null,
  fatigueAlertedToday: false,
}

async function requestWakeLock() {
  try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen') } catch {}
}

function onPosition(pos) {
  const { latitude: lat, longitude: lon, accuracy } = pos.coords
  const ts = Date.now()
  const loc = { lat, lon, accuracy, ts }
  const store = useStore.getState()

  // Reseta alerta de fadiga quando vira o dia
  const today = new Date().toDateString()
  if (gps._lastFatigueDay !== today) {
    gps._lastFatigueDay = today
    gps.fatigueAlertedToday = false
  }

  // Reseta km quando viagem nova começa
  const tripId = store.activeTrip?.id
  if (tripId && tripId !== gps.lastTripId) {
    gps.totalKm = 0
    gps.lastTripId = tripId
    if (!gps.sessionStartTime) gps.sessionStartTime = ts
  }

  store.setLocation(loc)

  // Auto-detecta origem (captura GPS assim que viagem inicia sem endereço)
  if (
    (store.tripStatus === 'trip' || store.tripStatus === 'waiting') &&
    store.activeTrip &&
    !store.activeTrip.pickupLocation?.lat
  ) {
    store.setPickup({ lat, lon, address: `${lat.toFixed(5)}, ${lon.toFixed(5)}` })
    reverseGeocode(lat, lon).then((geo) => {
      if (geo?.display_name)
        useStore.getState().setPickup({
          lat, lon,
          address: geo.display_name.split(',').slice(0, 3).join(',').trim(),
        })
    })
  }

  // Rastreamento de km e pontos da rota
  if (gps.lastPt && store.tripStatus === 'trip') {
    const dist = calcDistance(gps.lastPt.lat, gps.lastPt.lon, lat, lon)
    const speed = calcSpeed(gps.lastPt, loc)
    if (speed > MOVING_THRESHOLD) {
      gps.totalKm += dist
      store.updateTripKm(parseFloat(gps.totalKm.toFixed(3)))
      store.addRoutePoint({ lat, lon, ts, speed: Math.round(speed) })
    }
  }
  gps.lastPt = loc

  // Geocoding (endereço legível da posição atual)
  if (ts - gps.lastGeo > GEOCODE_INTERVAL) {
    gps.lastGeo = ts
    reverseGeocode(lat, lon).then((geo) => {
      if (geo?.display_name)
        useStore.getState().setAddress(geo.display_name.split(',').slice(0, 3).join(',').trim())
    })
  }

  // Análise de segurança
  if (ts - gps.lastSafety > SAFETY_INTERVAL) {
    gps.lastSafety = ts
    analyzeSafety(lat, lon).then((result) => {
      const s = useStore.getState()
      s.setSafetyScore(result)
      if (result.score < 35) {
        s.addAlert({
          type: 'danger',
          title: '⚠️ Área de risco detectada',
          body: `${result.suburb || result.address.split(',')[0]} — Score ${result.score}/100`,
        })
        if (Notification.permission === 'granted')
          new Notification('EasyDrive — Área de Risco', {
            body: `Área de PERIGO (score ${result.score}/100)`,
          })
      }
    })
  }

  // Verificar fadiga (alerta a cada 1 min, mas notifica apenas uma vez por dia)
  if (ts - gps.lastFatigueCheck > FATIGUE_CHECK_INTERVAL && store.tripStatus === 'trip') {
    gps.lastFatigueCheck = ts
    if (gps.sessionStartTime) {
      const drivingMinutes = Math.round((ts - gps.sessionStartTime) / 60_000)
      const fatigueAlertHours = store.settings?.fatigueAlertHours ?? 6
      const fatigueThreshold = fatigueAlertHours * 60

      if (drivingMinutes >= fatigueThreshold && !gps.fatigueAlertedToday) {
        gps.fatigueAlertedToday = true
        const s = useStore.getState()
        s.addAlert({
          type: 'warning',
          title: '⏰ Alerta de fadiga',
          body: `Você está dirigindo há ${fatigueAlertHours}h+ — repouso recomendado`,
          duration: 8000,
        })
        if (Notification.permission === 'granted')
          new Notification('EasyDrive — Alerta de Fadiga', {
            body: `Você dirigiu ${fatigueAlertHours}+ horas. Descanse!`,
          })
      }
    }
  }
}

function startGPS() {
  if (gpsStarted || !navigator.geolocation) return
  gpsStarted = true

  if ('Notification' in window && Notification.permission === 'default')
    Notification.requestPermission()

  requestWakeLock()
  gps.watchId = navigator.geolocation.watchPosition(
    onPosition,
    (err) => console.warn('GPS:', err.message),
    { enableHighAccuracy: true, timeout: 5_000, maximumAge: 0 }
  )
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') requestWakeLock()
  })
}

// Hook com apenas 1 useEffect — zero hook de estado, zero conflito de ordem
export function useGPS() {
  useEffect(() => {
    startGPS()
  }, [])
}
