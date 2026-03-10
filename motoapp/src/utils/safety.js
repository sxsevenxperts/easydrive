// Análise de segurança por localização

// Fator de risco por horário
export function getTimeFactor() {
  const hour = new Date().getHours()
  if (hour >= 6 && hour < 12) return { factor: 0.9, label: 'Manhã' }
  if (hour >= 12 && hour < 18) return { factor: 0.85, label: 'Tarde' }
  if (hour >= 18 && hour < 21) return { factor: 0.7, label: 'Entardecer' }
  if (hour >= 21 && hour < 24) return { factor: 0.5, label: 'Noite' }
  return { factor: 0.35, label: 'Madrugada' } // 0h-6h é mais arriscado
}

// Busca dados de localização na API do OpenStreetMap (Nominatim)
export async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1`,
      { headers: { 'Accept-Language': 'pt-BR' } }
    )
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// Busca POIs próximos via Overpass API (OpenStreetMap)
export async function getNearbyPOIs(lat, lon, radiusM = 500) {
  const query = `
    [out:json][timeout:10];
    (
      node["amenity"~"police|hospital|fire_station|school|church|bank|atm"](around:${radiusM},${lat},${lon});
      node["shop"~"supermarket|convenience"](around:${radiusM},${lat},${lon});
      node["amenity"~"bar|nightclub|pub"](around:${radiusM/2},${lat},${lon});
      node["landuse"~"industrial|commercial"](around:${radiusM},${lat},${lon});
    );
    out body;
  `
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.elements || []
  } catch {
    return []
  }
}

// Calcula score de segurança (0-100, maior = mais seguro)
export function calcSafetyScore(pois, geocode, timeFactor) {
  let score = 60 // base

  // Fatores positivos (infra pública)
  const positives = pois.filter((p) =>
    ['police', 'hospital', 'fire_station', 'school', 'church', 'bank', 'supermarket', 'atm'].includes(
      p.tags?.amenity || p.tags?.shop
    )
  )
  score += Math.min(positives.length * 3, 20)

  // Fatores negativos (bares e boates)
  const negatives = pois.filter((p) =>
    ['bar', 'nightclub', 'pub'].includes(p.tags?.amenity)
  )
  score -= negatives.length * 4

  // Fator de horário
  score = score * timeFactor.factor + score * (1 - timeFactor.factor) * 0.3

  // Tipo de área
  const road = geocode?.address?.road || ''
  const suburb = geocode?.address?.suburb || geocode?.address?.neighbourhood || ''
  const city = geocode?.address?.city || geocode?.address?.town || ''

  // Normaliza
  score = Math.max(5, Math.min(100, Math.round(score)))

  // Classificação
  let level, color, emoji
  if (score >= 75) { level = 'Seguro'; color = '#22c55e'; emoji = '✅' }
  else if (score >= 55) { level = 'Atenção'; color = '#f59e0b'; emoji = '⚠️' }
  else if (score >= 35) { level = 'Risco'; color = '#f97316'; emoji = '🔶' }
  else { level = 'Perigo'; color = '#ef4444'; emoji = '🚨' }

  return {
    score,
    level,
    color,
    emoji,
    timeFactor: timeFactor.label,
    positiveFactors: positives.length,
    negativeFactors: negatives.length,
    suburb,
    city,
    address: geocode?.display_name || '',
  }
}

// Analisa segurança de uma localização
export async function analyzeSafety(lat, lon) {
  const [geocode, pois] = await Promise.all([
    reverseGeocode(lat, lon),
    getNearbyPOIs(lat, lon),
  ])
  const timeFactor = getTimeFactor()
  return calcSafetyScore(pois, geocode, timeFactor)
}

// Calcula distância entre dois pontos (fórmula de Haversine) em km
export function calcDistance(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Calcula velocidade em km/h entre dois pontos
export function calcSpeed(p1, p2) {
  if (!p1 || !p2) return 0
  const distKm = calcDistance(p1.lat, p1.lon, p2.lat, p2.lon)
  const timeSec = (p2.ts - p1.ts) / 1000
  if (timeSec <= 0) return 0
  return (distKm / timeSec) * 3600
}
