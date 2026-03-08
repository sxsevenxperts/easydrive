import { useState, useCallback, useRef, useEffect } from 'react'
import { useStore } from '../store'
import { useTimer } from '../hooks/useTimer'
import { fmt } from '../utils/format'
import SafetyCard from '../components/SafetyCard'
import RouteMap from '../components/RouteMap'
import { reverseGeocode } from '../utils/safety'
import { parseRideText } from '../utils/rideParser'
import {
  Navigation, MapPin, Flag, Play, Pause, Square,
  Fuel, Clock, Search, Loader, CheckCircle, Clipboard, X
} from 'lucide-react'

const PLATFORMS = [
  { id: 'uber', label: 'Uber' },
  { id: '99', label: '99' },
  { id: 'inDriver', label: 'inDrive' },
  { id: 'outro', label: 'Outro' },
]

// Busca endereço pelo texto digitado via Nominatim
async function searchAddress(query) {
  if (!query || query.length < 5) return []
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=4&countrycodes=br`,
    { headers: { 'Accept-Language': 'pt-BR' } }
  )
  if (!res.ok) return []
  return await res.json()
}

export default function ActiveTrip({ sharedRide }) {
  const {
    tripStatus, activeTrip, settings, currentLocation,
    startWaiting, startTrip, pauseTrip, resumeTrip,
    finishTrip, cancelTrip, setPickup, setDestination,
  } = useStore()

  const timer = useTimer()

  const [earningsInput, setEarningsInput] = useState('')
  const [showFinish, setShowFinish] = useState(false)
  const [platform, setPlatform] = useState('uber')

  // Detecção automática via clipboard / share
  const [detectedRide, setDetectedRide] = useState(sharedRide || null)
  const [showPasteModal, setShowPasteModal] = useState(false)
  const [pasteText, setPasteText] = useState('')

  // Busca de destino
  const [destQuery, setDestQuery] = useState('')
  const [destResults, setDestResults] = useState([])
  const [destSearching, setDestSearching] = useState(false)
  const searchTimeout = useRef(null)

  // Monitora clipboard quando usuário retorna do Uber/99
  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const text = await navigator.clipboard.readText()
        const parsed = parseRideText(text)
        if (parsed) setDetectedRide(parsed)
      } catch {}
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  const fuelCost = activeTrip
    ? (activeTrip.km / settings.fuelConsumption) * settings.fuelPrice
    : 0

  // Aplica corrida detectada (preenche origem + destino)
  const applyDetectedRide = useCallback(() => {
    if (!detectedRide) return
    if (detectedRide.pickup) {
      // Geocodifica a origem detectada
      import('../utils/safety').then(({ reverseGeocode: _, getNearbyPOIs: __ }) => {})
      fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(detectedRide.pickup)}&limit=1&countrycodes=br`,
        { headers: { 'Accept-Language': 'pt-BR' } }
      ).then((r) => r.json()).then((results) => {
        if (results[0]) {
          setPickup({
            lat: parseFloat(results[0].lat),
            lon: parseFloat(results[0].lon),
            address: detectedRide.pickup,
          })
        }
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

  // Processa texto colado manualmente
  const handlePasteSubmit = () => {
    const parsed = parseRideText(pasteText)
    if (parsed) {
      setDetectedRide(parsed)
      setShowPasteModal(false)
      setPasteText('')
    }
  }

  const handleFinish = () => {
    const value = parseFloat(earningsInput.replace(',', '.')) || 0
    finishTrip(value)
    setEarningsInput('')
    setShowFinish(false)
    setDestQuery('')
    setDestResults([])
  }

  // Busca destino com debounce
  const handleDestInput = useCallback((text) => {
    setDestQuery(text)
    setDestResults([])
    clearTimeout(searchTimeout.current)
    if (text.length < 4) return
    setDestSearching(true)
    searchTimeout.current = setTimeout(async () => {
      const results = await searchAddress(text)
      setDestResults(results)
      setDestSearching(false)
    }, 600)
  }, [])

  const handleSelectDest = (result) => {
    setDestination({
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      address: result.display_name.split(',').slice(0, 3).join(',').trim(),
    })
    setDestQuery(result.display_name.split(',').slice(0, 2).join(',').trim())
    setDestResults([])
  }

  // ── TELA SEM VIAGEM ATIVA ─────────────────────────────────────
  if (tripStatus === 'idle') {
    return (
      <div style={{ padding: '20px 16px 90px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Nova Viagem</h1>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
          Aceite a corrida no app e toque em "Iniciar" — a origem é capturada automaticamente pelo GPS
        </p>

        {/* Plataforma */}
        <SectionLabel>Plataforma</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 20 }}>
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPlatform(p.id)}
              style={{
                background: platform === p.id ? '#3b82f620' : '#1e293b',
                border: `2px solid ${platform === p.id ? '#3b82f6' : '#334155'}`,
                borderRadius: 10, padding: '10px 0',
                color: platform === p.id ? '#3b82f6' : '#64748b',
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Destino (opcional pré-viagem) */}
        <SectionLabel>Destino (opcional)</SectionLabel>
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <div style={{ position: 'relative' }}>
            <input
              value={destQuery}
              onChange={(e) => handleDestInput(e.target.value)}
              placeholder='Buscar destino — ex: Shopping Iguatemi'
              style={{ ...inputStyle, paddingRight: 40 }}
            />
            <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
              {destSearching ? <Loader size={16} color='#64748b' style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} color='#64748b' />}
            </span>
          </div>
          {destResults.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              background: '#1e293b', border: '1px solid #334155', borderRadius: 10,
              overflow: 'hidden', marginTop: 4,
            }}>
              {destResults.map((r) => (
                <button
                  key={r.place_id}
                  onClick={() => handleSelectDest(r)}
                  style={{
                    width: '100%', padding: '11px 14px', textAlign: 'left',
                    background: 'none', border: 'none', borderBottom: '1px solid #334155',
                    color: '#f1f5f9', cursor: 'pointer', fontSize: 13,
                  }}
                >
                  📍 {r.display_name.split(',').slice(0, 3).join(', ')}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Corrida detectada via clipboard / share */}
        {detectedRide && (
          <div style={{
            background: '#3b82f615', border: '1px solid #3b82f6',
            borderRadius: 12, padding: '12px 14px', marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Clipboard size={14} color='#3b82f6' />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#3b82f6' }}>Corrida detectada!</span>
              <button onClick={() => setDetectedRide(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}>
                <X size={14} />
              </button>
            </div>
            {detectedRide.pickup && (
              <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
                📍 <strong>Origem:</strong> {detectedRide.pickup}
              </p>
            )}
            {detectedRide.dest && (
              <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>
                🏁 <strong>Destino:</strong> {detectedRide.dest}
              </p>
            )}
            <button
              onClick={applyDetectedRide}
              style={{
                width: '100%', padding: '9px', background: '#3b82f6',
                border: 'none', borderRadius: 8, color: '#fff',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Usar esses endereços
            </button>
          </div>
        )}

        {/* GPS status */}
        {currentLocation && (
          <div style={{
            background: '#22c55e15', border: '1px solid #22c55e40',
            borderRadius: 10, padding: '10px 14px', marginBottom: 16,
            display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <CheckCircle size={14} color='#22c55e' />
            <span style={{ fontSize: 13, color: '#94a3b8' }}>
              GPS ativo — a origem será capturada automaticamente ao iniciar
            </span>
          </div>
        )}

        <button
          onClick={() => { startWaiting(); startTrip(platform) }}
          style={{
            width: '100%', padding: '16px', marginBottom: 16,
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            border: 'none', borderRadius: 14, color: '#fff',
            fontSize: 16, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <Navigation size={20} />
          Iniciar Monitoramento
        </button>

        <SafetyCard />

        {/* Colar texto do Uber/99 */}
        <button
          onClick={() => setShowPasteModal(true)}
          style={{
            width: '100%', padding: '12px',
            background: 'none', border: '1px dashed #334155',
            borderRadius: 12, color: '#64748b',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            cursor: 'pointer', fontSize: 14, marginBottom: 16,
          }}
        >
          <Clipboard size={16} />
          Colar detalhes do pedido (Uber / 99)
        </button>

        <div style={{
          padding: 14, background: '#1e293b', borderRadius: 12,
          border: '1px solid #334155',
        }}>
          <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
            💡 <strong style={{ color: '#f1f5f9' }}>Como usar:</strong> Aceite a corrida no Uber/99 → copie o texto do pedido → volte aqui → cole usando o botão acima. Ou simplesmente toque "Iniciar" para detectar a origem pelo GPS automaticamente.
          </p>
        </div>

        {/* Modal colar texto */}
        {showPasteModal && (
          <div style={{
            position: 'fixed', inset: 0, background: '#000a',
            display: 'flex', alignItems: 'flex-end', zIndex: 200,
          }}>
            <div style={{
              background: '#1e293b', borderRadius: '20px 20px 0 0',
              padding: '24px 20px', width: '100%',
              paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
            }}>
              <h3 style={{ fontWeight: 800, fontSize: 17, marginBottom: 6 }}>Colar detalhes do pedido</h3>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 14, lineHeight: 1.5 }}>
                Copie o texto do pedido no Uber ou 99 e cole abaixo. O app vai extrair a origem e o destino automaticamente.
              </p>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={'Cole o texto aqui...\nEx: Buscar em Rua das Flores, 123\nDestino: Shopping Iguatemi'}
                rows={5}
                style={{
                  width: '100%', background: '#0f172a', border: '1px solid #334155',
                  borderRadius: 10, padding: 12, color: '#f1f5f9',
                  fontSize: 14, resize: 'none', outline: 'none', boxSizing: 'border-box',
                  marginBottom: 14,
                }}
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => { setShowPasteModal(false); setPasteText('') }}
                  style={{ flex: 1, padding: 12, background: '#334155', border: 'none', borderRadius: 10, color: '#94a3b8', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handlePasteSubmit}
                  style={{ flex: 2, padding: 12, background: '#3b82f6', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  Detectar endereços
                </button>
              </div>
            </div>
          </div>
        )}

        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ── TELA COM VIAGEM ATIVA ────────────────────────────────────
  return (
    <div style={{ padding: '16px 16px 90px' }}>
      {/* Status */}
      <div style={{
        background: tripStatus === 'trip' ? '#22c55e20' : '#f59e0b20',
        border: `1px solid ${tripStatus === 'trip' ? '#22c55e' : '#f59e0b'}`,
        borderRadius: 14, padding: '12px 16px', marginBottom: 12,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{
          width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
          background: tripStatus === 'trip' ? '#22c55e' : '#f59e0b',
          animation: 'pulse 1.5s infinite',
        }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 800, fontSize: 15, color: '#f1f5f9' }}>
            {tripStatus === 'trip' ? 'Em viagem — rastreando rota' : tripStatus === 'paused' ? 'Pausado' : 'Aguardando'}
          </p>
          <p style={{ fontSize: 12, color: '#94a3b8' }}>
            {activeTrip?.platform?.toUpperCase()} • Iniciou às {fmt.time(activeTrip?.startTime)}
          </p>
        </div>
      </div>

      {/* Mapa com rota em tempo real */}
      <div style={{ marginBottom: 12 }}>
        <RouteMap
          route={activeTrip?.route || []}
          currentLocation={currentLocation}
          pickupLocation={activeTrip?.pickupLocation}
          destination={activeTrip?.destination}
          height={200}
        />
      </div>

      {/* Origem e destino detectados */}
      <div style={{
        background: '#1e293b', borderRadius: 12, padding: 12,
        border: '1px solid #334155', marginBottom: 12,
      }}>
        <RouteRow
          icon={<MapPin size={13} color='#22c55e' />}
          label='ORIGEM'
          value={activeTrip?.pickupLocation?.address || 'Detectando via GPS...'}
          detecting={!activeTrip?.pickupLocation?.address}
        />
        <div style={{ height: 1, background: '#334155', margin: '8px 0' }} />

        {/* Busca de destino durante viagem */}
        {!activeTrip?.destination ? (
          <div>
            <p style={{ fontSize: 10, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>DESTINO</p>
            <div style={{ position: 'relative' }}>
              <input
                value={destQuery}
                onChange={(e) => handleDestInput(e.target.value)}
                placeholder='Buscar destino...'
                style={{ ...inputStyle, margin: 0, padding: '9px 36px 9px 12px', fontSize: 13 }}
              />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
                {destSearching
                  ? <Loader size={14} color='#64748b' style={{ animation: 'spin 1s linear infinite' }} />
                  : <Search size={14} color='#64748b' />}
              </span>
            </div>
            {destResults.length > 0 && (
              <div style={{
                background: '#0f172a', border: '1px solid #334155',
                borderRadius: 8, overflow: 'hidden', marginTop: 4,
              }}>
                {destResults.map((r) => (
                  <button
                    key={r.place_id}
                    onClick={() => handleSelectDest(r)}
                    style={{
                      width: '100%', padding: '9px 12px', textAlign: 'left',
                      background: 'none', border: 'none', borderBottom: '1px solid #1e293b',
                      color: '#f1f5f9', cursor: 'pointer', fontSize: 12,
                    }}
                  >
                    🏁 {r.display_name.split(',').slice(0, 3).join(', ')}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <RouteRow
            icon={<Flag size={13} color='#ef4444' />}
            label='DESTINO'
            value={activeTrip.destination.address}
          />
        )}
      </div>

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <MetricBox icon={<Navigation size={15} color='#3b82f6' />} label='Distância' value={fmt.km(activeTrip?.km || 0)} />
        <MetricBox
          icon={<Fuel size={15} color='#f97316' />}
          label='Combustível'
          value={fmt.currency(fuelCost)}
          sub={`${((activeTrip?.km || 0) / settings.fuelConsumption).toFixed(2)} L`}
        />
      </div>

      {/* Tempo */}
      <div style={{
        background: '#1e293b', borderRadius: 12, padding: 14,
        border: '1px solid #334155', marginBottom: 12,
      }}>
        <p style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 10 }}>
          Rastreamento de tempo
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
          <TimeBox label='Total' ms={timer.total} color='#3b82f6' />
          <TimeBox label='Rodando' ms={timer.moving} color='#22c55e' />
          <TimeBox label='Ocioso' ms={timer.idle + timer.paused} color='#f59e0b' />
        </div>
      </div>

      {/* Segurança */}
      <div style={{ marginBottom: 14 }}>
        <SafetyCard />
      </div>

      {/* Controles */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        {tripStatus === 'trip'
          ? <ActionBtn color='#f59e0b' onClick={pauseTrip} icon={<Pause size={17} />} label='Pausar' />
          : <ActionBtn color='#22c55e' onClick={resumeTrip} icon={<Play size={17} />} label='Continuar' />
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
          width: '100%', padding: '10px', background: 'none',
          border: '1px solid #334155', borderRadius: 10,
          color: '#64748b', cursor: 'pointer', fontSize: 13,
        }}
      >
        Cancelar sem registrar
      </button>

      {/* Modal finalizar */}
      {showFinish && (
        <div style={{
          position: 'fixed', inset: 0, background: '#000a',
          display: 'flex', alignItems: 'flex-end', zIndex: 200,
        }}>
          <div style={{
            background: '#1e293b', borderRadius: '20px 20px 0 0',
            padding: '24px 20px', width: '100%',
            paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
          }}>
            <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Finalizar corrida</h3>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
              {fmt.km(activeTrip?.km || 0)} percorridos • {fmt.currency(fuelCost)} em combustível
            </p>

            {/* Resumo de rota */}
            {activeTrip?.pickupLocation?.address && (
              <div style={{
                background: '#0f172a', borderRadius: 10, padding: '10px 12px', marginBottom: 16,
                border: '1px solid #334155',
              }}>
                <p style={{ fontSize: 11, color: '#22c55e', fontWeight: 700, marginBottom: 4 }}>
                  📍 {activeTrip.pickupLocation.address}
                </p>
                {activeTrip.destination?.address && (
                  <p style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>
                    🏁 {activeTrip.destination.address}
                  </p>
                )}
              </div>
            )}

            <SectionLabel>Valor recebido pela corrida</SectionLabel>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
              <span style={{ color: '#22c55e', fontSize: 20, fontWeight: 700 }}>R$</span>
              <input
                type='number'
                value={earningsInput}
                onChange={(e) => setEarningsInput(e.target.value)}
                placeholder='0,00'
                autoFocus
                style={{ ...inputStyle, margin: 0, flex: 1, fontSize: 22, fontWeight: 700, color: '#22c55e' }}
              />
            </div>

            {earningsInput && (
              <div style={{
                background: '#22c55e15', border: '1px solid #22c55e33',
                borderRadius: 10, padding: '10px 14px', marginBottom: 16,
              }}>
                <p style={{ fontSize: 13, color: '#94a3b8' }}>
                  Ganho líquido: <strong style={{ color: '#22c55e' }}>
                    {fmt.currency((parseFloat(earningsInput.replace(',', '.')) || 0) - fuelCost)}
                  </strong>
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowFinish(false)} style={{ flex: 1, padding: '14px', background: '#334155', border: 'none', borderRadius: 12, color: '#94a3b8', cursor: 'pointer', fontWeight: 600 }}>
                Voltar
              </button>
              <button onClick={handleFinish} style={{ flex: 2, padding: '14px', background: 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none', borderRadius: 12, color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}

function SectionLabel({ children }) {
  return <p style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{children}</p>
}

function RouteRow({ icon, label, value, detecting }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <div style={{ marginTop: 1 }}>{icon}</div>
      <div>
        <p style={{ fontSize: 10, color: '#64748b', fontWeight: 700 }}>{label}</p>
        <p style={{
          fontSize: 13, color: detecting ? '#64748b' : '#f1f5f9',
          fontStyle: detecting ? 'italic' : 'normal',
        }}>
          {detecting ? '⏳ Detectando via GPS...' : value}
        </p>
      </div>
    </div>
  )
}

function MetricBox({ icon, label, value, sub }) {
  return (
    <div style={{ background: '#1e293b', borderRadius: 12, padding: 12, border: '1px solid #334155' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
        {icon}
        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>{label}</span>
      </div>
      <p style={{ fontWeight: 800, fontSize: 20, color: '#f1f5f9' }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: '#64748b' }}>{sub}</p>}
    </div>
  )
}

function TimeBox({ label, ms, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 16, fontWeight: 800, color }}>{fmt.duration(ms)}</p>
      <p style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>{label}</p>
    </div>
  )
}

function ActionBtn({ color, onClick, icon, label, flex = 1 }) {
  return (
    <button onClick={onClick} style={{
      flex, padding: '13px',
      background: `${color}20`, border: `1px solid ${color}`,
      borderRadius: 12, color,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      cursor: 'pointer', fontWeight: 700, fontSize: 14,
    }}>
      {icon} {label}
    </button>
  )
}

const inputStyle = {
  width: '100%', background: '#0f172a', border: '1px solid #334155',
  borderRadius: 10, padding: '12px 14px', color: '#f1f5f9',
  fontSize: 15, outline: 'none', marginBottom: 14,
}
