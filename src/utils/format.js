export const fmt = {
  currency: (v = 0) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v),

  km: (v = 0) => `${v.toFixed(1)} km`,

  duration: (ms = 0) => {
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    const h = Math.floor(m / 60)
    if (h > 0) return `${h}h ${m % 60}m`
    if (m > 0) return `${m}m ${s % 60}s`
    return `${s}s`
  },

  time: (ts) => {
    if (!ts) return '--'
    return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  },

  date: (ts) => {
    if (!ts) return '--'
    return new Date(ts).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit'
    })
  },

  datetime: (ts) => {
    if (!ts) return '--'
    return new Date(ts).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit'
    })
  },

  speed: (kmh = 0) => `${Math.round(kmh)} km/h`,

  percent: (v = 0) => `${Math.round(v)}%`,

  liters: (v = 0) => `${v.toFixed(2)} L`,
}
