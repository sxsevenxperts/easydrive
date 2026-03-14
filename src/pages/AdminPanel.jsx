import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { createClient } from '@supabase/supabase-js'
import {
  Users, ArrowLeft, RefreshCw, Loader, LogOut,
  AlertCircle,
} from 'lucide-react'

// Admin client with service role key (used only in this admin-only page)
const adminSupabase = (() => {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_SERVICE_KEY
  if (!url || !key) return supabase
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
})()

export default function AdminPanel({ user, onLogout }) {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    setLoading(true)
    setError(null)
    try {
      // Tentar carregar stats básicas
      const { count: driversCount, error: dErr } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'driver')

      const { count: subsCount, error: sErr } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')

      if (dErr || sErr) throw new Error('Erro ao carregar dados')

      setStats({
        drivers: driversCount || 0,
        active_subs: subsCount || 0,
        timestamp: new Date().toLocaleString('pt-BR')
      })
    } catch (err) {
      setError(err.message)
      setStats({
        drivers: 0,
        active_subs: 0,
        timestamp: new Date().toLocaleString('pt-BR')
      })
    }
    setLoading(false)
  }

  return (
    <div style={{
      background: '#0f172a',
      minHeight: '100dvh',
      color: '#f1f5f9',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px 30px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>🛡️ Painel Admin</h1>
            <p style={{ fontSize: 13, color: '#64748b', margin: '6px 0 0 0' }}>
              {user?.email}
            </p>
          </div>
          <button onClick={onLogout} style={{
            background: '#ef444420',
            border: '1px solid #ef444440',
            borderRadius: 10,
            padding: '10px 14px',
            color: '#ef4444',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <LogOut size={16} />
            Sair
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div style={{
            background: '#ef444415',
            border: '1px solid #ef444440',
            borderRadius: 12,
            padding: '14px',
            marginBottom: 20,
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
          }}>
            <AlertCircle size={20} color='#ef4444' style={{ flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#ef4444', margin: 0 }}>Erro ao carregar dados</p>
              <p style={{ fontSize: 12, color: '#f87171', margin: '4px 0 0 0' }}>{error}</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <Loader size={32} color='#3b82f6' style={{ animation: 'spin 1s linear infinite', marginBottom: 16 }} />
            <p style={{ fontSize: 14, color: '#64748b' }}>Carregando dados...</p>
          </div>
        ) : stats ? (
          <>
            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              <div style={{
                background: '#1e293b',
                borderRadius: 14,
                padding: 16,
                border: '1px solid #334155',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Users size={18} color='#3b82f6' />
                  <span style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase' }}>Motoristas</span>
                </div>
                <p style={{ fontSize: 28, fontWeight: 900, color: '#3b82f6', margin: 0 }}>
                  {stats.drivers}
                </p>
              </div>

              <div style={{
                background: '#1e293b',
                borderRadius: 14,
                padding: 16,
                border: '1px solid #334155',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Users size={18} color='#22c55e' />
                  <span style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase' }}>Assinaturas</span>
                </div>
                <p style={{ fontSize: 28, fontWeight: 900, color: '#22c55e', margin: 0 }}>
                  {stats.active_subs}
                </p>
              </div>
            </div>

            {/* Ações */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', margin: '0 0 12px 0' }}>Ações</h3>
              <button onClick={loadStats} style={{
                width: '100%',
                padding: 12,
                background: '#3b82f6',
                border: 'none',
                borderRadius: 10,
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}>
                <RefreshCw size={16} />
                Atualizar dados
              </button>
            </div>

            {/* Info */}
            <div style={{
              background: '#1e293b',
              borderRadius: 12,
              padding: 12,
              border: '1px solid #334155',
              fontSize: 11,
              color: '#64748b',
            }}>
              <p style={{ margin: 0 }}>📊 Última atualização: {stats.timestamp}</p>
              <p style={{ margin: '6px 0 0 0' }}>✅ Painel admin operacional</p>
            </div>
          </>
        ) : null}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 40, padding: '10px 0' }}>
          <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>
            Powered by <strong>Seven Xperts</strong>
          </p>
        </div>
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
