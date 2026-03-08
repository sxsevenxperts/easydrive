import { useState, useMemo } from 'react'
import { useStore } from '../store'
import { fmt } from '../utils/format'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, Legend,
} from 'recharts'
import { CalendarDays, TrendingUp, Fuel, Clock, Navigation } from 'lucide-react'

// Presets de período
const PERIODS = [
  { id: '7d', label: '7 dias' },
  { id: '15d', label: '15 dias' },
  { id: '30d', label: '30 dias' },
  { id: 'custom', label: 'Personalizado' },
]

function dateKey(ts) {
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function subtractDays(n) {
  const d = new Date()
  d.setDate(d.getDate() - n + 1)
  return startOfDay(d)
}

const customTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#1e293b', border: '1px solid #334155',
      borderRadius: 10, padding: '10px 14px', fontSize: 12,
    }}>
      <p style={{ fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

export default function Stats() {
  const { trips, settings } = useStore()

  const [period, setPeriod] = useState('7d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  // Define intervalo de datas
  const { fromDate, toDate } = useMemo(() => {
    const to = startOfDay(new Date())
    to.setDate(to.getDate() + 1) // inclui hoje completo

    if (period === 'custom' && customFrom && customTo) {
      return {
        fromDate: startOfDay(new Date(customFrom)),
        toDate: new Date(new Date(customTo).setHours(23, 59, 59, 999)),
      }
    }
    const days = period === '15d' ? 15 : period === '30d' ? 30 : 7
    return { fromDate: subtractDays(days), toDate: to }
  }, [period, customFrom, customTo])

  // Agrupa corridas por dia
  const dailyData = useMemo(() => {
    const filtered = trips.filter((t) => {
      const ts = t.endTime || t.startTime
      return ts >= fromDate.getTime() && ts < toDate.getTime()
    })

    const byDay = {}
    filtered.forEach((t) => {
      const key = dateKey(t.endTime || t.startTime)
      if (!byDay[key]) byDay[key] = { date: key, earnings: 0, km: 0, fuel: 0, trips: 0, waitTime: 0 }
      byDay[key].earnings += t.earnings || 0
      byDay[key].km += t.km || 0
      byDay[key].fuel += t.fuelCost || (t.km / settings.fuelConsumption) * settings.fuelPrice
      byDay[key].trips += 1

      // Tempo ocioso = tempo entre startTime e tripStartTime (aguardando passageiro)
      const waitMs = (t.tripStartTime || t.startTime) - t.startTime
      byDay[key].waitTime += Math.max(0, waitMs / 60000) // em minutos
    })

    // Preenche dias sem corridas no intervalo
    const result = []
    const cursor = new Date(fromDate)
    while (cursor < toDate) {
      const key = cursor.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      result.push({
        date: key,
        earnings: 0, km: 0, fuel: 0, trips: 0, waitTime: 0,
        ...(byDay[key] || {}),
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    return result
  }, [trips, fromDate, toDate, settings])

  // Médias do período
  const totals = useMemo(() => {
    const activeDays = dailyData.filter((d) => d.trips > 0).length || 1
    return {
      avgEarnings: dailyData.reduce((a, d) => a + d.earnings, 0) / activeDays,
      avgKm: dailyData.reduce((a, d) => a + d.km, 0) / activeDays,
      avgFuel: dailyData.reduce((a, d) => a + d.fuel, 0) / activeDays,
      avgWait: dailyData.reduce((a, d) => a + d.waitTime, 0) / activeDays,
      totalEarnings: dailyData.reduce((a, d) => a + d.earnings, 0),
      totalTrips: dailyData.reduce((a, d) => a + d.trips, 0),
    }
  }, [dailyData])

  const formatted = dailyData.map((d) => ({
    ...d,
    earnings: parseFloat(d.earnings.toFixed(2)),
    km: parseFloat(d.km.toFixed(1)),
    fuel: parseFloat(d.fuel.toFixed(2)),
    waitTime: Math.round(d.waitTime),
  }))

  return (
    <div style={{ padding: '20px 16px 100px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Gráficos</h1>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>Análise de desempenho por período</p>

      {/* Seletor de período */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {PERIODS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            style={{
              padding: '7px 14px',
              background: period === p.id ? '#3b82f620' : '#1e293b',
              border: `1px solid ${period === p.id ? '#3b82f6' : '#334155'}`,
              borderRadius: 20, color: period === p.id ? '#3b82f6' : '#64748b',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {period === 'custom' && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>De</label>
            <input type='date' value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Até</label>
            <input type='date' value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={inputStyle} />
          </div>
        </div>
      )}

      {/* Cards de média */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        <AvgCard icon={<TrendingUp size={16} color='#22c55e' />} label='Média/dia' value={fmt.currency(totals.avgEarnings)} sub={`Total: ${fmt.currency(totals.totalEarnings)}`} />
        <AvgCard icon={<Navigation size={16} color='#3b82f6' />} label='Km médio/dia' value={fmt.km(totals.avgKm)} sub={`${totals.totalTrips} corridas`} />
        <AvgCard icon={<Fuel size={16} color='#f97316' />} label='Combustível/dia' value={fmt.currency(totals.avgFuel)} sub='gasto médio' />
        <AvgCard icon={<Clock size={16} color='#f59e0b' />} label='Espera ociosa/dia' value={`${Math.round(totals.avgWait)} min`} sub='aguardando passageiro' />
      </div>

      {/* Gráfico: Ganhos */}
      <ChartCard title='Ganhos por dia (R$)'>
        <ResponsiveContainer width='100%' height={180}>
          <BarChart data={formatted} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray='3 3' stroke='#1e293b' />
            <XAxis dataKey='date' tick={{ fill: '#64748b', fontSize: 11 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
            <Tooltip content={customTooltip} />
            <Bar dataKey='earnings' name='R$' fill='#22c55e' radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Gráfico: Km rodados */}
      <ChartCard title='Km rodados por dia'>
        <ResponsiveContainer width='100%' height={180}>
          <LineChart data={formatted} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray='3 3' stroke='#1e293b' />
            <XAxis dataKey='date' tick={{ fill: '#64748b', fontSize: 11 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
            <Tooltip content={customTooltip} />
            <Line type='monotone' dataKey='km' name='Km' stroke='#3b82f6' strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Gráfico: Combustível */}
      <ChartCard title='Gasto de combustível (R$)'>
        <ResponsiveContainer width='100%' height={180}>
          <BarChart data={formatted} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray='3 3' stroke='#1e293b' />
            <XAxis dataKey='date' tick={{ fill: '#64748b', fontSize: 11 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
            <Tooltip content={customTooltip} />
            <Bar dataKey='fuel' name='R$ combust.' fill='#f97316' radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Gráfico: Tempo de espera ociosa */}
      <ChartCard title='Tempo de espera ociosa (min)'>
        <ResponsiveContainer width='100%' height={180}>
          <BarChart data={formatted} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray='3 3' stroke='#1e293b' />
            <XAxis dataKey='date' tick={{ fill: '#64748b', fontSize: 11 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
            <Tooltip content={customTooltip} />
            <Bar dataKey='waitTime' name='Min espera' fill='#f59e0b' radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Gráfico combinado: Ganhos vs Combustível */}
      <ChartCard title='Ganhos vs Combustível (R$)'>
        <ResponsiveContainer width='100%' height={200}>
          <LineChart data={formatted} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray='3 3' stroke='#1e293b' />
            <XAxis dataKey='date' tick={{ fill: '#64748b', fontSize: 11 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
            <Tooltip content={customTooltip} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
            <Line type='monotone' dataKey='earnings' name='Ganhos' stroke='#22c55e' strokeWidth={2} dot={false} />
            <Line type='monotone' dataKey='fuel' name='Combustível' stroke='#ef4444' strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div style={{
      background: '#1e293b', borderRadius: 14, padding: '14px 10px 10px',
      border: '1px solid #334155', marginBottom: 16,
    }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 12, paddingLeft: 4 }}>{title}</p>
      {children}
    </div>
  )
}

function AvgCard({ icon, label, value, sub }) {
  return (
    <div style={{ background: '#1e293b', borderRadius: 12, padding: 12, border: '1px solid #334155' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
        {icon}
        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>{label}</span>
      </div>
      <p style={{ fontWeight: 800, fontSize: 18, color: '#f1f5f9' }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{sub}</p>}
    </div>
  )
}

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: '#64748b', marginBottom: 4, textTransform: 'uppercase',
}

const inputStyle = {
  width: '100%', background: '#0f172a', border: '1px solid #334155',
  borderRadius: 8, padding: '9px 12px', color: '#f1f5f9',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
  colorScheme: 'dark',
}
