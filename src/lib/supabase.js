import { createClient } from '@supabase/supabase-js'

// Configure em .env.local:
//   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
//   VITE_SUPABASE_ANON_KEY=eyJhbG...

const url = import.meta.env.VITE_SUPABASE_URL || ''
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = url && key ? createClient(url, key) : null

// Verifica se a assinatura do usuário está ativa
export async function checkSubscription(userId) {
  if (!supabase) return { active: false, reason: 'no_config' }

  const { data, error } = await supabase
    .from('subscriptions')
    .select('status, expires_at, plan')
    .eq('user_id', userId)
    .order('expires_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return { active: false, reason: 'not_found' }

  const expired = data.expires_at && new Date(data.expires_at) < new Date()
  if (data.status !== 'active' || expired) {
    return { active: false, reason: 'expired', expires_at: data.expires_at, plan: data.plan }
  }

  return { active: true, plan: data.plan, expires_at: data.expires_at }
}
