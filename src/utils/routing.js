// ─── Roteamento via OSRM (gratuito, sem API key) ───────────────────────────
// OSRM usa coordenadas como lon,lat (longitude primeiro!)

/**
 * Analisa o nível de tráfego pelo horário atual (heurística Brasil)
 */
export function getTrafficInfo() {
  const h = new Date().getHours()
  const day = new Date().getDay() // 0=Dom, 6=Sáb
  const weekday = day >= 1 && day <= 5

  if (!weekday)
    return { factor: 1.0, level: 'leve',     label: 'Fim de semana',      color: '#22c55e', icon: '🟢' }
  if (h >= 6  && h < 9)
    return { factor: 1.65, level: 'pesado',   label: 'Pico manhã (6h–9h)', color: '#ef4444', icon: '🔴' }
  if (h >= 9  && h < 11)
    return { factor: 1.25, level: 'moderado', label: 'Moderado (9h–11h)',  color: '#f59e0b', icon: '🟡' }
  if (h >= 12 && h < 14)
    return { factor: 1.20, level: 'moderado', label: 'Pico almoço',        color: '#f59e0b', icon: '🟡' }
  if (h >= 14 && h < 17)
    return { factor: 1.00, level: 'leve',     label: 'Trânsito normal',    color: '#22c55e', icon: '🟢' }
  if (h >= 17 && h < 20)
    return { factor: 1.70, level: 'pesado',   label: 'Pico tarde (17h–20h)', color: '#ef4444', icon: '🔴' }
  if (h >= 20 && h < 22)
    return { factor: 1.20, level: 'moderado', label: 'Moderado (20h–22h)', color: '#f59e0b', icon: '🟡' }
  return   { factor: 0.85, level: 'leve',     label: 'Trânsito leve',      color: '#22c55e', icon: '🟢' }
}

/**
 * Traduz um step OSRM para instrução em PT-BR
 */
function buildStepInstruction(step) {
  const { type, modifier } = step.maneuver || {}
  const road = step.name && step.name.trim() ? step.name.trim() : ''
  const in_road = road ? ` em ${road}` : ''

  const map = {
    depart:     () => `🚀 Parta${in_road}`,
    arrive:     () => `🏁 Chegou ao destino${road ? ` (${road})` : ''}`,
    'new name': () => `⬆ Continue${in_road}`,
    merge:      () => `↗ Mescle${modifier === 'left' ? ' à esquerda' : ' à direita'}${in_road}`,
    'on ramp':  () => `↗ Entre na rampa${in_road}`,
    'off ramp': () => `↘ Saia pela rampa${in_road}`,
    fork:       () => `Na bifurcação, siga ${modifier === 'left' ? 'à esquerda' : 'à direita'}${in_road}`,
    roundabout: () => `⟳ Entre na rotatória${in_road}`,
    rotary:     () => `⟳ Entre na rotatória${in_road}`,
    turn:       () => {
      const dir = {
        left:         '↰ Vire à esquerda',
        right:        '↱ Vire à direita',
        'sharp left': '↰ Vire acentuado à esquerda',
        'sharp right':'↱ Vire acentuado à direita',
        'slight left':'↖ Continue levemente à esquerda',
        'slight right':'↗ Continue levemente à direita',
        straight:     '⬆ Siga em frente',
        uturn:        '↩ Faça o retorno',
      }
      return `${dir[modifier] || `Vire (${modifier})`}${in_road}`
    },
    'end of road': () => `No fim da via, vire ${modifier === 'left' ? 'à esquerda' : 'à direita'}${in_road}`,
  }
  return (map[type] ?? (() => `⬆ Continue${in_road}`))()
}

/**
 * Formata distância em metros → "150 m" ou "1,2 km"
 */
export function fmtDist(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`
}

/**
 * Busca até 3 rotas alternativas via OSRM com passos turn-by-turn
 * @returns {Array|null} Array de rotas ou null se falhar
 */
export async function fetchRoutes(originLat, originLon, destLat, destLon) {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${originLon},${originLat};${destLon},${destLat}` +
    `?overview=full&geometries=geojson&alternatives=true&steps=true`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)

  try {
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return null
    const data = await res.json()
    if (data.code !== 'Ok' || !data.routes?.length) return null

    // OSRM retorna [lon, lat] → converter para [lat, lon] (Leaflet)
    return data.routes.map((r) => ({
      points:      r.geometry.coordinates.map(([lng, lt]) => [lt, lng]),
      distanceKm:  parseFloat((r.distance / 1000).toFixed(2)),
      durationMin: Math.round(r.duration / 60),
      // Passos turn-by-turn
      steps: (r.legs || []).flatMap((leg) =>
        (leg.steps || []).map((s) => ({
          instruction: buildStepInstruction(s),
          distanceM:   Math.round(s.distance),
          durationSec: Math.round(s.duration),
          type:        s.maneuver?.type,
        }))
      ),
    }))
  } catch {
    clearTimeout(timer)
    return null
  }
}

/**
 * Classifica rotas por pontuação combinada:
 * tempo (40%) + custo combustível (35%) + segurança (25%)
 * Em áreas perigosas (score < 50), segurança sobe para 40%
 * Retorna rotas ordenadas da melhor para a pior.
 */
export function rankRoutes(routes, fuelPrice, fuelConsumption, safetyScore = 60) {
  if (!routes?.length) return []

  const traffic = getTrafficInfo()
  const maxDist = Math.max(...routes.map((r) => r.distanceKm))
  const maxTime = Math.max(...routes.map((r) => r.durationMin))

  // Em áreas perigosas, aumenta peso da segurança
  const isDangerous = safetyScore < 50
  const weights = isDangerous
    ? { time: 0.35, cost: 0.25, safety: 0.40 }  // Prioriza segurança
    : { time: 0.40, cost: 0.35, safety: 0.25 }  // Balanço normal

  const scored = routes.map((r) => {
    const litros   = fuelConsumption > 0 ? r.distanceKm / fuelConsumption : r.distanceKm * 0.04
    const fuelCost = parseFloat((litros * (fuelPrice || 6.0)).toFixed(2))
    const adjMin   = Math.round(r.durationMin * traffic.factor)

    // Scores normalizados (0–100, maior = melhor)
    const timeScore = maxTime > 0 ? 100 - (r.durationMin / maxTime) * 100 : 100
    const costScore = maxDist > 0 ? 100 - (r.distanceKm  / maxDist) * 100 : 100
    const safeScore = Math.max(0, Math.min(100, safetyScore))

    return {
      ...r,
      fuelCost,
      adjMin,
      traffic,
      isDangerous,
      score: Math.round(timeScore * weights.time + costScore * weights.cost + safeScore * weights.safety),
      isRecommended: false,
    }
  })

  scored.sort((a, b) => b.score - a.score)

  const labels = ['✨ Recomendada', 'Alternativa A', 'Alternativa B']
  scored.forEach((r, i) => {
    r.label        = isDangerous && i === 0 ? '🛡️ Mais Segura' : labels[i] ?? `Rota ${i + 1}`
    r.isRecommended = i === 0
  })

  return scored
}
