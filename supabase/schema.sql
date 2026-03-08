-- EasyDrive — Schema Supabase
-- Projeto: easydrive
-- Execute este SQL no SQL Editor do Supabase

-- ── TABELA: subscriptions ────────────────────────────────────────────────
create table if not exists public.subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  plan        text not null default 'mensal',   -- 'mensal', 'anual', 'trial'
  status      text not null default 'active',   -- 'active', 'cancelled', 'expired'
  starts_at   timestamptz not null default now(),
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

-- Índice para busca por user_id
create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);

-- RLS: usuário só vê a própria assinatura
alter table public.subscriptions enable row level security;

create policy "users can view own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Service role (admin) pode inserir/atualizar
create policy "service role can manage subscriptions"
  on public.subscriptions for all
  using (auth.role() = 'service_role');


-- ── FUNÇÃO: cria trial automático no cadastro ─────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.subscriptions (user_id, plan, status, expires_at)
  values (
    new.id,
    'trial',
    'active',
    now() + interval '7 days'   -- 7 dias de trial gratuito
  );
  return new;
end;
$$;

-- Trigger: dispara ao criar usuário
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ── EXEMPLO: criar assinatura manual para um usuário ─────────────────────
-- insert into public.subscriptions (user_id, plan, status, expires_at)
-- values ('<user_uuid_aqui>', 'mensal', 'active', now() + interval '30 days');
