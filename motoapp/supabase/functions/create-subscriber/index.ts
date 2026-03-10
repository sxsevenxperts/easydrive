// Edge Function: create-subscriber
// Cria usuário Supabase + assinatura quando alguém compra via Hotmart ou admin cria manualmente
// POST com: { email, plan, hotmart_transaction?, expires_at? }
// Autenticação: service role key (apenas admin)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { email, plan = 'basic', hotmart_transaction, expires_at } = await req.json()

    if (!email) {
      return new Response(JSON.stringify({ error: 'email obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const expiresAt = expires_at ? new Date(expires_at) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 dias

    // 1. Verificar se usuário já existe
    const { data: existingUsers } = await adminClient.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === email)

    let userId: string
    let isNew = false

    if (existingUser) {
      userId = existingUser.id
    } else {
      // 2. Criar usuário novo com senha temporária aleatória
      const tempPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-4).toUpperCase() + '!'
      
      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true, // confirmar email automaticamente
        user_metadata: { 
          name: email.split('@')[0],
          temp_password: tempPassword,
          source: 'hotmart_subscription'
        }
      })

      if (createErr) {
        return new Response(JSON.stringify({ error: createErr.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      userId = newUser.user!.id
      isNew = true

      // 3. Enviar email de boas-vindas com link de reset de senha
      await adminClient.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: {
          redirectTo: `${Deno.env.get('APP_URL') || 'https://easydrive.app'}/reset-password`
        }
      })
    }

    // 4. Criar/atualizar subscription
    const { error: subErr } = await adminClient
      .from('subscriptions')
      .upsert({
        user_id: userId,
        plan,
        status: 'active',
        hotmart_transaction: hotmart_transaction || null,
        starts_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        suspended_at: null,
        purge_at: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (subErr) {
      return new Response(JSON.stringify({ error: subErr.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 5. Garantir profile correto
    await adminClient.from('profiles').upsert({
      id: userId,
      email,
      display_name: email.split('@')[0],
      role: 'driver',
      active: true,
    }, { onConflict: 'id' })

    // 6. Registrar no lifecycle
    await adminClient.from('subscription_lifecycle').insert({
      user_id: userId,
      event: isNew ? 'created' : 'reactivated',
      reason: `Assinatura ${plan} via ${hotmart_transaction ? 'Hotmart' : 'admin'}`
    })

    return new Response(JSON.stringify({
      ok: true,
      user_id: userId,
      email,
      plan,
      expires_at: expiresAt.toISOString(),
      is_new_user: isNew,
      message: isNew
        ? 'Usuário criado! Um email de redefinição de senha foi enviado.'
        : 'Assinatura ativada para usuário existente.'
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
