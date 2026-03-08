import { useStore } from '../store'
import { fmt } from '../utils/format'
import SafetyCard from '../components/SafetyCard'
import StatCard from '../components/StatCard'
import { TrendingUp, TrendingDown, Navigation, Fuel, Clock, AlertTriangle, Bell, X } from 'lucide-react'

export default function Dashboard({ onTab }) {
  const { stats, settings, alerts, clearAlerts, activeTrip, tripStatus } = useStore()

  const netToday = stats.todayEarnings - (stats.todayKm / settings.fuelConsumption * settings.fuelPrice)
  const fuelToday = stats.todayKm / settings.fuelConsumption * settings.fuelPrice
  const litrosToday = stats.todayKm / settings.fuelConsumption

  const dangerAlerts = alerts.filter(a => a.type === 'danger')

  return (
    <div style={{ padding: '16px 16px 90px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9' }}>
            {settings.name ? `Olá, ${settings.name.split(' ')[0]}` : 'EasyDrive'}
          </h1>
          <p style={{ fontSize: 12, color: '#64748b' }}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        {dangerAlerts.length > 0 && (
          <button
            onClick={clearAlerts}
            style={{
              background: '#ef444420', border: '1px solid #ef4444',
              borderRadius: 8, padding: '6px 10px',
              display: 'flex', alignItems: 'center', gap: 6,
              color: '#ef4444', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            }}
          >
            <Bell size={14} />
            {dangerAlerts.length} alerta{dangerAlerts.length > 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* Alerta de viagem ativa */}
      {activeTrip && (
        <div
          onClick={() => onTab('trip')}
          style={{
            background: tripStatus === 'trip' ? '#22c55e20' : '#f59e0b20',
            border: `1px solid ${tripStatus === 'trip' ? '#22c55e' : '#f59e0b'}`,
            borderRadius: 12, padding: '12px 16px', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
          }}
        >
          <span style={{
            width: 10, height: 10, borderRadius: '50%',
            background: tripStatus === 'trip' ? '#22c55e' : '#f59e0b',
            animation: 'pulse 1.5s infinite',
          }} />
          <div>
            <p style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 14 }}>
              {tripStatus === 'trip' ? 'Viagem em andamento' : 'Aguardando corrida'}
            </p>
            <p style={{ fontSize: 12, color: '#94a3b8' }}>
              {fmt.km(activeTrip.km)} • {activeTrip.platform?.toUpperCase()}
            </p>
          </div>
          <Navigation size={18} style={{ marginLeft: 'auto', color: '#64748b' }} />
        </div>
      )}

      {/* Alertas de segurança */}
      {dangerAlerts.slice(0, 2).map((a) => (
        <div key={a.id} style={{
          background: '#ef444415', border: '1px solid #ef4444',
          borderRadius: 12, padding: '10px 14px', marginBottom: 10,
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <AlertTriangle size={16} color='#ef4444' style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontWeight: 700, color: '#ef4444', fontSize: 13 }}>{a.title}</p>
            <p style={{ fontSize: 12, color: '#94a3b8' }}>{a.body}</p>
          </div>
        </div>
      ))}

      {/* Segurança */}
      <div style={{ marginBottom: 16 }}>
        <SafetyCard />
      </div>

      {/* Ganhos de hoje */}
      <h2 style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Hoje
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <StatCard icon='💰' label='Ganhos brutos' value={fmt.currency(stats.todayEarnings)} color='#22c55e' />
        <StatCard icon='🟢' label='Líquido (c/ comb.)' value={fmt.currency(netToday)} color={netToday >= 0 ? '#22c55e' : '#ef4444'} />
        <StatCard icon='🛣️' label='Quilômetros' value={fmt.km(stats.todayKm)} color='#3b82f6' />
        <StatCard icon='⛽' label='Combustível' value={fmt.currency(fuelToday)} sub={`${litrosToday.toFixed(2)} L`} color='#f97316' />
      </div>

      {/* Stats totais */}
      <h2 style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Total acumulado
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <StatCard icon='🏆' label='Total ganho' value={fmt.currency(stats.totalEarnings)} color='#22c55e' small />
        <StatCard icon='📊' label='Total gastos' value={fmt.currency(stats.totalExpenses)} color='#f97316' small />
        <StatCard icon='🛣️' label='KM totais' value={fmt.km(stats.totalKm)} color='#3b82f6' small />
        <StatCard icon='🚗' label='Corridas' value={stats.totalTrips} color='#a78bfa' small />
      </div>

      {/* Média por corrida */}
      {stats.totalTrips > 0 && (
        <>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Médias
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <StatCard
              icon='💵'
              label='Por corrida'
              value={fmt.currency(stats.totalEarnings / stats.totalTrips)}
              color='#22c55e'
              small
            />
            <StatCard
              icon='📍'
              label='KM por corrida'
              value={fmt.km(stats.totalKm / stats.totalTrips)}
              color='#3b82f6'
              small
            />
          </div>
        </>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1 }
          50% { opacity: 0.4 }
        }
      `}</style>
    </div>
  )
}
