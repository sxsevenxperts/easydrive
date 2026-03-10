import { createClient } from '@supabase/supabase-js'

// Supabase Self-Hosted (EasyPanel)
const url = import.meta.env.VITE_SUPABASE_URL || ''
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = url && key ? createClient(url, key) : null

// ── Verificar assinatura real ──
export async function checkSubscription(userId) {
  if (!supabase) return { active: true, plan: 'premium' }

  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('plan, status, expires_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      return { active: false, reason: 'not_found' }
    }

    const isExpired = new Date(data.expires_at) < new Date()
    const isActive = data.status === 'active' && !isExpired

    return {
      active: isActive,
      plan: data.plan,
      status: data.status,
      expires_at: data.expires_at,
      reason: isExpired ? 'expired' : (!isActive ? 'cancelled' : null),
    }
  } catch {
    // Fallback: se erro de rede, permite acesso
    return { active: true, plan: 'premium', offline: true }
  }
}

// ── Buscar perfil do motorista ──
export async function getProfile(userId) {
  if (!supabase) return null
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return data
}

// ── Atualizar perfil ──
export async function updateProfile(userId, updates) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Upload avatar ──
export async function uploadAvatar(userId, file) {
  if (!supabase) return null
  const ext = file.name.split('.').pop()
  const path = `${userId}/avatar.${ext}`

  const { error: upErr } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true })
  if (upErr) throw upErr

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  const avatar_url = data.publicUrl + '?t=' + Date.now()

  await updateProfile(userId, { avatar_url })
  return avatar_url
}

// ── Buscar histórico de pagamentos ──
export async function getPaymentHistory(userId) {
  if (!supabase) return []
  const { data } = await supabase
    .from('payment_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return data || []
}

// ── Verificar se é admin ──
export async function checkIsAdmin(userId) {
  if (!supabase) return false
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
  return data?.role === 'admin'
}
