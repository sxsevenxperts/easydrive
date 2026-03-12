// EasyDrive — HUD Flutuante via Document Picture-in-Picture API
// Mostra métricas do dia em janela que fica sobre todos os outros apps

import { useRef, useCallback, useEffect } from 'react'

const PIP_WIDTH = 300
const PIP_HEIGHT = 180
const REFRESH_INTERVAL = 4000 // 4 segundos

function buildPiPHTML(data) {
  const {
    earnings = 0, net = 0, km = 0, trips = 0,
    streak = 0, goalRevPct = null, goalProfPct = null,
    platform = '', tripActive = false,
  } = data

  const fmt = (v) => `R$ ${v.toFixed(2).replace('.', ',')}`
  const fmtKm = (v) => `${v.toFixed(1).replace('.', ',')} km`

  const netColor = net >= 0 ? '#22c55e' : '#ef4444'
  const statusDot = tripActive
    ? `<span style="width:8px;height:8px;background:#22c55e;border-radius:50%;display:inline-block;animation:pulse 1.5s infinite;margin-right:4px"></span>`
    : ''

  const buildBar = (pct, color) => {
    if (pct === null) return ''
    const p = Math.min(pct, 100)
    return `
      <div style="margin-top:4px;">
        <div style="width:100%;height:5px;background:#1e293b;border-radius:3px;overflow:hidden;">
          <div style="width:${p}%;height:100%;background:${color};border-radius:3px;transition:width 0.5s;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:2px;">
          <span style="font-size:9px;color:#475569">${p >= 100 ? '✅ Meta!' : `Meta: ${Math.round(p)}%`}</span>
          <span style="font-size:9px;color:#475569">${color === '#22c55e' ? 'Faturamento' : 'Lucro'}</span>
        </div>
      </div>`
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width">
      <style>
        * { box-sizing:border-box; margin:0; padding:0; }
        body {
          background: #0f172a;
          color: #f1f5f9;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          padding: 12px;
          height: 100vh;
          overflow: hidden;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          border-bottom: 1px solid #1e293b;
          padding-bottom: 8px;
        }
        .brand {
          font-size: 11px;
          font-weight: 800;
          color: #22c55e;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .status {
          font-size: 10px;
          color: #64748b;
          display: flex;
          align-items: center;
        }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 8px;
        }
        .cell {
          background: #1e293b;
          border-radius: 8px;
          padding: 8px 10px;
        }
        .cell-label {
          font-size: 9px;
          color: #64748b;
          text-transform: uppercase;
          font-weight: 600;
          margin-bottom: 2px;
        }
        .cell-value {
          font-size: 16px;
          font-weight: 900;
        }
        .streak {
          background: #f97316;
          border-radius: 6px;
          padding: 2px 7px;
          font-size: 11px;
          font-weight: 800;
          color: #fff;
        }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      </style>
    </head>
    <body>
      <div class="header">
        <span class="brand">⚡ EasyDrive</span>
        <div class="status">
          ${statusDot}
          ${tripActive ? `${platform.toUpperCase() || 'EM VIAGEM'}` : 'Aguardando'}
          ${streak > 0 ? `<span class="streak" style="margin-left:6px">🔥${streak}</span>` : ''}
        </div>
      </div>

      <div class="grid">
        <div class="cell">
          <div class="cell-label">💰 Ganhos</div>
          <div class="cell-value" style="color:#22c55e">${fmt(earnings)}</div>
        </div>
        <div class="cell">
          <div class="cell-label">🟢 Líquido</div>
          <div class="cell-value" style="color:${netColor}">${fmt(net)}</div>
        </div>
        <div class="cell">
          <div class="cell-label">🛣️ KM hoje</div>
          <div class="cell-value" style="color:#3b82f6">${fmtKm(km)}</div>
        </div>
        <div class="cell">
          <div class="cell-label">🚗 Corridas</div>
          <div class="cell-value" style="color:#a78bfa">${trips}</div>
        </div>
      </div>

      ${buildBar(goalRevPct, '#22c55e')}
      ${buildBar(goalProfPct, '#3b82f6')}
    </body>
    </html>
  `
}

export function usePiP() {
  const pipWindowRef = useRef(null)
  const intervalRef = useRef(null)
  const dataRef = useRef({})

  const isSupported = typeof window !== 'undefined' && 'documentPictureInPicture' in window

  const stopPiP = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      pipWindowRef.current.close()
    }
    pipWindowRef.current = null
  }, [])

  const updatePiP = useCallback(() => {
    const pip = pipWindowRef.current
    if (!pip || pip.closed) { stopPiP(); return }
    pip.document.documentElement.innerHTML = buildPiPHTML(dataRef.current)
  }, [stopPiP])

  const startPiP = useCallback(async (initialData) => {
    if (!isSupported) {
      alert('Seu navegador não suporta o HUD flutuante. Use Chrome 116+ no Android.')
      return false
    }

    // Fecha janela anterior se aberta
    stopPiP()

    try {
      dataRef.current = initialData || {}
      const pip = await window.documentPictureInPicture.requestWindow({
        width: PIP_WIDTH,
        height: PIP_HEIGHT,
      })

      pipWindowRef.current = pip

      // Conteúdo inicial
      pip.document.documentElement.innerHTML = buildPiPHTML(dataRef.current)

      // Auto-refresh
      intervalRef.current = setInterval(updatePiP, REFRESH_INTERVAL)

      // Limpa quando janela é fechada
      pip.addEventListener('pagehide', stopPiP)

      return true
    } catch (e) {
      console.warn('[PiP] Erro ao abrir:', e)
      return false
    }
  }, [isSupported, stopPiP, updatePiP])

  const updateData = useCallback((newData) => {
    dataRef.current = { ...dataRef.current, ...newData }
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      updatePiP()
    }
  }, [updatePiP])

  const isOpen = useCallback(() => {
    return pipWindowRef.current && !pipWindowRef.current.closed
  }, [])

  // Limpa ao desmontar
  useEffect(() => () => stopPiP(), [stopPiP])

  return { startPiP, stopPiP, updateData, isOpen, isSupported }
}
