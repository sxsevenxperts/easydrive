import { useState, useCallback, useRef, useEffect } from 'react'
import { useStore } from '../store'
import { useTimer } from '../hooks/useTimer'
import { fmt } from '../utils/format'
import SafetyCard from '../components/SafetyCard'
import RouteMap from '../components/RouteMap'
import { reverseGeocode } from '../utils/safety'
import { parseRideText, PLATFORM_LIST } from '../utils/rideParser'
import { fetchRoutes, rankRoutes, getTrafficInfo } from '../utils/routing'
import { fetchWeather } from '../utils/weather'
import {
  Navigation, MapPin, Flag, Play, Pause, Square,
  Fuel, Clock, Search, Loader, CheckCircle, Clipboard,
  X, ChevronDown, ChevronUp, Route, Zap, TrendingDown,
  AlertTriangle, Wind, CloudRain,
} from 'lucide-react'

const PLATFORMS = PLATFORM_LIST

async function searchAddress(query) {
  if (!query || query.length < 5) return []
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=4&countrycodes=br`,
    { headers: { 'Accept-Language': 'pt-BR' } }
  )
  if (!res.ok) return []
  return res.json()
}

export default function ActiveTrip({ sharedRide }) {
  const {
    tripStatus, activeTrip, settings, currentLocation, safetyScore,
    startWaiting, startTrip, pauseTrip, resumeTrip,
    finishTrip, cancelTrip, setPickup, setDestination,
  } = useStore()

  const timer = useTimer()

  const [earningsInput,    setEarningsInput]    = useState('')
  const [showFinish,       setShowFinish]        = useState(false)
  const [platform,         setPlatform]          = useState('uber')
  const [showAllPlatforms, setShowAllPlatforms]  = useState(false)

  // Clipboard / Share
  const [detectedRide,   setDetectedRide]   = useState(sharedRide || null)
  const [showPasteModal, setShowPasteModal] = useState(false)
  const [pasteText,      setPasteText]      = useState('')
  const lastClipRef = useRef('')
  const [monitoring, setMonitoring] = useState(false)

  // Destino
  const [destQuery,    setDestQuery]    = useState('')
  const [destResults,  setDestResults]  = useState([])
  const [destSearching,setDestSearching]= useState(false)
  const searchTimeout = useRef(null)

  // Rotas OSRM
  const [routeInfo,    setRouteInfo]    = useState(null)   // ranked routes
  const [routeLoading, setRouteLoading] = useState(false)
  const [selectedRoute,setSelectedRoute]= useState(0)     // índice da rota selecionada

  // Clima
  const [weather, setWeather] = useState(null)

  // ── Clipboard / Share monitoring ──────────────────────────────────────
  const tryReadClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (!text || text === lastClipRef.current) return
      lastClipRef.current = text
      const parsed = parseRideText(text)
      if (parsed) { setDetectedRide(parsed); if (parsed.platform) setPlatform(parsed.platform) }
    } catch {}
  }, [])

  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') tryReadClipboard() }
    document.addEventListener('visibilitychange', onVis)
    let pollId = null
    const startPoll = () => { pollId = setInterval(tryReadClipboard, 2000); setMonitoring(true) }
    const stopPoll  = () => { clearInterval(pollId); setMonitoring(false) }
    window.addEventListener('focus', startPoll)
    window.addEventListener('blur',  stopPoll)
    if (document.hasFocus()) startPoll()
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', startPoll)
      window.removeEventListener('blur',  stopPoll)
      clearInterval(pollId)
    }
  }, [tryReadClipboard])

  // ── Busca clima quando GPS disponível + refresh a cada 15 min ────────
  useEffect(() => {
    if (!currentLocation?.lat) return
    fetchWeather(currentLocation.lat, currentLocation.lon).then(setWeather)
    const id = setInterval(() => {
      fetchWeather(currentLocation.lat, currentLocation.lon).then(setWeather)
    }, 15 * 60 * 1000)
    return () => clearInterval(id)
  }, [currentLocation?.lat, currentLocation?.lon])

  // ── Busca rota OSRM quando origem+destino disponíveis ─────────────────
  useEffect(() => {
    const origin = activeTrip?.pickupLocation ?? currentLocation
    const dest   = activeTrip?.destination

    if (!origin?.lat || !dest?.lat) { setRouteInfo(null); return }

    setRouteLoading(true)
    fetchRoutes(origin.lat, origin.lon, dest.lat, dest.lon).then((routes) => {
      if (!routes) { setRouteLoading(false); return }
      const ranked = rankRoutes(
        routes,
        settings.fuelPrice        ?? 6.0,
        settings.fuelConsumption  ?? 35,
        safetyScore?.score        ?? 60,
      )
      setRouteInfo(ranked)
      setSelectedRoute(0)
      setRouteLoading(false)
    })
  }, [
    activeTrip?.pickupLocation?.lat,
    activeTrip?.destination?.lat,
    currentLocation?.lat,
  ])

  const fuelCost = activeTrip
    ? (activeTrip.km / (settings.fuelConsumption || 35)) * (settings.fuelPrice || 6)
    : 0

  // ── Corrida detectada via clipboard ───────────────────────────────────
  const applyDetectedRide = useCallback(() => {
    if (!detectedRide) return
    if (detectedRide.pickup) {
      fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(detectedRide.pickup)}&limit=1&countrycodes=br`,
        { headers: { 'Accept-Language': 'pt-BR' } }
      ).then((r) => r.json()).then((results) => {
        if (results[0]) setPickup({ lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon), address: detectedRide.pickup })
      }).catch(() => {})
    }
    if (detectedRide.dest) {
      setDestQuery(detectedRide.dest)
      fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(detectedRide.dest)}&limit=4&countrycodes=br`,
        { headers: { 'Accept-Language': 'pt-BR' } }
      ).then((r) => r.json()).then(setDestResults).catch(() => {})
    }
    setDetectedRide(null)
  }, [detectedRide, setPickup])

  const handlePasteSubmit = () => {
    const parsed = parseRideText(pasteText)
    if (parsed) { setDetectedRide(parsed); setShowPasteModal(false); setPasteText('') }
  }

  const handleFinish = () => {
    const value = parseFloat(earningsInput.replace(',', '.')) || 0
    finishTrip(value)
    setEarningsInput(''); setShowFinish(false); setDestQuery(''); setDestResults([])
    setRouteInfo(null)
  }

  const handleDestInput = useCallback((text) => {
    setDestQuery(text); setDestResults([])
    clearTimeout(searchTimeout.current)
    if (text.length < 4) return
    setDestSearching(true)
    searchTimeout.current = setTimeout(async () => {
      const results = await searchAddress(text)
      setDestResults(results); setDestSearching(false)
    }, 600)
  }, [])

  const handleSelectDest = (result) => {
    setDestination({
      lat: parseFloat(result.lat), lon: parseFloat(result.lon),
      address: result.display_name.split(',').slice(0, 3).join(',').trim(),
    })
    setDestQuery(result.display_name.split(',').slice(0, 2).join(',').trim())
    setDestResults([])
  }

  const traffic = getTrafficInfo()

  // Rotas a exibir no mapa (apenas a selecionada ou todas)
  const mapRoutes = routeInfo
    ? routeInfo.map((r, i) => ({ ...r, isRecommended: i === selectedRoute }))
    : []

  // ══════════════════════════════════════════════════════════════════════
  //  TELA SEM VIAGEM ATIVA
  // ══════════════════════════════════════════════════════════════════════
  if (tripStatus === 'idle') {
    return (
      <div style={{ padding: '20px 16px 100px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>Nova Viagem</h1>
            <p style={{ color: 'var(--text3)', fontSize: 13, marginTop: 2 }}>Configure e inicie o monitoramento</p>
          </div>
          <StatusPill active={monitoring} label={monitoring ? 'Monitorando' : 'Aguardando'} />
        </div>

        {/* Card clima */}
        {weather && <WeatherCard weather={weather} />}

        {/* Tráfego atual */}
        <TrafficBadge traffic={traffic} />

        {/* Plataforma */}
        <SectionLabel icon='🚗'>Plataforma</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 8 }}>
          {(showAllPlatforms ? PLATFORMS : PLATFORMS.slice(0, 8)).map((p) => (
            <button
              key={p.id}
              onClick={() => setPlatform(p.id)}
              style={{
                background: platform === p.id ? '#3b82f620' : 'var(--bg3)',
                border: `2px solid ${platform === p.id ? '#3b82f6' : 'var(--border)'}`,
                borderRadius: 12, padding: '10px 4px',
                color: platform === p.id ? '#3b82f6' : 'var(--text3)',
                fontWeight: 700, fontSize: 11, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 20 }}>{p.emoji}</span>
              {p.label}
            </button>
          ))}
        </div>
        {PLATFORMS.length > 8 && (
          <button
            onClick={() => setShowAllPlatforms(v => !v)}
            style={{
              width: '100%', padding: '8px', background: 'var(--bg3)',
              border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text3)',
              fontSize: 12, cursor: 'pointer', marginBottom: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}
          >
            {showAllPlatforms ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showAllPlatforms ? 'Ver menos' : `Ver mais ${PLATFORMS.length - 8} plataformas`}
          </button>
        )}

        {/* Destino */}
        <SectionLabel icon='📍'>Destino (opcional)</SectionLabel>
        <DestSearch
          value={destQuery}
          onChange={handleDestInput}
          searching={destSearching}
          results={destResults}
          onSelect={handleSelectDest}
        />

        {/* Rota sugerida (pré-viagem) */}
        {routeLoading && <LoadingRoute />}
        {routeInfo && <RouteCards routes={routeInfo} selected={selectedRoute} onSelect={setSelectedRoute} fuelPrice={settings.fuelPrice} />}

        {/* Corrida detectada */}
        {detectedRide && <DetectedRideCard ride={detectedRide} onApply={applyDetectedRide} onDismiss={() => setDetectedRide(null)} platforms={PLATFORMS} />}

        {/* GPS status */}
        {currentLocation && (
          <div style={{
            background: '#22c55e12', border: '1px solid #22c55e30',
            borderRadius: 12, padding: '10px 14px', marginBottom: 16,
            display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <CheckCircle size={14} color='#22c55e' />
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>GPS ativo — origem capturada automaticamente ao iniciar</span>
          </div>
        )}

        <button
          onClick={() => { startWaiting(); startTrip(platform) }}
          style={{
            width: '100%', padding: '18px',
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            border: 'none', borderRadius: 16, color: '#fff',
            fontSize: 16, fontWeight: 800, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: '0 4px 20px #3b82f640', marginBottom: 16,
            letterSpacing: -0.3,
          }}
        >
          <Navigation size={20} />
          Iniciar Monitoramento
        </button>

        <SafetyCard />

        <button
          onClick={() => setShowPasteModal(true)}
          style={{
            width: '100%', padding: '13px',
            background: 'none', border: '1px dashed var(--border)',
            borderRadius: 12, color: 'var(--text3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            cursor: 'pointer', fontSize: 14, marginTop: 14,
          }}
        >
          <Clipboard size={16} />
          Colar detalhes do pedido (Uber / 99)
        </button>

        {/* Modal colar */}
        {showPasteModal && (
          <BottomSheet onClose={() => { setShowPasteModal(false); setPasteText('') }}>
            <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>Colar detalhes do pedido</h3>
            <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 14, lineHeight: 1.5 }}>
              Copie o texto do Uber/99 e cole abaixo para detectar os endereços.
            </p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={'Buscar em Rua das Flores, 123\nDestino: Shopping Iguatemi'}
              rows={5}
              style={{
                width: '100%', background: 'var(--bg)',
                border: '1px solid var(--border)', borderRadius: 10,
                padding: 12, color: 'var(--text)', fontSize: 14,
                resize: 'none', outline: 'none', boxSizing: 'border-box', marginBottom: 14,
              }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowPasteModal(false); setPasteText('') }}
                style={{ flex: 1, padding: 13, background: 'var(--bg3)', border: 'none', borderRadius: 12, color: 'var(--text2)', cursor: 'pointer', fontWeight: 600 }}>
                Cancelar
              </button>
              <button onClick={handlePasteSubmit}
                style={{ flex: 2, padding: 13, background: '#3b82f6', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                Detectar endereços
              </button>
            </div>
          </BottomSheet>
        )}

        <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════
  //  TELA COM VIAGEM ATIVA
  // ══════════════════════════════════════════════════════════════════════
  const recRoute = routeInfo?.[selectedRoute]

  return (
    <div style={{ padding: '16px 16px 100px' }}>

      {/* Status badge */}
      <div style={{
        background: tripStatus === 'trip' ? '#22c55e15' : '#f59e0b15',
        border: `1px solid ${tripStatus === 'trip' ? '#22c55e40' : '#f59e0b40'}`,
        borderRadius: 14, padding: '12px 16px', marginBottom: 14,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{
          width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
          background: tripStatus === 'trip' ? '#22c55e' : '#f59e0b',
          animation: 'pulse 1.5s infinite',
        }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>
            {tripStatus === 'trip' ? 'Em viagem — rastreando rota' : tripStatus === 'paused' ? 'Pausado' : 'Aguardando'}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>
            {activeTrip?.platform?.toUpperCase()} • Iniciou às {fmt.time(activeTrip?.startTime)}
          </p>
        </div>
        {weather && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 1, flexShrink: 0,
          }} title={weather.tip}>
            <span style={{ fontSize: 20 }}>{weather.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)' }}>{weather.temp}°C</span>
          </div>
        )}
      </div>

      {/* Mapa */}
      <div style={{ marginBottom: 14 }}>
        <RouteMap
          route={activeTrip?.route || []}
          currentLocation={currentLocation}
          pickupLocation={activeTrip?.pickupLocation}
          destination={activeTrip?.destination}
          plannedRoutes={mapRoutes}
          height={220}
        />
      </div>

      {/* Carregando rota */}
      {routeLoading && <LoadingRoute />}

      {/* Cards de rota (se tiver destino) */}
      {routeInfo && (
        <RouteCards routes={routeInfo} selected={selectedRoute} onSelect={setSelectedRoute} fuelPrice={settings.fuelPrice} />
      )}

      {/* Alerta de tráfego pesado */}
      {traffic.level === 'pesado' && (
        <TrafficBadge traffic={traffic} />
      )}

      {/* Clima durante viagem */}
      {weather?.isRain && (
        <div style={{
          background: '#3b82f615', border: '1px solid #3b82f640',
          borderRadius: 12, padding: '10px 14px', marginBottom: 12,
          display: 'flex', gap: 10, alignItems: 'center',
        }}>
          <CloudRain size={16} color='#3b82f6' />
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{weather.icon} {weather.label}</p>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{weather.tip}</p>
          </div>
        </div>
      )}

      {/* Origem / Destino */}
      <div style={{
        background: 'var(--bg3)', borderRadius: 14, padding: 14,
        border: '1px solid var(--border)', marginBottom: 12,
      }}>
        <RouteRow
          icon={<MapPin size={13} color='#22c55e' />}
          label='ORIGEM'
          value={activeTrip?.pickupLocation?.address || 'Detectando via GPS...'}
          detecting={!activeTrip?.pickupLocation?.address}
        />
        <div style={{ height: 1, background: 'var(--border-dim)', margin: '10px 0' }} />
        {!activeTrip?.destination ? (
          <DestSearch
            compact
            value={destQuery}
            onChange={handleDestInput}
            searching={destSearching}
            results={destResults}
            onSelect={handleSelectDest}
          />
        ) : (
          <RouteRow icon={<Flag size={13} color='#ef4444' />} label='DESTINO' value={activeTrip.destination.address} />
        )}
      </div>

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <MetricBox icon={<Navigation size={15} color='#3b82f6' />} label='Distância' value={fmt.km(activeTrip?.km || 0)} />
        <MetricBox
          icon={<Fuel size={15} color='#f97316' />}
          label='Combustível'
          value={fmt.currency(fuelCost)}
          sub={`${((activeTrip?.km || 0) / (settings.fuelConsumption || 35)).toFixed(2)} L`}
        />
      </div>

      {/* Tempo */}
      <div style={{
        background: 'var(--bg3)', borderRadius: 14, padding: 14,
        border: '1px solid var(--border)', marginBottom: 12,
      }}>
        <p style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
          Rastreamento de tempo
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
          <TimeBox label='Total'   ms={timer.total}              color='#3b82f6' />
          <TimeBox label='Rodando' ms={timer.moving}             color='#22c55e' />
          <TimeBox label='Ocioso'  ms={timer.idle + timer.paused} color='#f59e0b' />
        </div>
      </div>

      {/* Segurança */}
      <div style={{ marginBottom: 14 }}>
        <SafetyCard />
      </div>

      {/* Controles */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        {tripStatus === 'trip'
          ? <ActionBtn color='#f59e0b' onClick={pauseTrip}  icon={<Pause  size={17} />} label='Pausar' />
          : <ActionBtn color='#22c55e' onClick={resumeTrip} icon={<Play   size={17} />} label='Continuar' />
        }
        <ActionBtn
          color='#3b82f6' flex={2}
          onClick={() => setShowFinish(true)}
          icon={<Square size={17} />}
          label='Finalizar Corrida'
        />
      </div>
      <button
        onClick={cancelTrip}
        style={{
          width: '100%', padding: '11px', background: 'none',
          border: '1px solid var(--border)', borderRadius: 12,
          color: 'var(--text3)', cursor: 'pointer', fontSize: 13,
        }}
      >
        Cancelar sem registrar
      </button>

      {/* Modal finalizar */}
      {showFinish && (
        <BottomSheet onClose={() => setShowFinish(false)}>
          <h3 style={{ fontWeight: 800, fontSize: 19, marginBottom: 4 }}>Finalizar corrida</h3>
          <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 20 }}>
            {fmt.km(activeTrip?.km || 0)} percorridos • {fmt.currency(fuelCost)} em combustível
          </p>
          {activeTrip?.pickupLocation?.address && (
            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 12px', marginBottom: 16, border: '1px solid var(--border)' }}>
              <p style={{ fontSize: 11, color: '#22c55e', fontWeight: 700, marginBottom: 4 }}>📍 {activeTrip.pickupLocation.address}</p>
              {activeTrip.destination?.address && (
                <p style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>🏁 {activeTrip.destination.address}</p>
              )}
            </div>
          )}
          <SectionLabel icon='💰'>Valor recebido pela corrida</SectionLabel>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
            <span style={{ color: '#22c55e', fontSize: 22, fontWeight: 800 }}>R$</span>
            <input
              type='number' value={earningsInput}
              onChange={(e) => setEarningsInput(e.target.value)}
              placeholder='0,00' autoFocus
              style={{ ...inputStyle, margin: 0, flex: 1, fontSize: 24, fontWeight: 800, color: '#22c55e' }}
            />
          </div>
          {earningsInput && (
            <div style={{ background: '#22c55e12', border: '1px solid #22c55e30', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: 'var(--text2)' }}>
                Ganho líquido: <strong style={{ color: '#22c55e' }}>{fmt.currency((parseFloat(earningsInput.replace(',', '.')) || 0) - fuelCost)}</strong>
              </p>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowFinish(false)} style={{ flex: 1, padding: '14px', background: 'var(--bg3)', border: 'none', borderRadius: 12, color: 'var(--text2)', cursor: 'pointer', fontWeight: 600 }}>Voltar</button>
            <button onClick={handleFinish} style={{ flex: 2, padding: '14px', background: 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none', borderRadius: 12, color: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: 15 }}>Confirmar</button>
          </div>
        </BottomSheet>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes spin   { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  )
}

// ─── Componentes auxiliares ──────────────────────────────────────────────────

function StatusPill({ active, label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: active ? '#22c55e12' : 'var(--bg3)',
      border: `1px solid ${active ? '#22c55e40' : 'var(--border)'}`,
      borderRadius: 20, padding: '5px 12px',
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: active ? '#22c55e' : '#475569',
        animation: active ? 'pulse 1.5s infinite' : 'none',
      }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: active ? '#22c55e' : 'var(--text3)' }}>{label}</span>
    </div>
  )
}

function WeatherCard({ weather }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, var(--bg3), var(--bg2))',
      border: '1px solid var(--border)', borderRadius: 16,
      padding: '14px 16px', marginBottom: 16,
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <span style={{ fontSize: 36 }}>{weather.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)' }}>{weather.temp}°C</span>
          <span style={{ fontSize: 13, color: 'var(--text3)' }}>{weather.label}</span>
        </div>
        <p style={{ fontSize: 12, color: weather.isRain ? '#3b82f6' : 'var(--text3)', lineHeight: 1.4 }}>
          {weather.tip}
        </p>
        {weather.rainProb > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <CloudRain size={11} color='#3b82f6' />
            <span style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600 }}>
              {weather.rainProb}% de chuva nas próx. 3h
            </span>
          </div>
        )}
      </div>
      <div style={{ textAlign: 'right' }}>
        <Wind size={14} color='var(--text3)' />
        <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{weather.windspeed} km/h</p>
      </div>
    </div>
  )
}

function TrafficBadge({ traffic }) {
  return (
    <div style={{
      background: `${traffic.color}15`,
      border: `1px solid ${traffic.color}40`,
      borderRadius: 12, padding: '10px 14px', marginBottom: 14,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ fontSize: 18 }}>{traffic.icon}</span>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: traffic.color }}>{traffic.label}</p>
        {traffic.level === 'pesado' && (
          <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
            Tempo estimado pode ser até {Math.round((traffic.factor - 1) * 100)}% maior
          </p>
        )}
      </div>
    </div>
  )
}

function LoadingRoute() {
  return (
    <div style={{
      background: 'var(--bg3)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '12px 14px', marginBottom: 12,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <Loader size={16} color='#3b82f6' style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: 13, color: 'var(--text3)' }}>Calculando rota otimizada...</span>
    </div>
  )
}

function RouteCards({ routes, selected, onSelect, fuelPrice }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <Route size={14} color='#3b82f6' />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Rotas disponíveis
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {routes.map((r, i) => (
          <button
            key={i}
            onClick={() => onSelect(i)}
            style={{
              width: '100%', padding: '12px 14px', textAlign: 'left',
              background: i === selected ? '#3b82f615' : 'var(--bg3)',
              border: `2px solid ${i === selected ? '#3b82f6' : 'var(--border)'}`,
              borderRadius: 14, cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: i === selected ? '#3b82f6' : 'var(--text)' }}>
                {r.label}
              </span>
              {r.isRecommended && (
                <span style={{ fontSize: 10, background: '#3b82f620', color: '#3b82f6', fontWeight: 800, padding: '2px 8px', borderRadius: 20 }}>
                  MELHOR
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <RouteMetric icon='📍' value={`${r.distanceKm} km`} />
              <RouteMetric icon='⏱️' value={`${r.adjMin} min`} sub={r.traffic.level !== 'leve' ? r.traffic.label : null} subColor={r.traffic.color} />
              <RouteMetric icon='⛽' value={`R$ ${r.fuelCost.toFixed(2)}`} />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function RouteMetric({ icon, value, sub, subColor }) {
  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{icon} {value}</p>
      {sub && <p style={{ fontSize: 10, color: subColor || 'var(--text3)', marginTop: 1 }}>{sub}</p>}
    </div>
  )
}

function DestSearch({ value, onChange, searching, results, onSelect, compact }) {
  return (
    <div style={{ position: 'relative', marginBottom: compact ? 0 : 16 }}>
      {!compact && <p style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, marginBottom: 6 }}>DESTINO</p>}
      <div style={{ position: 'relative' }}>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={compact ? 'Buscar destino...' : 'Buscar destino — ex: Shopping Iguatemi'}
          style={{ ...inputStyle, margin: 0, paddingRight: 40, ...(compact ? { padding: '9px 36px 9px 12px', fontSize: 13 } : {}) }}
        />
        <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
          {searching ? <Loader size={16} color='var(--text3)' style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} color='var(--text3)' />}
        </span>
      </div>
      {results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: 'var(--bg3)', border: '1px solid var(--border)',
          borderRadius: 12, overflow: 'hidden', marginTop: 4,
          boxShadow: '0 8px 32px #0006',
        }}>
          {results.map((r) => (
            <button
              key={r.place_id}
              onClick={() => onSelect(r)}
              style={{
                width: '100%', padding: '11px 14px', textAlign: 'left',
                background: 'none', border: 'none', borderBottom: '1px solid var(--border-dim)',
                color: 'var(--text)', cursor: 'pointer', fontSize: 13,
              }}
            >
              📍 {r.display_name.split(',').slice(0, 3).join(', ')}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function DetectedRideCard({ ride, onApply, onDismiss, platforms }) {
  const plat = platforms.find(p => p.id === ride.platform)
  return (
    <div style={{
      background: '#3b82f612', border: '1px solid #3b82f650',
      borderRadius: 14, padding: '12px 14px', marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Clipboard size={14} color='#3b82f6' />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#3b82f6', flex: 1 }}>
          {plat ? `${plat.emoji} ${plat.label} detectado!` : 'Corrida detectada!'}
        </span>
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 0 }}>
          <X size={14} />
        </button>
      </div>
      {ride.pickup && <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>📍 <strong>Origem:</strong> {ride.pickup}</p>}
      {ride.dest   && <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>🏁 <strong>Destino:</strong> {ride.dest}</p>}
      {ride.value  && <p style={{ fontSize: 12, color: '#22c55e', marginBottom: 10 }}>💰 <strong>Valor:</strong> R$ {ride.value.toFixed(2)}</p>}
      <button onClick={onApply} style={{
        width: '100%', padding: '10px', background: '#3b82f6',
        border: 'none', borderRadius: 10, color: '#fff',
        fontSize: 13, fontWeight: 700, cursor: 'pointer',
      }}>
        Usar esses endereços
      </button>
    </div>
  )
}

function BottomSheet({ children, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000b', display: 'flex', alignItems: 'flex-end', zIndex: 200 }}>
      <div style={{
        background: 'var(--bg3)', borderRadius: '20px 20px 0 0',
        padding: '24px 20px', width: '100%',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
        border: '1px solid var(--border)',
      }}>
        {children}
      </div>
    </div>
  )
}

function SectionLabel({ icon, children }) {
  return (
    <p style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
      {icon && <span>{icon}</span>}{children}
    </p>
  )
}

function RouteRow({ icon, label, value, detecting }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <div style={{ marginTop: 1 }}>{icon}</div>
      <div>
        <p style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700 }}>{label}</p>
        <p style={{ fontSize: 13, color: detecting ? 'var(--text3)' : 'var(--text)', fontStyle: detecting ? 'italic' : 'normal' }}>
          {detecting ? '⏳ Detectando via GPS...' : value}
        </p>
      </div>
    </div>
  )
}

function MetricBox({ icon, label, value, sub }) {
  return (
    <div style={{ background: 'var(--bg3)', borderRadius: 14, padding: 14, border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
        {icon}
        <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</span>
      </div>
      <p style={{ fontWeight: 800, fontSize: 20, color: 'var(--text)' }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{sub}</p>}
    </div>
  )
}

function TimeBox({ label, ms, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 16, fontWeight: 800, color }}>{fmt.duration(ms)}</p>
      <p style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</p>
    </div>
  )
}

function ActionBtn({ color, onClick, icon, label, flex = 1 }) {
  return (
    <button onClick={onClick} style={{
      flex, padding: '14px',
      background: `${color}15`, border: `1px solid ${color}60`,
      borderRadius: 14, color,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      cursor: 'pointer', fontWeight: 700, fontSize: 14,
      transition: 'all 0.15s',
    }}>
      {icon} {label}
    </button>
  )
}

const inputStyle = {
  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 12, padding: '12px 14px', color: 'var(--text)',
  fontSize: 15, outline: 'none', marginBottom: 14, boxSizing: 'border-box',
}
