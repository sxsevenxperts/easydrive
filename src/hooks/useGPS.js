import { useEffect } from 'react'
import { useStore } from '../store'
import { analyzeSafety, calcDistance, calcSpeed, reverseGeocode } from '../utils/safety'

const MOVING_THRESHOLD = 5
const SAFETY_INTERVAL = 60_000
const GEOCODE_INTERVAL = 15_000
const FATIGUE_CHECK_INTERVAL = 60_000

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
  const prev = store.currentLocation

  // Se já temos GPS preciso (<100m), ignora dados imprecisos (>2km = IP)
  if (prev && prev.accuracy < 100 && accuracy > 2000) return

  // Atualiza location
  store.setLocation({ ...loc })

  // Se precisão melhorou MUITO (ex: IP→GPS), atualiza origem da viagem também
  const precisionImproved = prev && prev.accuracy > 1000 && accuracy < 200
  if (precisionImproved) {
    // Força atualizar endereço e origem
    gps.lastGeo = 0
    const trip = store.activeTrip
    if (trip && (store.tripStatus === 'trip' || store.tripStatus === 'waiting')) {
      store.setPickup({ lat, lon, address: `${lat.toFixed(5)}, ${lon.toFixed(5)}` })
      reverseGeocode(lat, lon).then((geo) => {
        if (geo?.display_name)
          useStore.getState().setPickup({
            lat, lon,
            address: geo.display_name.split(',').slice(0, 3).join(',').trim(),
          })
      })
    }
  }

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

  // Verificar fadiga
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

// ── GPS Engine ──────────────────────────────────────────────────────────────

function startGPS() {
  if (gpsStarted) return
  gpsStarted = true

  if ('Notification' in window && Notification.permission === 'default')
    Notification.requestPermission()

  requestWakeLock()

  // Sem geolocation? Fallback IP
  if (!navigator.geolocation) {
    getIPLocation()
    return
  }

  // 1) Tentativa imediata com alta precisão
  navigator.geolocation.getCurrentPosition(
    onPosition,
    (err) => {
      console.warn('[GPS] getCurrentPosition falhou:', err.code, err.message)
      handleGPSError(err)
    },
    { enableHighAccuracy: true, timeout: 20_000, maximumAge: 10_000 }
  )

  // 2) Watch contínuo
  gps.watchId = navigator.geolocation.watchPosition(
    onPosition,
    (err) => {
      console.warn('[GPS] watchPosition erro:', err.code, err.message)
      handleGPSError(err)
    },
    { enableHighAccuracy: true, timeout: 30_000, maximumAge: 5_000 }
  )

  // 3) Polling a cada 5s como backup
  setInterval(() => {
    if (!gpsStarted) return
    navigator.geolocation.getCurrentPosition(onPosition, () => {}, {
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 5_000,
    })
  }, 5000)

  // 4) Refresh ao voltar para o app
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      requestWakeLock()
      navigator.geolocation.getCurrentPosition(onPosition, () => {}, {
        enableHighAccuracy: true, timeout: 15_000, maximumAge: 0,
      })
    }
  })

  // 5) Se sem GPS em 8s, fallback IP
  setTimeout(() => {
    if (!useStore.getState().currentLocation) {
      console.warn('[GPS] Sem posição após 8s — usando IP')
      getIPLocation()
    }
  }, 8000)
}

let errorAlerted = false

function handleGPSError(err) {
  const store = useStore.getState()

  if (err.code === 1 && !errorAlerted) {
    errorAlerted = true
    store.addAlert({
      type: 'error',
      title: '🚫 GPS bloqueado',
      message: 'Ative: Configurações → Localização → Permitir para este site',
      duration: 10000,
    })
  }

  // Se não temos nenhuma localização, fallback IP
  if (!store.currentLocation) getIPLocation()
}

async function getIPLocation() {
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return
    const data = await res.json()
    if (data.latitude && data.longitude) {
      onPosition({
        coords: { latitude: data.latitude, longitude: data.longitude, accuracy: 5000 },
      })
      useStore.getState().addAlert({
        type: 'info',
        title: '📍 Localização aproximada via IP',
        message: 'Ative o GPS do celular para localização precisa',
        duration: 8000,
      })
    }
  } catch {}
}

// Hook
export function useGPS() {
  useEffect(() => { startGPS() }, [])
}
