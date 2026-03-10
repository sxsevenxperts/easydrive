import { useState, useEffect } from 'react'
import { getPaymentHistory } from '../lib/supabase'
import {
  CreditCard, Clock, CheckCircle, XCircle, AlertTriangle,
  Receipt, ArrowLeft, RefreshCw, Loader, ExternalLink,
} from 'lucide-react'

const HOTMART_CHECKOUT = 'https://pay.hotmart.com/SEU_PRODUTO_ID' // Substituir pelo link real

export default function Billing({ user, subscription, onBack }) {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.id) {
      getPaymentHistory(user.id)
        .then(setPayments)
        .finally(() => setLoading(false))
    }
  }, [user?.id])

  const isActive = subscription?.active
  const expiresAt = subscription?.expires_at ? new Date(subscription.expires_at) : null
  const daysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 86400000)) : 0

  const statusColor = isActive ? '#22c55e' : '#ef4444'
  const statusIcon = isActive ? <CheckCircle size={20} color='#22c55e' /> : <XCircle size={20} color='#ef4444' />

  return (
    <div style={{ padding: '16px 16px 90px', maxWidth: 480, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>Faturamento</h1>
      </div>

      {/* Status da assinatura */}
      <div style={{
        background: `${statusColor}10`,
        border: `1px solid ${statusColor}40`,
        borderRadius: 16, padding: 20, marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          {statusIcon}
          <div>
            <p style={{ fontWeight: 800, fontSize: 16, color: '#f1f5f9' }}>
              {isActive ? 'Assinatura Ativa' : 'Assinatura Vencida'}
            </p>
            <p style={{ fontSize: 12, color: '#94a3b8' }}>
              Plano {subscription?.plan?.toUpperCase() || 'PREMIUM'}
            </p>
          </div>
        </div>

        {expiresAt && (
          <div style={{
            background: '#0f172a', borderRadius: 12, padding: 14,
            border: '1px solid #334155',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={14} color='#64748b' />
                <span style={{ fontSize: 13, color: '#94a3b8' }}>
                  {isActive ? 'Vence em' : 'Venceu em'}
                </span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>
                {expiresAt.toLocaleDateString('pt-BR')}
              </span>
            </div>
            {isActive && (
              <div style={{ marginTop: 10 }}>
                <div style={{
                  width: '100%', height: 6, background: '#334155',
                  borderRadius: 3, overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${Math.min(100, (daysLeft / 30) * 100)}%`,
                    height: '100%',
                    background: daysLeft <= 5 ? '#f59e0b' : '#22c55e',
                    borderRadius: 3, transition: 'width 0.5s',
                  }} />
                </div>
                <p style={{ fontSize: 11, color: '#64748b', marginTop: 4, textAlign: 'right' }}>
                  {daysLeft} {daysLeft === 1 ? 'dia restante' : 'dias restantes'}
                </p>
              </div>
            )}
          </div>
        )}

        {daysLeft <= 5 && isActive && (
          <div style={{
            marginTop: 12, display: 'flex', alignItems: 'center', gap: 8,
            background: '#f59e0b15', borderRadius: 10, padding: '10px 12px',
            border: '1px solid #f59e0b40',
          }}>
            <AlertTriangle size={14} color='#f59e0b' />
            <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>
              Sua assinatura vence em breve! Renove para não perder acesso.
            </span>
          </div>
        )}
      </div>

      {/* Botão de renovação */}
      <button
        onClick={() => window.open(HOTMART_CHECKOUT, '_blank')}
        style={{
          width: '100%', padding: 16, marginBottom: 20,
          background: isActive ? '#1e293b' : 'linear-gradient(135deg, #22c55e, #16a34a)',
          border: isActive ? '1px solid #334155' : 'none',
          borderRadius: 14, color: '#fff', fontSize: 15,
          fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        <RefreshCw size={16} />
        {isActive ? 'Renovar Antecipadamente' : 'Renovar Agora'}
        <ExternalLink size={14} style={{ opacity: 0.6 }} />
      </button>

      {/* Métodos de pagamento aceitos */}
      <div style={{
        background: '#1e293b', borderRadius: 14, padding: 16,
        border: '1px solid #334155', marginBottom: 20,
      }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: 10 }}>
          Formas de pagamento
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { icon: '💳', label: 'Cartão de Crédito' },
            { icon: '🔄', label: 'Recorrência Cartão' },
            { icon: '📱', label: 'PIX' },
            { icon: '⚡', label: 'PIX Automático' },
          ].map((m) => (
            <div key={m.label} style={{
              background: '#0f172a', borderRadius: 10, padding: '10px 12px',
              display: 'flex', alignItems: 'center', gap: 8,
              border: '1px solid #334155',
            }}>
              <span style={{ fontSize: 18 }}>{m.icon}</span>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Histórico de pagamentos */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Receipt size={14} color='#64748b' />
        <h2 style={{ fontSize: 13, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
          Histórico de Pagamentos
        </h2>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 30 }}>
          <Loader size={24} color='#3b82f6' style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : payments.length === 0 ? (
        <div style={{
          background: '#1e293b', borderRadius: 14, padding: 24,
          textAlign: 'center', border: '1px solid #334155',
        }}>
          <CreditCard size={32} color='#334155' style={{ marginBottom: 8 }} />
          <p style={{ fontSize: 14, color: '#64748b' }}>Nenhum pagamento registrado</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {payments.map((p) => (
            <div key={p.id} style={{
              background: '#1e293b', borderRadius: 12, padding: '12px 14px',
              border: '1px solid #334155',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>
                  {p.status === 'approved' ? '✅' : p.status === 'cancelled' ? '❌' : '⏳'}
                  {' '}
                  {p.event_type === 'PURCHASE_APPROVED' ? 'Pagamento aprovado' :
                   p.event_type === 'PURCHASE_CANCELED' ? 'Cancelado' :
                   p.event_type === 'PURCHASE_REFUNDED' ? 'Reembolsado' :
                   p.event_type || 'Pagamento'}
                </p>
                <p style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  {new Date(p.created_at).toLocaleDateString('pt-BR')} às{' '}
                  {new Date(p.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  {p.payment_method && ` • ${
                    p.payment_method === 'CREDIT_CARD' ? 'Cartão' :
                    p.payment_method === 'PIX' ? 'PIX' :
                    p.payment_method === 'BILLET' ? 'Boleto' :
                    p.payment_method
                  }`}
                </p>
              </div>
              {p.amount && (
                <span style={{
                  fontSize: 15, fontWeight: 800,
                  color: p.status === 'approved' ? '#22c55e' : '#ef4444',
                }}>
                  R$ {Number(p.amount).toFixed(2).replace('.', ',')}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: 30, padding: '10px 0' }}>
        <p style={{ fontSize: 11, color: '#475569' }}>
          Powered by <strong>Seven Xperts</strong>
        </p>
        <p style={{ fontSize: 10, color: '#334155' }}>
          CNPJ 32.794.007/0001-19
        </p>
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
