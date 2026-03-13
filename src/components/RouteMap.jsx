import { useEffect, useRef, useState } from 'react'
import { Crosshair } from 'lucide-react'

// ─── Mapa de rota em tempo real ─────────────────────────────────────────────
// Leaflet + OpenStreetMap (gratuito, sem API key)
// Suporta: GPS em tempo real, rota planejada OSRM, alternativas, legenda

export default function RouteMap({
  route          = [],   // trilha GPS percorrida [{lat, lon}]
  currentLocation,       // posição atual do motorista
  pickupLocation,        // origem
  destination,           // destino
  plannedRoutes  = [],   // rotas OSRM rankeadas [{points, isRecommended, ...}]
  height         = 240,
}) {
  const mapRef             = useRef(null)
  const instanceRef        = useRef(null)
  const trailRef           = useRef(null)       // trilha GPS percorrida
  const routePolylinesRef  = useRef([])         // polilinhas das rotas planejadas
  const markerCurrentRef   = useRef(null)
  const markerPickupRef    = useRef(null)
  const markerDestRef      = useRef(null)
  const currentLocationRef = useRef(currentLocation)
  const [following, setFollowing] = useState(true)
  const [mapReady, setMapReady]   = useState(false)  // sinaliza que Leaflet carregou

  // Ref sempre atualizado (evita stale closure no init async)
  useEffect(() => { currentLocationRef.current = currentLocation }, [currentLocation])

  // ── Init: carrega Leaflet uma única vez ─────────────────────────────────
  useEffect(() => {
    if (instanceRef.current || !mapRef.current) return

    import('leaflet').then((L) => {
      if (!mapRef.current) return

      // CSS do Leaflet (injeção única)
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link')
        link.id   = 'leaflet-css'
        link.rel  = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(link)
      }

      const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false })

      // Tiles OpenStreetMap
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)

      // Ícones
      const makeIcon = (color, size, rotate = false) =>
        L.divIcon({
          html: `<div style="
            width:${size}px;height:${size}px;
            border-radius:${rotate ? '3px' : '50%'};
            background:${color};border:2px solid #fff;
            box-shadow:0 2px 8px ${color}88;
            transform:${rotate ? 'rotate(45deg)' : 'none'};
          "></div>`,
          className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2],
        })

      const currentIcon = L.divIcon({
        html: `<div style="
          width:20px;height:20px;border-radius:50%;
          background:#3b82f6;border:3px solid #fff;
          box-shadow:0 0 0 5px #3b82f655;
        "></div>`,
        className: '', iconSize: [20, 20], iconAnchor: [10, 10],
      })

      instanceRef.current = {
        map, L,
        currentIcon,
        pickupIcon: makeIcon('#22c55e', 14),
        destIcon:   makeIcon('#ef4444', 16, true),
      }

      setMapReady(true)   // dispara os effects que dependem do mapa

      // Posição inicial via ref (já pode ter GPS)
      const loc = currentLocationRef.current
      if (loc?.lat) {
        map.setView([loc.lat, loc.lon], 15)
        markerCurrentRef.current = L.marker(
          [loc.lat, loc.lon],
          { icon: currentIcon, zIndexOffset: 1000 }
        ).addTo(map)
      } else {
        navigator.geolocation?.getCurrentPosition(
          ({ coords }) => {
            if (!instanceRef.current) return
            map.setView([coords.latitude, coords.longitude], 15)
          },
          () => map.setView([-14.235, -51.925], 5),
          { enableHighAccuracy: false, timeout: 5_000, maximumAge: 60_000 }
        )
      }

      // Quando usuário arrasta o mapa → desativa "seguir GPS"
      map.on('dragstart', () => setFollowing(false))
    })

    return () => {
      instanceRef.current?.map.remove()
      instanceRef.current = null
    }
  }, [])

  // ── Atualiza posição atual ──────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !instanceRef.current || !currentLocation) return
    const { map, L, currentIcon } = instanceRef.current

    if (!markerCurrentRef.current) {
      markerCurrentRef.current = L.marker(
        [currentLocation.lat, currentLocation.lon],
        { icon: currentIcon, zIndexOffset: 1000 }
      ).addTo(map)
    } else {
      markerCurrentRef.current.setLatLng([currentLocation.lat, currentLocation.lon])
    }

    if (following) {
      map.panTo([currentLocation.lat, currentLocation.lon], { animate: true, duration: 0.6 })
    }
  }, [currentLocation, following, mapReady])

  // ── Trilha GPS percorrida ───────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !instanceRef.current || route.length < 2) return
    const { map, L } = instanceRef.current
    const latlngs = route.map((p) => [p.lat, p.lon])

    if (!trailRef.current) {
      trailRef.current = L.polyline(latlngs, {
        color: '#22c55e', weight: 3, opacity: 0.7,
        dashArray: '6, 4', lineJoin: 'round',
      }).addTo(map)
    } else {
      trailRef.current.setLatLngs(latlngs)
    }
  }, [route, mapReady])

  // ── Rotas planejadas (OSRM) ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !instanceRef.current) return
    const { map, L } = instanceRef.current

    // Limpa polilinhas antigas
    routePolylinesRef.current.forEach((pl) => pl.remove())
    routePolylinesRef.current = []

    if (!plannedRoutes?.length) return

    // Alternativas primeiro (ficam embaixo), recomendada por último (fica em cima)
    const sorted = [...plannedRoutes].reverse()

    sorted.forEach((route) => {
      const isRec = route.isRecommended
      const pl = L.polyline(route.points, {
        color:     isRec ? '#3b82f6' : '#94a3b8',
        weight:    isRec ? 5 : 3,
        opacity:   isRec ? 0.90 : 0.45,
        dashArray: isRec ? null : '10, 8',
        lineJoin:  'round',
      }).addTo(map)
      routePolylinesRef.current.push(pl)
    })

    // Ajusta zoom para mostrar a rota recomendada completa
    const rec = plannedRoutes.find((r) => r.isRecommended) ?? plannedRoutes[0]
    if (rec?.points?.length) {
      try {
        map.fitBounds(rec.points, { padding: [40, 40], maxZoom: 16 })
      } catch {}
    }
  }, [plannedRoutes, mapReady])

  // ── Marcador de origem ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !instanceRef.current || !pickupLocation?.lat) return
    const { map, L, pickupIcon } = instanceRef.current

    if (!markerPickupRef.current) {
      markerPickupRef.current = L.marker(
        [pickupLocation.lat, pickupLocation.lon],
        { icon: pickupIcon }
      ).bindPopup('<b style="font-size:13px">📍 Origem</b>').addTo(map)
    } else {
      markerPickupRef.current.setLatLng([pickupLocation.lat, pickupLocation.lon])
    }
  }, [pickupLocation?.lat, pickupLocation?.lon, mapReady])

  // ── Marcador de destino ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !instanceRef.current || !destination?.lat) return
    const { map, L, destIcon } = instanceRef.current

    if (!markerDestRef.current) {
      markerDestRef.current = L.marker(
        [destination.lat, destination.lon],
        { icon: destIcon }
      ).bindPopup('<b style="font-size:13px">🏁 Destino</b>').addTo(map)
    } else {
      markerDestRef.current.setLatLng([destination.lat, destination.lon])
    }

    // Sem rota OSRM ainda: ajusta zoom para mostrar origem + destino
    if (!plannedRoutes?.length && markerPickupRef.current && instanceRef.current) {
      const { map: m, L: Lx } = instanceRef.current
      try {
        const bounds = Lx.latLngBounds(
          [pickupLocation?.lat ?? destination.lat, pickupLocation?.lon ?? destination.lon],
          [destination.lat, destination.lon]
        )
        m.fitBounds(bounds, { padding: [40, 40] })
      } catch {}
    }
  }, [destination?.lat, destination?.lon, mapReady])

  // ── Botão "Localizar" ──────────────────────────────────────────────────
  const handleLocate = () => {
    if (!instanceRef.current || !currentLocation) return
    instanceRef.current.map.setView(
      [currentLocation.lat, currentLocation.lon], 16,
      { animate: true, duration: 0.8 }
    )
    setFollowing(true)
  }

  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)', position: 'relative', boxShadow: '0 4px 24px #0008' }}>
      <div ref={mapRef} style={{ height, width: '100%', background: 'var(--bg3)' }} />

      {/* Botão localizar */}
      <button
        onClick={handleLocate}
        title='Centralizar na minha posição'
        style={{
          position: 'absolute', top: 10, right: 10, zIndex: 1000,
          width: 36, height: 36, borderRadius: 10,
          background: following ? '#3b82f6' : 'var(--bg2,#1e293b)',
          border: `1px solid ${following ? '#3b82f6' : 'var(--border,#334155)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: '0 2px 8px #0004',
          transition: 'all 0.2s',
        }}
      >
        <Crosshair size={16} color={following ? '#fff' : '#94a3b8'} />
      </button>

      {/* Legenda */}
      <div style={{
        position: 'absolute', bottom: 10, left: 10, zIndex: 1000,
        background: '#0f172aee', borderRadius: 10, padding: '6px 12px',
        display: 'flex', gap: 12, backdropFilter: 'blur(4px)',
        border: '1px solid #ffffff10',
      }}>
        <LegendDot color='#22c55e' label='Origem' />
        <LegendDot color='#3b82f6' label={following ? 'Você ●' : 'Você'} />
        {destination && <LegendDot color='#ef4444' label='Destino' />}
        {plannedRoutes?.length > 0 && <LegendDot color='#3b82f6' label='Rota' line />}
      </div>
    </div>
  )
}

function LegendDot({ color, label, line }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      {line
        ? <div style={{ width: 16, height: 3, background: color, borderRadius: 2 }} />
        : <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
      }
      <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>{label}</span>
    </div>
  )
}
