-- ═══════════════════════════════════════════════════════
-- EasyDrive — Setup completo do banco de dados Supabase
-- Cole e execute no SQL Editor do painel Supabase
-- ═══════════════════════════════════════════════════════

-- 1. Tabela de assinaturas
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  plan        TEXT NOT NULL DEFAULT 'basic' CHECK (plan IN ('basic', 'pro', 'premium', 'trial')),
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para busca por usuário
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_id_idx ON public.subscriptions(user_id);

-- 2. RLS — Row Level Security
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Usuário pode ver apenas a própria assinatura
CREATE POLICY IF NOT EXISTS "subscriptions_select_own"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- 3. Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4. Função para criar assinatura automática no cadastro
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, status, plan, expires_at)
  VALUES (
    NEW.id,
    'active',
    'trial',
    NOW() + INTERVAL '30 days'  -- 30 dias de trial grátis
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dispara ao criar novo usuário no Auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ═══════════════════════════════════════════════════════
-- DESABILITAR confirmação de email (rodar como superuser)
-- Vai no painel: Authentication > Email Templates >
--   desative "Enable email confirmations"
-- OU via SQL (pode não funcionar em todos os planos):
-- UPDATE auth.config SET enable_signup = true;
-- ═══════════════════════════════════════════════════════

-- Verificar resultado:
SELECT 'Setup concluído! Tabela subscriptions criada.' AS status;
