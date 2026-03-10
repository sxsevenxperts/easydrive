// EasyDrive — Parser de Texto de Corrida/Entrega
// Suporta notificações PT-BR de todos os apps de transporte e delivery

// ── PLATAFORMAS SUPORTADAS ───────────────────────────────────────
const PLATFORM_PATTERNS = [
  // Transporte de passageiros
  { id: 'uber',      label: 'Uber',          type: 'ride',     patterns: [/\buber\b(?!\s*eats)/i] },
  { id: '99',        label: '99',            type: 'ride',     patterns: [/\b99\s*(?:taxi|pop|moto|driver)?\b/i, /noventa\s*e\s*nove/i] },
  { id: 'inDriver',  label: 'inDrive',       type: 'ride',     patterns: [/in\s*drive/i, /\bindriver\b/i] },
  { id: 'cabify',    label: 'Cabify',        type: 'ride',     patterns: [/\bcabify\b/i] },
  { id: 'blablacar', label: 'BlaBlaCar',     type: 'ride',     patterns: [/blablacar/i, /bla\s*bla\s*car/i] },

  // Delivery de comida
  { id: 'uberEats',  label: 'Uber Eats',     type: 'food',     patterns: [/uber\s*eats/i] },
  { id: 'ifood',     label: 'iFood',         type: 'food',     patterns: [/\bifood\b/i, /i\s*food/i] },
  { id: 'rappi',     label: 'Rappi',         type: 'food',     patterns: [/\brappi\b/i] },
  { id: '99food',    label: '99Food',        type: 'food',     patterns: [/\b99\s*food\b/i] },
  { id: 'aiqfome',   label: 'Aiqfome',       type: 'food',     patterns: [/aiqfome/i, /aiq\s*fome/i] },
  { id: 'goomer',    label: 'Goomer',        type: 'food',     patterns: [/\bgoomer\b/i] },

  // Delivery de pacotes / logística
  { id: 'lalamove',  label: 'Lalamove',      type: 'delivery', patterns: [/lalamove/i, /lala\s*move/i] },
  { id: 'loggi',     label: 'Loggi',         type: 'delivery', patterns: [/\bloggi\b/i] },
  { id: 'shopee',    label: 'Shopee Express', type: 'delivery', patterns: [/shopee/i, /shopee\s*express/i] },
  { id: 'amazon',    label: 'Amazon Flex',   type: 'delivery', patterns: [/amazon\s*(?:flex|entrega|prime)?/i, /\bflex\b.*\bamazon\b/i] },
  { id: 'meli',      label: 'Mercado Envios', type: 'delivery', patterns: [/mercado\s*(?:livre|envios|pago)/i, /\bmeli\b/i, /\bmelhor\s*envio/i] },
  { id: 'shein',     label: 'Shein',         type: 'delivery', patterns: [/\bshein\b/i] },
  { id: 'magalu',    label: 'Magalu',        type: 'delivery', patterns: [/\bmagalu\b/i, /magazine\s*luiza/i] },
  { id: 'jadlog',    label: 'Jadlog',        type: 'delivery', patterns: [/\bjadlog\b/i] },
  { id: 'correios',  label: 'Correios',      type: 'delivery', patterns: [/\bcorreios\b/i, /\bpac\b|\bsedex\b/i] },
  { id: 'totalexp',  label: 'Total Express', type: 'delivery', patterns: [/total\s*express/i] },
  { id: 'buslog',    label: 'Buslog',        type: 'delivery', patterns: [/\bbuslog\b/i] },
]

// ── PADRÕES DE COLETA / ORIGEM ──────────────────────────────────
const PICKUP_PATTERNS = [
  // Transporte de passageiros
  /buscar\s+em[:\s]+([^\n\r]+)/i,
  /pegar\s+em[:\s]+([^\n\r]+)/i,
  /passageiro\s+em[:\s]+([^\n\r]+)/i,
  /passageiro[:\s]+([^\n\r]+)/i,
  /embarque[:\s]+([^\n\r]+)/i,
  /pick\s*up[:\s]+([^\n\r]+)/i,
  /ponto\s+de\s+partida[:\s]+([^\n\r]+)/i,
  /ponto\s+de\s+embarque[:\s]+([^\n\r]+)/i,
  /origem[:\s]+([^\n\r]+)/i,
  /de[:\s]+([^\n\r]+?)(?:\npara|\ndestino)/i,

  // Delivery / Entrega
  /retirar\s+(?:em|no|na)[:\s]+([^\n\r]+)/i,
  /coleta\s+(?:em|no|na)[:\s]+([^\n\r]+)/i,
  /coletar\s+(?:em|no|na)[:\s]+([^\n\r]+)/i,
  /restaurante[:\s]+([^\n\r]+)/i,
  /loja[:\s]+([^\n\r]+)/i,
  /estabelecimento[:\s]+([^\n\r]+)/i,
  /pegar\s+pedido\s+(?:em|no|na)[:\s]+([^\n\r]+)/i,
  /retirada[:\s]+([^\n\r]+)/i,
  /local\s+de\s+coleta[:\s]+([^\n\r]+)/i,
  /endere[çc]o\s+de\s+coleta[:\s]+([^\n\r]+)/i,
  /remetente[:\s]+([^\n\r]+)/i,
  /origem\s+do\s+pedido[:\s]+([^\n\r]+)/i,
  /ponto\s+de\s+coleta[:\s]+([^\n\r]+)/i,
  /buscar\s+(?:no|na|o\s+pedido)[:\s]*([^\n\r]+)/i,
]

// ── PADRÕES DE DESTINO / ENTREGA ────────────────────────────────
const DEST_PATTERNS = [
  // Transporte
  /destino[:\s]+([^\n\r]+)/i,
  /levar\s+para[:\s]+([^\n\r]+)/i,
  /deixar\s+em[:\s]+([^\n\r]+)/i,
  /drop\s*(?:off)?[:\s]+([^\n\r]+)/i,
  /desembarque[:\s]+([^\n\r]+)/i,
  /para[:\s]+([^\n\r]+?)(?:\n|$)/i,

  // Delivery
  /entregar\s+(?:em|no|na|para)[:\s]+([^\n\r]+)/i,
  /entrega\s+(?:em|no|na)[:\s]+([^\n\r]+)/i,
  /endere[çc]o\s+de\s+entrega[:\s]+([^\n\r]+)/i,
  /local\s+de\s+entrega[:\s]+([^\n\r]+)/i,
  /levar\s+at[ée][:\s]+([^\n\r]+)/i,
  /cliente\s+(?:em|no|na|rua|av)[:\s]+([^\n\r]+)/i,
  /delivery\s+(?:em|para|address)[:\s]+([^\n\r]+)/i,
  /destinat[aá]rio[:\s]+([^\n\r]+)/i,
  /ponto\s+de\s+entrega[:\s]+([^\n\r]+)/i,
  /endere[çc]o[:\s]+(?:do\s+cliente|de\s+entrega)[:\s]+([^\n\r]+)/i,
]

// ── PADRÕES DE VALOR ────────────────────────────────────────────
const VALUE_PATTERNS = [
  /(?:valor|ganho|receba|ganhe|faturamento|pagamento|corrida|viagem)[:\s]*R?\$?\s*(\d+[.,]?\d*)/i,
  /R\$\s*(\d+[.,]\d{2})/,
  /(\d+[.,]\d{2})\s*reais/i,
  /voc[eê]\s+(?:vai\s+)?(?:receber|ganhar)[:\s]*R?\$?\s*(\d+[.,]?\d*)/i,
]

// ── PADRÕES DE DISTÂNCIA ─────────────────────────────────────────
const DISTANCE_PATTERNS = [
  /(\d+[.,]?\d*)\s*km/i,
  /dist[aâ]ncia[:\s]+(\d+[.,]?\d*)/i,
]

// ── HELPERS ──────────────────────────────────────────────────────
function clean(str) {
  return str?.trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s\-.,°ºªáéíóúàèìòùâêîôûãõç]/gi, '')
    .slice(0, 150) || null
}

export function detectPlatform(text) {
  for (const { id, patterns } of PLATFORM_PATTERNS) {
    for (const p of patterns) {
      if (p.test(text)) return id
    }
  }
  return null
}

export function getPlatformInfo(id) {
  return PLATFORM_PATTERNS.find(p => p.id === id) || null
}

export function getAllPlatforms() {
  return PLATFORM_PATTERNS.map(({ id, label, type }) => ({ id, label, type }))
}

function extractValue(text) {
  for (const pattern of VALUE_PATTERNS) {
    const m = text.match(pattern)
    if (m) {
      const raw = m[1].replace(',', '.')
      const val = parseFloat(raw)
      if (!isNaN(val) && val > 0 && val < 10000) return val
    }
  }
  return null
}

function extractDistance(text) {
  for (const pattern of DISTANCE_PATTERNS) {
    const m = text.match(pattern)
    if (m) {
      const val = parseFloat(m[1].replace(',', '.'))
      if (!isNaN(val) && val > 0 && val < 1000) return val
    }
  }
  return null
}

// ── PARSER PRINCIPAL ─────────────────────────────────────────────
export function parseRideText(text) {
  if (!text || text.length < 6) return null

  let pickup = null
  let dest = null

  for (const pattern of PICKUP_PATTERNS) {
    const m = text.match(pattern)
    if (m?.[1]) { pickup = clean(m[1]); break }
  }

  for (const pattern of DEST_PATTERNS) {
    const m = text.match(pattern)
    if (m?.[1]) { dest = clean(m[1]); break }
  }

  // Retorna nulo se não encontrou nada útil
  if (!pickup && !dest) return null

  const platform = detectPlatform(text)
  const value = extractValue(text)
  const km = extractDistance(text)

  return { pickup, dest, platform, value, km }
}

// ── SHARE TARGET (GET via URL) ───────────────────────────────────
export function parseShareUrl() {
  try {
    const params = new URLSearchParams(window.location.search)
    const text = [
      params.get('text'),
      params.get('title'),
      params.get('url'),
    ].filter(Boolean).join(' ')
    if (!text) return null
    return parseRideText(text)
  } catch { return null }
}

// ── LISTA DE PLATAFORMAS PARA UI ─────────────────────────────────
// Mantida para compatibilidade com ActiveTrip.jsx
export const PLATFORM_LIST = [
  { id: 'uber',      label: 'Uber',          emoji: '🚗', type: 'ride' },
  { id: '99',        label: '99',            emoji: '🚕', type: 'ride' },
  { id: 'inDriver',  label: 'inDrive',       emoji: '🚙', type: 'ride' },
  { id: 'cabify',    label: 'Cabify',        emoji: '🚖', type: 'ride' },
  { id: 'ifood',     label: 'iFood',         emoji: '🍔', type: 'food' },
  { id: 'rappi',     label: 'Rappi',         emoji: '🛵', type: 'food' },
  { id: 'uberEats',  label: 'Uber Eats',     emoji: '🍕', type: 'food' },
  { id: '99food',    label: '99Food',        emoji: '🥡', type: 'food' },
  { id: 'aiqfome',   label: 'Aiqfome',       emoji: '🍽️', type: 'food' },
  { id: 'lalamove',  label: 'Lalamove',      emoji: '📦', type: 'delivery' },
  { id: 'loggi',     label: 'Loggi',         emoji: '🏃', type: 'delivery' },
  { id: 'shopee',    label: 'Shopee Express', emoji: '🛍️', type: 'delivery' },
  { id: 'amazon',    label: 'Amazon Flex',   emoji: '📬', type: 'delivery' },
  { id: 'meli',      label: 'Mercado Envios', emoji: '🟡', type: 'delivery' },
]
