import { useEffect, useRef, useState } from 'react'
import { Crosshair, Navigation } from 'lucide-react'

// ─── Integração com Waze (melhor que mapa customizado) ──────────────────
// Waze: navegação em tempo real, trânsito, roteamento inteligente
// Suporta: deep links, URL share, navegação nativa

export default function RouteMap({
  route          = [],
  currentLocation,
  pickupLocation,
  destination,
  plannedRoutes  = [],
  height         = 240,
  navigating     = false,
}) {
  const mapRef = useRef(null)
  const [wazeUrl, setWazeUrl] = useState('')

  // ── Gera link Waze ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!destination?.lat || !destination?.lon) return

    // Deep link Waze: waze://navigate?to=lat,lon
    const wazeDeepLink = `waze://navigate?to=${destination.lat},${destination.lon}`

    // URL fallback para web (abre mapa Waze web)
    const wazeWebUrl = `https://waze.com/ul?ll=${destination.lat},${destination.lon}&navigate=yes`

    setWazeUrl(wazeDeepLink)

    // Fallback se Waze app não está instalado
    const openWaze = () => {
      window.location.href = wazeDeepLink
      // Após 1 segundo, se app não abriu, abre web
      setTimeout(() => {
        window.open(wazeWebUrl, '_blank')
      }, 1000)
    }

    // Se navegating, abre Waze automaticamente
    if (navigating && destination?.lat) {
      openWaze()
    }
  }, [destination?.lat, destination?.lon, navigating])

  return (
    <div
      ref={mapRef}
      style={{
        position: 'relative',
        width: '100%',
        height,
        borderRadius: 12,
        overflow: 'hidden',
        background: '#1a1a2e',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Preview com informações de rota */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          zIndex: 1,
        }}
      >
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <Navigation size={48} style={{ marginBottom: 12, opacity: 0.7 }} />

          {destination ? (
            <>
              <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>
                📍 Navegando para:
              </p>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 16px', maxWidth: 200 }}>
                {destination.address || `${destination.lat.toFixed(4)}, ${destination.lon.toFixed(4)}`}
              </p>

              {/* Distância e tempo estimado */}
              {plannedRoutes?.[0] && (
                <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 16 }}>
                  <div>
                    <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>Distância</p>
                    <p style={{ fontSize: 16, fontWeight: 700, color: '#3b82f6', margin: '4px 0 0' }}>
                      {plannedRoutes[0].distanceKm} km
                    </p>
                  </div>
                  <div style={{ width: 1, background: '#334155' }} />
                  <div>
                    <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>Tempo</p>
                    <p style={{ fontSize: 16, fontWeight: 700, color: '#10b981', margin: '4px 0 0' }}>
                      {plannedRoutes[0].durationMin} min
                    </p>
                  </div>
                </div>
              )}

              {/* Botão Abrir Waze */}
              <button
                onClick={() => {
                  const wazeDeepLink = `waze://navigate?to=${destination.lat},${destination.lon}`
                  const wazeWeb = `https://waze.com/ul?ll=${destination.lat},${destination.lon}&navigate=yes`
                  window.location.href = wazeDeepLink
                  setTimeout(() => window.open(wazeWeb, '_blank'), 1000)
                }}
                style={{
                  padding: '12px 20px',
                  background: '#00bcd4',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 14,
                }}
              >
                🗺️ Abrir em Waze
              </button>
            </>
          ) : (
            <>
              <p style={{ fontSize: 14, color: '#94a3b8' }}>
                Selecione um destino para começar
              </p>
              <p style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
                O mapa será exibido quando você definir o destino
              </p>
            </>
          )}
        </div>

        {/* Indicador de localização atual */}
        {currentLocation?.lat && (
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              right: 12,
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: '#3b82f6',
              border: '3px solid #fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 0 5px #3b82f655',
              animation: 'pulse 2s infinite',
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#fff',
              }}
            />
          </div>
        )}
      </div>

      {/* Rota planejada (resumo visual) */}
      {plannedRoutes?.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(10px)',
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 12,
            color: '#fff',
            zIndex: 10,
          }}
        >
          <p style={{ margin: 0, fontWeight: 700, color: '#3b82f6' }}>
            ✨ {plannedRoutes[0].label}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94a3b8' }}>
            {plannedRoutes[0].traffic.label}
          </p>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 5px #3b82f655; }
          50% { box-shadow: 0 0 0 10px #3b82f630; }
        }
      `}</style>
    </div>
  )
}
