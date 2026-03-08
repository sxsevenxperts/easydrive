// Parser para texto de notificação do Uber/99/inDrive em PT-BR
// Extrai origem e destino do texto copiado ou compartilhado

const PICKUP_PATTERNS = [
  /buscar\s+em[:\s]+([^\n\r]+)/i,
  /pegar\s+em[:\s]+([^\n\r]+)/i,
  /coleta\s+em[:\s]+([^\n\r]+)/i,
  /retirada\s+em[:\s]+([^\n\r]+)/i,
  /origem[:\s]+([^\n\r]+)/i,
  /ponto\s+de\s+partida[:\s]+([^\n\r]+)/i,
  /passageiro\s+em[:\s]+([^\n\r]+)/i,
  /pickup[:\s]+([^\n\r]+)/i,
  /embarque[:\s]+([^\n\r]+)/i,
]

const DEST_PATTERNS = [
  /destino[:\s]+([^\n\r]+)/i,
  /entregar\s+em[:\s]+([^\n\r]+)/i,
  /levar\s+para[:\s]+([^\n\r]+)/i,
  /entrega\s+em[:\s]+([^\n\r]+)/i,
  /dropar?\s+em[:\s]+([^\n\r]+)/i,
  /deixar\s+em[:\s]+([^\n\r]+)/i,
]

function clean(str) {
  return str?.trim().replace(/\s+/g, ' ').slice(0, 100) || null
}

export function parseRideText(text) {
  if (!text || text.length < 8) return null

  let pickup = null
  let dest = null

  for (const pattern of PICKUP_PATTERNS) {
    const m = text.match(pattern)
    if (m) { pickup = clean(m[1]); break }
  }

  for (const pattern of DEST_PATTERNS) {
    const m = text.match(pattern)
    if (m) { dest = clean(m[1]); break }
  }

  if (!pickup && !dest) return null
  return { pickup, dest }
}

// Lê parâmetros de URL (Web Share Target GET)
export function parseShareUrl() {
  try {
    const params = new URLSearchParams(window.location.search)
    const text = params.get('text') || params.get('title') || ''
    if (!text) return null
    return parseRideText(text)
  } catch { return null }
}
