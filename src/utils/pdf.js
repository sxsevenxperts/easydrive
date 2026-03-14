// EasyDrive — Relatório PDF Mensal
// Gera relatório formatado para impressão/PDF

export function getMonthYear(date = new Date()) {
  return {
    month: date.getMonth(),
    year: date.getFullYear(),
    label: date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  }
}

export function getMonthStats(trips, expenses, monthNum, yearNum) {
  const start = new Date(yearNum, monthNum, 1)
  const end = new Date(yearNum, monthNum + 1, 0, 23, 59, 59)

  const monthTrips = trips.filter(t => {
    const tDate = new Date(t.endTime || t.startTime)
    return tDate >= start && tDate <= end
  })

  const monthExpenses = expenses.filter(e => {
    const eDate = new Date(e.date || e.createdAt)
    return eDate >= start && eDate <= end
  })

  const revenue = monthTrips.reduce((a, t) => a + (t.earnings || 0), 0)
  const km = monthTrips.reduce((a, t) => a + (t.km || 0), 0)
  const fuelCost = monthTrips.reduce((a, t) => a + (t.fuelCost || 0), 0)
  const otherExpenses = monthExpenses.reduce((a, e) => a + (e.value || 0), 0)
  const totalExpenses = fuelCost + otherExpenses
  const profit = revenue - totalExpenses

  return {
    trips: monthTrips.length,
    revenue,
    km,
    fuelCost,
    otherExpenses,
    totalExpenses,
    profit,
    profitPercent: revenue > 0 ? Math.round((profit / revenue) * 100) : 0,
    avgEarningPerTrip: monthTrips.length > 0 ? revenue / monthTrips.length : 0,
    avgKmPerTrip: monthTrips.length > 0 ? km / monthTrips.length : 0,
    costPerKm: km > 0 ? totalExpenses / km : 0,
  }
}

export function formatCurrency(value) {
  return `R$ ${value.toFixed(2).replace('.', ',')}`
}

export function formatKm(value) {
  return `${value.toFixed(1)} km`.replace('.', ',')
}
