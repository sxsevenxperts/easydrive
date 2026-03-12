import { useState } from 'react'
import { useStore } from '../store'
import { fmt } from '../utils/format'
import { Trash2, Plus, TrendingUp, TrendingDown, MapPin, Navigation, Fuel } from 'lucide-react'

const PLATFORMS = ['uber', '99', 'inDriver', 'outro']
const EXPENSE_CATEGORIES = ['Combustível', 'Manutenção', 'Seguro', 'Multa', 'Lanche', 'Outro']

export default function History() {
  const { trips, expenses, deleteTrip, deleteExpense, addManualTrip, addExpense, settings } = useStore()
  const [tab, setTab] = useState('corridas') // corridas | gastos
  const [showAddTrip, setShowAddTrip] = useState(false)
  const [showAddExpense, setShowAddExpense] = useState(false)

  // Form nova corrida manual
  const [form, setForm] = useState({
    platform: 'uber', earnings: '', km: '', pickup: '', destination: '',
    date: new Date().toISOString().slice(0, 16),
  })

  // Form novo gasto
  const [expForm, setExpForm] = useState({
    category: 'Combustível', value: '', note: '', date: new Date().toISOString().slice(0, 16),
  })

  const handleAddTrip = () => {
    addManualTrip({
      platform: form.platform,
      earnings: parseFloat(form.earnings.replace(',', '.')) || 0,
      km: parseFloat(form.km.replace(',', '.')) || 0,
      pickupLocation: form.pickup ? { address: form.pickup } : null,
      destination: form.destination ? { address: form.destination } : null,
      startTime: new Date(form.date).getTime(),
      endTime: new Date(form.date).getTime() + 30 * 60 * 1000,
    })
    setShowAddTrip(false)
    setForm({ platform: 'uber', earnings: '', km: '', pickup: '', destination: '', date: new Date().toISOString().slice(0, 16) })
  }

  const handleAddExpense = () => {
    addExpense({
      category: expForm.category,
      value: parseFloat(expForm.value.replace(',', '.')) || 0,
      note: expForm.note,
      date: new Date(expForm.date).getTime(),
    })
    setShowAddExpense(false)
    setExpForm({ category: 'Combustível', value: '', note: '', date: new Date().toISOString().slice(0, 16) })
  }

  return (
    <div style={{ padding: '16px 16px 90px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Histórico</h1>
        <button
          onClick={() => tab === 'corridas' ? setShowAddTrip(true) : setShowAddExpense(true)}
          style={{
            background: '#3b82f620', border: '1px solid #3b82f6',
            borderRadius: 8, padding: '6px 12px',
            display: 'flex', alignItems: 'center', gap: 6,
            color: '#3b82f6', cursor: 'pointer', fontWeight: 600, fontSize: 13,
          }}
        >
          <Plus size={14} /> Adicionar
        </button>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 6, background: '#1e293b',
        borderRadius: 10, padding: 4, marginBottom: 16,
      }}>
        {['corridas', 'gastos'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '8px', border: 'none',
              borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
              background: tab === t ? '#3b82f6' : 'transparent',
              color: tab === t ? '#fff' : '#64748b',
              transition: 'all 0.15s',
            }}
          >
            {t === 'corridas' ? `Corridas (${trips.length})` : `Gastos (${expenses.length})`}
          </button>
        ))}
      </div>

      {tab === 'corridas' && (
        <>
          {trips.length === 0 ? (
            <Empty msg='Nenhuma corrida registrada ainda.' />
          ) : (
            trips.map((trip) => {
              const fuelCost = (trip.km / settings.fuelConsumption) * settings.fuelPrice
              const net = (trip.earnings || 0) - fuelCost
              const platColor = { uber: '#fff', '99': '#FFD700', inDriver: '#22c55e', outro: '#a78bfa' }[trip.platform] || '#64748b'
              return (
                <div key={trip.id} style={{
                  background: '#1e293b', borderRadius: 14, padding: 14,
                  border: '1px solid #334155', marginBottom: 10,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <span style={{
                        background: `${platColor}22`, color: platColor,
                        borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700,
                        marginRight: 8,
                      }}>
                        {trip.platform?.toUpperCase()}
                      </span>
                      {trip.manual && (
                        <span style={{ fontSize: 10, color: '#64748b' }}>Manual</span>
                      )}
                    </div>
                    <button
                      onClick={() => { if (confirm('Excluir corrida?')) deleteTrip(trip.id) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                    >
                      <Trash2 size={14} color='#475569' />
                    </button>
                  </div>

                  {/* Rota */}
                  {(trip.pickupLocation?.address || trip.destination?.address) && (
                    <div style={{ marginBottom: 10 }}>
                      {trip.pickupLocation?.address && (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                          <MapPin size={11} color='#3b82f6' />
                          <span style={{ fontSize: 12, color: '#94a3b8' }}>{trip.pickupLocation.address}</span>
                        </div>
                      )}
                      {trip.destination?.address && (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <Navigation size={11} color='#22c55e' />
                          <span style={{ fontSize: 12, color: '#94a3b8' }}>{trip.destination.address}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                    <MiniStat label='Ganho' value={fmt.currency(trip.earnings || 0)} color='#22c55e' />
                    <MiniStat label='Combust.' value={fmt.currency(fuelCost)} color='#f97316' />
                    <MiniStat label='Líquido' value={fmt.currency(net)} color={net >= 0 ? '#22c55e' : '#ef4444'} />
                    <MiniStat label='KM' value={fmt.km(trip.km || 0)} color='#3b82f6' />
                  </div>

                  <p style={{ fontSize: 11, color: '#475569', marginTop: 8 }}>
                    {fmt.datetime(trip.startTime)}
                  </p>
                </div>
              )
            })
          )}
        </>
      )}

      {tab === 'gastos' && (
        <>
          {expenses.length === 0 ? (
            <Empty msg='Nenhum gasto registrado ainda.' />
          ) : (
            expenses.map((exp) => (
              <div key={exp.id} style={{
                background: '#1e293b', borderRadius: 14, padding: 14,
                border: '1px solid #334155', marginBottom: 10,
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: '#f9731620', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: 18 }}>
                    {{ Combustível: '⛽', Manutenção: '🔧', Seguro: '🛡️', Multa: '📋', Lanche: '🍔' }[exp.category] || '💸'}
                  </span>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 14 }}>{exp.category}</p>
                  {exp.note && <p style={{ fontSize: 12, color: '#64748b' }}>{exp.note}</p>}
                  <p style={{ fontSize: 11, color: '#475569' }}>{fmt.datetime(exp.date)}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontWeight: 800, fontSize: 16, color: '#ef4444' }}>{fmt.currency(exp.value)}</p>
                  <button
                    onClick={() => { if (confirm('Excluir gasto?')) deleteExpense(exp.id) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                  >
                    <Trash2 size={12} color='#475569' />
                  </button>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {/* Modal adicionar corrida */}
      {showAddTrip && (
        <Modal title='Registrar corrida' onClose={() => setShowAddTrip(false)} onConfirm={handleAddTrip}>
          <Label>Plataforma</Label>
          <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} style={selectStyle}>
            {PLATFORMS.map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
          </select>
          <Label>Valor recebido (R$)</Label>
          <input type='number' value={form.earnings} onChange={(e) => setForm({ ...form, earnings: e.target.value })} style={inputStyle} placeholder='Ex: 18.50' />
          <Label>KM percorridos</Label>
          <input type='number' value={form.km} onChange={(e) => setForm({ ...form, km: e.target.value })} style={inputStyle} placeholder='Ex: 8.3' />
          <Label>Origem (opcional)</Label>
          <input value={form.pickup} onChange={(e) => setForm({ ...form, pickup: e.target.value })} style={inputStyle} placeholder='Endereço de partida' />
          <Label>Destino (opcional)</Label>
          <input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} style={inputStyle} placeholder='Endereço de chegada' />
          <Label>Data e hora</Label>
          <input type='datetime-local' value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={inputStyle} />
        </Modal>
      )}

      {/* Modal adicionar gasto */}
      {showAddExpense && (
        <Modal title='Registrar gasto' onClose={() => setShowAddExpense(false)} onConfirm={handleAddExpense}>
          <Label>Categoria</Label>
          <select value={expForm.category} onChange={(e) => setExpForm({ ...expForm, category: e.target.value })} style={selectStyle}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <Label>Valor (R$)</Label>
          <input type='number' value={expForm.value} onChange={(e) => setExpForm({ ...expForm, value: e.target.value })} style={inputStyle} placeholder='Ex: 80.00' />
          <Label>Observação (opcional)</Label>
          <input value={expForm.note} onChange={(e) => setExpForm({ ...expForm, note: e.target.value })} style={inputStyle} placeholder='Ex: Posto Shell' />
          <Label>Data</Label>
          <input type='datetime-local' value={expForm.date} onChange={(e) => setExpForm({ ...expForm, date: e.target.value })} style={inputStyle} />
        </Modal>
      )}
    </div>
  )
}

function Empty({ msg }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
      <p style={{ fontSize: 32, marginBottom: 8 }}>📭</p>
      <p>{msg}</p>
    </div>
  )
}

function MiniStat({ label, value, color }) {
  return (
    <div>
      <p style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>{label}</p>
      <p style={{ fontWeight: 700, fontSize: 13, color }}>{value}</p>
    </div>
  )
}

function Label({ children }) {
  return <p style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{children}</p>
}

function Modal({ title, onClose, onConfirm, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#000a',
      display: 'flex', alignItems: 'flex-end', zIndex: 200,
    }}>
      <div style={{
        background: '#1e293b', borderRadius: '20px 20px 0 0',
        padding: '24px 20px', width: '100%',
        maxHeight: '85dvh', overflowY: 'auto',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
      }}>
        <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 20 }}>{title}</h3>
        {children}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '14px', background: '#334155', border: 'none', borderRadius: 12, color: '#94a3b8', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
          <button onClick={onConfirm} style={{ flex: 2, padding: '14px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none', borderRadius: 12, color: '#fff', cursor: 'pointer', fontWeight: 700 }}>Salvar</button>
        </div>
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%', background: '#0f172a', border: '1px solid #334155',
  borderRadius: 10, padding: '12px 14px', color: '#f1f5f9',
  fontSize: 15, outline: 'none', marginBottom: 14,
}

const selectStyle = {
  ...inputStyle, appearance: 'none', cursor: 'pointer',
}
