import { useEffect, useRef } from 'react'

// Mapa de rota em tempo real usando Leaflet + OpenStreetMap (gratuito, sem API key)
export default function RouteMap({ route = [], currentLocation, pickupLocation, destination, height = 220 }) {
  const mapRef = useRef(null)
  const instanceRef = useRef(null)
  const polylineRef = useRef(null)
  const markerCurrentRef = useRef(null)
  const markerPickupRef = useRef(null)
  const markerDestRef = useRef(null)

  // Inicializa mapa uma única vez
  useEffect(() => {
    if (instanceRef.current || !mapRef.current) return

    // Importa Leaflet dinamicamente para evitar SSR issues
    import('leaflet').then((L) => {
      // CSS do Leaflet
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link')
        link.id = 'leaflet-css'
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(link)
      }

      const map = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map)

      // Ícone de posição atual (pulsante)
      const currentIcon = L.divIcon({
        html: `<div style="
          width:18px;height:18px;border-radius:50%;
          background:#3b82f6;border:3px solid #fff;
          box-shadow:0 0 0 4px #3b82f640;
        "></div>`,
        className: '',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      })

      const pickupIcon = L.divIcon({
        html: `<div style="
          width:14px;height:14px;border-radius:50%;
          background:#22c55e;border:2px solid #fff;
        "></div>`,
        className: '',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      })

      const destIcon = L.divIcon({
        html: `<div style="
          width:16px;height:16px;border-radius:3px;
          background:#ef4444;border:2px solid #fff;
          transform:rotate(45deg);
        "></div>`,
        className: '',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      })

      instanceRef.current = { map, L, currentIcon, pickupIcon, destIcon }

      // Posição inicial — Brasil como fallback
      const initLat = currentLocation?.lat ?? -15.77972
      const initLon = currentLocation?.lon ?? -47.92972
      map.setView([initLat, initLon], 15)
    })

    return () => {
      instanceRef.current?.map.remove()
      instanceRef.current = null
    }
  }, [])

  // Atualiza posição atual e rota conforme GPS atualiza
  useEffect(() => {
    if (!instanceRef.current || !currentLocation) return
    const { map, L, currentIcon } = instanceRef.current

    // Marcador de posição atual
    if (!markerCurrentRef.current) {
      markerCurrentRef.current = L.marker(
        [currentLocation.lat, currentLocation.lon],
        { icon: currentIcon, zIndexOffset: 1000 }
      ).addTo(map)
    } else {
      markerCurrentRef.current.setLatLng([currentLocation.lat, currentLocation.lon])
    }

    // Centraliza suavemente no motorista
    map.panTo([currentLocation.lat, currentLocation.lon], { animate: true, duration: 0.5 })
  }, [currentLocation])

  // Atualiza polyline da rota percorrida
  useEffect(() => {
    if (!instanceRef.current || route.length < 2) return
    const { map, L } = instanceRef.current

    const latlngs = route.map((p) => [p.lat, p.lon])

    if (!polylineRef.current) {
      polylineRef.current = L.polyline(latlngs, {
        color: '#3b82f6',
        weight: 4,
        opacity: 0.85,
        lineJoin: 'round',
      }).addTo(map)
    } else {
      polylineRef.current.setLatLngs(latlngs)
    }
  }, [route])

  // Marcador de origem (pickup)
  useEffect(() => {
    if (!instanceRef.current || !pickupLocation?.lat) return
    const { map, L, pickupIcon } = instanceRef.current

    if (!markerPickupRef.current) {
      markerPickupRef.current = L.marker([pickupLocation.lat, pickupLocation.lon], { icon: pickupIcon })
        .bindPopup('<b style="font-size:13px">📍 Origem</b>')
        .addTo(map)
    } else {
      markerPickupRef.current.setLatLng([pickupLocation.lat, pickupLocation.lon])
    }
  }, [pickupLocation?.lat, pickupLocation?.lon])

  // Marcador de destino
  useEffect(() => {
    if (!instanceRef.current || !destination?.lat) return
    const { map, L, destIcon } = instanceRef.current

    if (!markerDestRef.current) {
      markerDestRef.current = L.marker([destination.lat, destination.lon], { icon: destIcon })
        .bindPopup('<b style="font-size:13px">🏁 Destino</b>')
        .addTo(map)
    } else {
      markerDestRef.current.setLatLng([destination.lat, destination.lon])
    }

    // Se tem origem E destino, ajusta zoom para mostrar os dois
    if (markerPickupRef.current && instanceRef.current) {
      const { map: m, L: Leaflet } = instanceRef.current
      const bounds = Leaflet.latLngBounds(
        [pickupLocation?.lat ?? destination.lat, pickupLocation?.lon ?? destination.lon],
        [destination.lat, destination.lon]
      )
      m.fitBounds(bounds, { padding: [40, 40] })
    }
  }, [destination?.lat, destination?.lon])

  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #334155', position: 'relative' }}>
      <div ref={mapRef} style={{ height, width: '100%', background: '#1e293b' }} />
      {/* Legenda */}
      <div style={{
        position: 'absolute', bottom: 8, left: 8,
        background: '#0f172aee', borderRadius: 8, padding: '6px 10px',
        display: 'flex', gap: 10, zIndex: 1000,
      }}>
        <LegendItem color='#22c55e' label='Origem' />
        <LegendItem color='#3b82f6' label='Você' />
        <LegendItem color='#ef4444' label='Destino' />
      </div>
    </div>
  )
}

function LegendItem({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
      <span style={{ fontSize: 10, color: '#94a3b8' }}>{label}</span>
    </div>
  )
}
