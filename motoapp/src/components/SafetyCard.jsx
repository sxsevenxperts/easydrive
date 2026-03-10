import { Shield, MapPin, Clock, AlertTriangle, CheckCircle } from 'lucide-react'
import { useStore } from '../store'
import { getTimeFactor } from '../utils/safety'

export default function SafetyCard() {
  const { safetyScore, currentAddress } = useStore()
  const time = getTimeFactor()

  const score = safetyScore?.score ?? null
  const level = safetyScore?.level ?? '—'
  const color = safetyScore?.color ?? '#64748b'

  const ring = score != null ? `conic-gradient(${color} ${score * 3.6}deg, #1e293b ${score * 3.6}deg)` : '#1e293b'

  return (
    <div style={{
      background: '#1e293b', borderRadius: 16, padding: 16,
      border: `1px solid ${color}33`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Shield size={16} color={color} />
        <span style={{ fontWeight: 600, color: '#94a3b8', fontSize: 13 }}>SEGURANÇA LOCAL</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Score ring */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: ring,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: '#0f172a',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1 }}>
              {score ?? '?'}
            </span>
            <span style={{ fontSize: 9, color: '#64748b' }}>/ 100</span>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'inline-block',
            background: `${color}22`, color, borderRadius: 6,
            padding: '2px 10px', fontWeight: 700, fontSize: 14, marginBottom: 6,
          }}>
            {safetyScore?.emoji} {level}
          </div>

          {currentAddress && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start', marginBottom: 4 }}>
              <MapPin size={12} color='#64748b' style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.4 }}>
                {currentAddress}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <Clock size={12} color='#64748b' />
            <span style={{ fontSize: 12, color: '#64748b' }}>
              {time.label} — {time.factor >= 0.7 ? 'Risco baixo' : time.factor >= 0.5 ? 'Atenção' : 'Risco elevado'}
            </span>
          </div>
        </div>
      </div>

      {safetyScore && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Pill icon={<CheckCircle size={11} color='#22c55e' />} label={`${safetyScore.positiveFactors} infra`} color='#22c55e' />
          <Pill icon={<AlertTriangle size={11} color='#f97316' />} label={`${safetyScore.negativeFactors} risco`} color='#f97316' />
        </div>
      )}
    </div>
  )
}

function Pill({ icon, label, color }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      background: `${color}15`, borderRadius: 20, padding: '3px 10px',
    }}>
      {icon}
      <span style={{ fontSize: 11, color, fontWeight: 600 }}>{label}</span>
    </div>
  )
}
