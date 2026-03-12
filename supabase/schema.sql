-- ═══════════════════════════════════════════════════════════════
-- EasyDrive — Schema Completo
-- Supabase Self-Hosted (EasyPanel)
-- Cada motorista só vê seus dados (RLS). Admin vê tudo.
-- ═══════════════════════════════════════════════════════════════

-- ═══ TABELA: profiles ═══
-- Perfil do motorista com foto, veículo, plataformas
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  city text,
  role text default 'driver', -- 'driver' | 'admin'
  vehicle_type text default 'moto', -- 'moto' | 'carro'
  vehicle_model text,
  vehicle_color text,
  vehicle_year text,
  vehicle_plate text,
  fuel_type text default 'gasolina',
  fuel_price numeric(6,2) default 6.49,
  fuel_consumption numeric(6,2) default 35,
  platforms text[] default '{"uber","99"}',
  driver_since date,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;
drop policy if exists "profiles_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- ═══ TABELA: subscriptions ═══
-- Assinaturas (criada pelo webhook Hotmart)
drop table if exists public.subscriptions cascade;
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text default 'premium', -- 'premium' | 'trial'
  status text default 'active', -- 'active' | 'cancelled' | 'expired'
  hotmart_transaction text,
  starts_at timestamptz default now(),
  expires_at timestamptz not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.subscriptions enable row level security;
drop policy if exists "sub_own" on public.subscriptions;
create policy "sub_own" on public.subscriptions for select using (auth.uid() = user_id);
create index if not exists idx_sub_user on public.subscriptions(user_id);

-- ═══ TABELA: payment_history ═══
-- Histórico de pagamentos (preenchido pelo webhook Hotmart)
create table if not exists public.payment_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  hotmart_transaction text,
  amount numeric(10,2),
  currency text default 'BRL',
  payment_method text, -- 'pix' | 'credit_card' | 'pix_auto' | 'card_recurring'
  status text, -- 'approved' | 'refunded' | 'cancelled'
  event_type text, -- 'PURCHASE_APPROVED' | 'PURCHASE_CANCELED' etc
  payload jsonb,
  created_at timestamptz default now()
);

alter table public.payment_history enable row level security;
drop policy if exists "pay_own" on public.payment_history;
create policy "pay_own" on public.payment_history for select using (auth.uid() = user_id);
create index if not exists idx_pay_user on public.payment_history(user_id);

-- ═══ TABELA: trips ═══
-- Corridas sincronizadas do app
create table if not exists public.trips (
  id bigint primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text,
  start_time bigint,
  end_time bigint,
  duration bigint,
  earnings numeric(10,2) default 0,
  km numeric(10,2) default 0,
  fuel_cost numeric(10,2) default 0,
  pickup_address text,
  pickup_lat numeric(10,6),
  pickup_lon numeric(10,6),
  dest_address text,
  dest_lat numeric(10,6),
  dest_lon numeric(10,6),
  manual boolean default false,
  created_at timestamptz default now()
);

alter table public.trips enable row level security;
drop policy if exists "trips_own_select" on public.trips;
drop policy if exists "trips_own_insert" on public.trips;
drop policy if exists "trips_own_delete" on public.trips;
create policy "trips_own_select" on public.trips for select using (auth.uid() = user_id);
create policy "trips_own_insert" on public.trips for insert with check (auth.uid() = user_id);
create policy "trips_own_delete" on public.trips for delete using (auth.uid() = user_id);
create index if not exists idx_trips_user on public.trips(user_id);
create index if not exists idx_trips_date on public.trips(user_id, start_time);

-- ═══ TABELA: expenses ═══
-- Despesas do motorista
create table if not exists public.expenses (
  id bigint primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text, -- 'combustivel' | 'manutencao' | 'seguro' | 'multa' | 'lanche' | 'pedagio' | 'outro'
  value numeric(10,2) default 0,
  note text,
  date bigint,
  created_at timestamptz default now()
);

alter table public.expenses enable row level security;
drop policy if exists "exp_own_select" on public.expenses;
drop policy if exists "exp_own_insert" on public.expenses;
drop policy if exists "exp_own_delete" on public.expenses;
create policy "exp_own_select" on public.expenses for select using (auth.uid() = user_id);
create policy "exp_own_insert" on public.expenses for insert with check (auth.uid() = user_id);
create policy "exp_own_delete" on public.expenses for delete using (auth.uid() = user_id);
create index if not exists idx_exp_user on public.expenses(user_id);

-- ═══ TABELA: fuel_logs ═══
-- Abastecimentos
create table if not exists public.fuel_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  liters numeric(8,2),
  total_cost numeric(10,2),
  price_per_liter numeric(6,3),
  fuel_type text,
  station_name text,
  km_current numeric(10,1),
  km_per_liter numeric(6,2),
  date timestamptz default now(),
  created_at timestamptz default now()
);

alter table public.fuel_logs enable row level security;
drop policy if exists "fuel_own_s" on public.fuel_logs;
drop policy if exists "fuel_own_i" on public.fuel_logs;
drop policy if exists "fuel_own_d" on public.fuel_logs;
create policy "fuel_own_s" on public.fuel_logs for select using (auth.uid() = user_id);
create policy "fuel_own_i" on public.fuel_logs for insert with check (auth.uid() = user_id);
create policy "fuel_own_d" on public.fuel_logs for delete using (auth.uid() = user_id);

-- ═══ TABELA: vehicle_maintenance ═══
-- Manutenções do veículo
create table if not exists public.vehicle_maintenance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null, -- 'oleo' | 'filtro_ar' | 'freio' | 'pneu' | 'correia' | 'revisao' | 'outro'
  description text,
  cost numeric(10,2),
  km_at numeric(10,1),
  workshop text,
  next_km numeric(10,1),
  next_date date,
  date date not null,
  created_at timestamptz default now()
);

alter table public.vehicle_maintenance enable row level security;
drop policy if exists "maint_own_s" on public.vehicle_maintenance;
drop policy if exists "maint_own_i" on public.vehicle_maintenance;
drop policy if exists "maint_own_u" on public.vehicle_maintenance;
drop policy if exists "maint_own_d" on public.vehicle_maintenance;
create policy "maint_own_s" on public.vehicle_maintenance for select using (auth.uid() = user_id);
create policy "maint_own_i" on public.vehicle_maintenance for insert with check (auth.uid() = user_id);
create policy "maint_own_u" on public.vehicle_maintenance for update using (auth.uid() = user_id);
create policy "maint_own_d" on public.vehicle_maintenance for delete using (auth.uid() = user_id);

-- ═══ TABELA: driver_tasks ═══
-- Tarefas do calendário
create table if not exists public.driver_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  due_date timestamptz,
  recurrence text, -- 'once' | 'daily' | 'weekly' | 'monthly'
  status text default 'pending', -- 'pending' | 'done'
  category text default 'geral', -- 'geral' | 'manutencao' | 'documento' | 'financeiro'
  created_at timestamptz default now()
);

alter table public.driver_tasks enable row level security;
drop policy if exists "task_own_s" on public.driver_tasks;
drop policy if exists "task_own_i" on public.driver_tasks;
drop policy if exists "task_own_u" on public.driver_tasks;
drop policy if exists "task_own_d" on public.driver_tasks;
create policy "task_own_s" on public.driver_tasks for select using (auth.uid() = user_id);
create policy "task_own_i" on public.driver_tasks for insert with check (auth.uid() = user_id);
create policy "task_own_u" on public.driver_tasks for update using (auth.uid() = user_id);
create policy "task_own_d" on public.driver_tasks for delete using (auth.uid() = user_id);

-- ═══ TABELA: driver_documents ═══
-- Documentos com vencimento
create table if not exists public.driver_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null, -- 'cnh' | 'crlv' | 'seguro' | 'ipva' | 'vistoria' | 'certificado_app' | 'outro'
  label text,
  expires_at date,
  photo_url text,
  notes text,
  created_at timestamptz default now()
);

alter table public.driver_documents enable row level security;
drop policy if exists "doc_own_s" on public.driver_documents;
drop policy if exists "doc_own_i" on public.driver_documents;
drop policy if exists "doc_own_u" on public.driver_documents;
drop policy if exists "doc_own_d" on public.driver_documents;
create policy "doc_own_s" on public.driver_documents for select using (auth.uid() = user_id);
create policy "doc_own_i" on public.driver_documents for insert with check (auth.uid() = user_id);
create policy "doc_own_u" on public.driver_documents for update using (auth.uid() = user_id);
create policy "doc_own_d" on public.driver_documents for delete using (auth.uid() = user_id);

-- ═══ TABELA: emergency_contacts ═══
create table if not exists public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text not null,
  relationship text,
  created_at timestamptz default now()
);

alter table public.emergency_contacts enable row level security;
drop policy if exists "emg_own_s" on public.emergency_contacts;
drop policy if exists "emg_own_i" on public.emergency_contacts;
drop policy if exists "emg_own_d" on public.emergency_contacts;
create policy "emg_own_s" on public.emergency_contacts for select using (auth.uid() = user_id);
create policy "emg_own_i" on public.emergency_contacts for insert with check (auth.uid() = user_id);
create policy "emg_own_d" on public.emergency_contacts for delete using (auth.uid() = user_id);

-- ═══ TABELA: community_alerts ═══
-- Alertas comunitários (perigo, desvio, engarrafamento, assalto)
create table if not exists public.community_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null, -- 'danger' | 'detour' | 'traffic' | 'assault'
  title text,
  description text,
  vehicle_plate text,
  vehicle_description text,
  lat numeric(10,6),
  lon numeric(10,6),
  address text,
  upvotes int default 0,
  downvotes int default 0,
  status text default 'active', -- 'active' | 'expired' | 'dismissed'
  expires_at timestamptz,
  created_at timestamptz default now()
);

alter table public.community_alerts enable row level security;
-- Alertas são públicos para leitura (todos motoristas veem)
drop policy if exists "alert_read_all" on public.community_alerts;
drop policy if exists "alert_insert_own" on public.community_alerts;
create policy "alert_read_all" on public.community_alerts for select using (true);
create policy "alert_insert_own" on public.community_alerts for insert with check (auth.uid() = user_id);
create index if not exists idx_alerts_geo on public.community_alerts(lat, lon);
create index if not exists idx_alerts_active on public.community_alerts(status, expires_at);

-- ═══ TABELA: alert_votes ═══
create table if not exists public.alert_votes (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.community_alerts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote text not null, -- 'up' | 'down'
  created_at timestamptz default now(),
  unique(alert_id, user_id)
);

alter table public.alert_votes enable row level security;
drop policy if exists "vote_read" on public.alert_votes;
drop policy if exists "vote_insert" on public.alert_votes;
create policy "vote_read" on public.alert_votes for select using (true);
create policy "vote_insert" on public.alert_votes for insert with check (auth.uid() = user_id);

-- ═══ TABELA: speed_cameras ═══
create table if not exists public.speed_cameras (
  id uuid primary key default gen_random_uuid(),
  lat numeric(10,6) not null,
  lon numeric(10,6) not null,
  speed_limit int,
  direction text,
  reported_by uuid references auth.users(id),
  confirmed int default 0,
  active boolean default true,
  created_at timestamptz default now()
);

alter table public.speed_cameras enable row level security;
drop policy if exists "cam_read" on public.speed_cameras;
drop policy if exists "cam_insert" on public.speed_cameras;
create policy "cam_read" on public.speed_cameras for select using (true);
create policy "cam_insert" on public.speed_cameras for insert with check (auth.uid() = reported_by);

-- ═══ TABELA: push_tokens ═══
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text, -- 'android' | 'ios' | 'web'
  created_at timestamptz default now(),
  unique(user_id, token)
);

alter table public.push_tokens enable row level security;
drop policy if exists "push_own_s" on public.push_tokens;
drop policy if exists "push_own_i" on public.push_tokens;
create policy "push_own_s" on public.push_tokens for select using (auth.uid() = user_id);
create policy "push_own_i" on public.push_tokens for insert with check (auth.uid() = user_id);

-- ═══ TABELA: notification_preferences ═══
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  maintenance boolean default true,
  mei boolean default true,
  fuel boolean default true,
  radar boolean default true,
  community_danger boolean default true,
  community_traffic boolean default true,
  assault boolean default true,
  documents boolean default true,
  fatigue boolean default true,
  ranking boolean default true,
  weather boolean default true,
  platforms boolean default true,
  tasks boolean default true,
  daily_verse boolean default true,
  goals boolean default true,
  health boolean default true,
  referral boolean default true,
  silent_start time default '23:00',
  silent_end time default '06:00',
  all_muted boolean default false,
  updated_at timestamptz default now()
);

alter table public.notification_preferences enable row level security;
drop policy if exists "notif_own_s" on public.notification_preferences;
drop policy if exists "notif_own_i" on public.notification_preferences;
drop policy if exists "notif_own_u" on public.notification_preferences;
create policy "notif_own_s" on public.notification_preferences for select using (auth.uid() = user_id);
create policy "notif_own_i" on public.notification_preferences for insert with check (auth.uid() = user_id);
create policy "notif_own_u" on public.notification_preferences for update using (auth.uid() = user_id);

-- ═══ TABELA: community_tips ═══
create table if not exists public.community_tips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  upvotes int default 0,
  created_at timestamptz default now()
);

alter table public.community_tips enable row level security;
drop policy if exists "tips_read" on public.community_tips;
drop policy if exists "tips_insert" on public.community_tips;
create policy "tips_read" on public.community_tips for select using (true);
create policy "tips_insert" on public.community_tips for insert with check (auth.uid() = user_id);

-- ═══ TABELA: referrals ═══
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_id uuid references auth.users(id) on delete set null,
  code text unique not null,
  status text default 'pending', -- 'pending' | 'completed'
  reward_days int default 7,
  created_at timestamptz default now()
);

alter table public.referrals enable row level security;
drop policy if exists "ref_own_s" on public.referrals;
drop policy if exists "ref_own_i" on public.referrals;
create policy "ref_own_s" on public.referrals for select using (auth.uid() = referrer_id);
create policy "ref_own_i" on public.referrals for insert with check (auth.uid() = referrer_id);

-- ═══ TABELA: daily_stats (snapshot diário para admin) ═══
-- Preenchida automaticamente, usada pelo admin para relatórios rápidos
create table if not exists public.daily_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  total_trips int default 0,
  total_earnings numeric(10,2) default 0,
  total_km numeric(10,2) default 0,
  total_fuel_cost numeric(10,2) default 0,
  total_expenses numeric(10,2) default 0,
  hours_worked numeric(6,2) default 0,
  platforms_used text[],
  created_at timestamptz default now(),
  unique(user_id, date)
);

alter table public.daily_stats enable row level security;
drop policy if exists "dstats_own_s" on public.daily_stats;
drop policy if exists "dstats_own_i" on public.daily_stats;
drop policy if exists "dstats_own_u" on public.daily_stats;
create policy "dstats_own_s" on public.daily_stats for select using (auth.uid() = user_id);
create policy "dstats_own_i" on public.daily_stats for insert with check (auth.uid() = user_id);
create policy "dstats_own_u" on public.daily_stats for update using (auth.uid() = user_id);
create index if not exists idx_dstats_user_date on public.daily_stats(user_id, date);

-- ═══ FUNCTION: handle_hotmart_webhook ═══
-- Recebe webhook da Hotmart e processa compra/cancelamento
create or replace function public.handle_hotmart_webhook(payload jsonb)
returns jsonb as $$
declare
  v_event text;
  v_email text;
  v_name text;
  v_transaction text;
  v_amount numeric;
  v_payment_method text;
  v_hottok text;
  v_user_id uuid;
  v_password text;
begin
  -- Extrair dados do payload Hotmart
  v_event := payload->>'event';
  v_email := payload->'data'->'buyer'->>'email';
  v_name := payload->'data'->'buyer'->>'name';
  v_transaction := payload->'data'->'purchase'->>'transaction';
  v_amount := (payload->'data'->'purchase'->'price'->>'value')::numeric;
  v_payment_method := payload->'data'->'purchase'->'payment'->>'type';
  v_hottok := payload->>'hottok';

  -- Verificar hottok (segurança)
  if v_hottok is not null and v_hottok != current_setting('app.hotmart_hottok', true) then
    return jsonb_build_object('error', 'invalid hottok');
  end if;

  -- ── COMPRA APROVADA ──
  if v_event in ('PURCHASE_APPROVED', 'PURCHASE_COMPLETE', 'PURCHASE_PROTEST') then
    -- Verificar se usuário já existe
    select id into v_user_id from auth.users where email = v_email;

    if v_user_id is null then
      -- Gerar senha aleatória
      v_password := substr(md5(random()::text), 1, 10);

      -- Criar usuário via Supabase Auth (inserção direta)
      insert into auth.users (
        instance_id, id, aud, role, email,
        encrypted_password, email_confirmed_at,
        raw_user_meta_data, created_at, updated_at
      ) values (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(), 'authenticated', 'authenticated', v_email,
        crypt(v_password, gen_salt('bf')),
        now(),
        jsonb_build_object('name', v_name, 'temp_password', v_password),
        now(), now()
      )
      returning id into v_user_id;

      -- Criar identidade
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), v_user_id, v_email,
        jsonb_build_object('sub', v_user_id::text, 'email', v_email),
        'email', now(), now(), now());

      -- Criar perfil
      insert into public.profiles (id, email, display_name, role)
      values (v_user_id, v_email, v_name, 'driver');
    end if;

    -- Criar ou renovar assinatura
    insert into public.subscriptions (user_id, plan, status, hotmart_transaction, expires_at)
    values (v_user_id, 'premium', 'active', v_transaction, now() + interval '30 days')
    on conflict (user_id) do update set
      status = 'active',
      plan = 'premium',
      hotmart_transaction = v_transaction,
      expires_at = greatest(public.subscriptions.expires_at, now()) + interval '30 days',
      updated_at = now();

    -- Registrar pagamento
    insert into public.payment_history (user_id, hotmart_transaction, amount, payment_method, status, event_type, payload)
    values (v_user_id, v_transaction, v_amount, v_payment_method, 'approved', v_event, payload);

    return jsonb_build_object('ok', true, 'action', 'subscription_created', 'user_id', v_user_id);

  -- ── CANCELAMENTO / REEMBOLSO ──
  elsif v_event in ('PURCHASE_CANCELED', 'PURCHASE_REFUNDED', 'PURCHASE_CHARGEDBACK') then
    select id into v_user_id from auth.users where email = v_email;
    if v_user_id is not null then
      update public.subscriptions set status = 'cancelled', updated_at = now()
      where user_id = v_user_id;

      insert into public.payment_history (user_id, hotmart_transaction, amount, status, event_type, payload)
      values (v_user_id, v_transaction, v_amount, 'cancelled', v_event, payload);
    end if;
    return jsonb_build_object('ok', true, 'action', 'subscription_cancelled');

  -- ── ATRASO ──
  elsif v_event in ('PURCHASE_DELAYED', 'PURCHASE_OVERDUE') then
    select id into v_user_id from auth.users where email = v_email;
    if v_user_id is not null then
      update public.subscriptions set status = 'expired', updated_at = now()
      where user_id = v_user_id;
    end if;
    return jsonb_build_object('ok', true, 'action', 'subscription_expired');
  end if;

  return jsonb_build_object('ok', true, 'action', 'ignored', 'event', v_event);
end;
$$ language plpgsql security definer;

-- ═══ FUNCTION: admin_get_all_users ═══
-- Admin: lista todos os motoristas com resumo
create or replace function public.admin_get_all_users()
returns table (
  user_id uuid,
  email text,
  display_name text,
  avatar_url text,
  city text,
  vehicle_type text,
  vehicle_plate text,
  platforms text[],
  sub_status text,
  sub_expires timestamptz,
  total_trips bigint,
  total_earnings numeric,
  total_km numeric,
  created_at timestamptz
) as $$
begin
  -- Verificar se é admin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Acesso negado: apenas administradores';
  end if;

  return query
  select
    p.id as user_id,
    p.email,
    p.display_name,
    p.avatar_url,
    p.city,
    p.vehicle_type,
    p.vehicle_plate,
    p.platforms,
    s.status as sub_status,
    s.expires_at as sub_expires,
    coalesce(t.cnt, 0) as total_trips,
    coalesce(t.earn, 0) as total_earnings,
    coalesce(t.km, 0) as total_km,
    p.created_at
  from public.profiles p
  left join lateral (
    select status, expires_at from public.subscriptions
    where user_id = p.id order by created_at desc limit 1
  ) s on true
  left join lateral (
    select count(*) as cnt, sum(earnings) as earn, sum(km) as km
    from public.trips where user_id = p.id
  ) t on true
  where p.role = 'driver'
  order by t.earn desc nulls last;
end;
$$ language plpgsql security definer;

-- ═══ FUNCTION: admin_get_user_detail ═══
-- Admin: dados detalhados de um motorista
create or replace function public.admin_get_user_detail(target_user_id uuid)
returns jsonb as $$
declare
  v_result jsonb;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Acesso negado';
  end if;

  select jsonb_build_object(
    'profile', (select row_to_json(p) from public.profiles p where p.id = target_user_id),
    'subscription', (select row_to_json(s) from public.subscriptions s where s.user_id = target_user_id order by created_at desc limit 1),
    'trips_count', (select count(*) from public.trips where user_id = target_user_id),
    'trips_total_earnings', (select coalesce(sum(earnings), 0) from public.trips where user_id = target_user_id),
    'trips_total_km', (select coalesce(sum(km), 0) from public.trips where user_id = target_user_id),
    'expenses_total', (select coalesce(sum(value), 0) from public.expenses where user_id = target_user_id),
    'fuel_logs_count', (select count(*) from public.fuel_logs where user_id = target_user_id),
    'maintenance_count', (select count(*) from public.vehicle_maintenance where user_id = target_user_id),
    'documents_count', (select count(*) from public.driver_documents where user_id = target_user_id),
    'recent_trips', (
      select coalesce(json_agg(row_to_json(t) order by t.start_time desc), '[]'::json)
      from (select * from public.trips where user_id = target_user_id order by start_time desc limit 20) t
    ),
    'recent_expenses', (
      select coalesce(json_agg(row_to_json(e) order by e.date desc), '[]'::json)
      from (select * from public.expenses where user_id = target_user_id order by date desc limit 20) e
    ),
    'payments', (
      select coalesce(json_agg(row_to_json(ph) order by ph.created_at desc), '[]'::json)
      from public.payment_history ph where ph.user_id = target_user_id
    )
  ) into v_result;

  return v_result;
end;
$$ language plpgsql security definer;

-- ═══ FUNCTION: admin_get_rankings ═══
-- Admin: rankings gerais dos motoristas
create or replace function public.admin_get_rankings(period text default 'month')
returns table (
  rank bigint,
  user_id uuid,
  display_name text,
  avatar_url text,
  city text,
  total_trips bigint,
  total_earnings numeric,
  total_km numeric,
  avg_per_trip numeric,
  avg_per_hour numeric
) as $$
declare
  v_since timestamptz;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Acesso negado';
  end if;

  v_since := case period
    when 'day' then now() - interval '1 day'
    when 'week' then now() - interval '7 days'
    when 'month' then now() - interval '30 days'
    when 'year' then now() - interval '365 days'
    else now() - interval '30 days'
  end;

  return query
  select
    row_number() over (order by sum(t.earnings) desc) as rank,
    p.id as user_id,
    p.display_name,
    p.avatar_url,
    p.city,
    count(t.id) as total_trips,
    coalesce(sum(t.earnings), 0) as total_earnings,
    coalesce(sum(t.km), 0) as total_km,
    case when count(t.id) > 0
      then round(sum(t.earnings) / count(t.id), 2)
      else 0
    end as avg_per_trip,
    case when sum(t.duration) > 0
      then round(sum(t.earnings) / (sum(t.duration)::numeric / 3600000), 2)
      else 0
    end as avg_per_hour
  from public.profiles p
  left join public.trips t on t.user_id = p.id
    and t.created_at >= v_since
  where p.role = 'driver'
  group by p.id, p.display_name, p.avatar_url, p.city
  having count(t.id) > 0
  order by sum(t.earnings) desc;
end;
$$ language plpgsql security definer;

-- ═══ FUNCTION: admin_get_dashboard ═══
-- Admin: KPIs gerais da plataforma
create or replace function public.admin_get_dashboard()
returns jsonb as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Acesso negado';
  end if;

  return jsonb_build_object(
    'total_drivers', (select count(*) from public.profiles where role = 'driver'),
    'active_subscriptions', (select count(*) from public.subscriptions where status = 'active' and expires_at > now()),
    'expired_subscriptions', (select count(*) from public.subscriptions where status != 'active' or expires_at <= now()),
    'total_trips_today', (select count(*) from public.trips where created_at >= current_date),
    'total_earnings_today', (select coalesce(sum(earnings), 0) from public.trips where created_at >= current_date),
    'total_trips_month', (select count(*) from public.trips where created_at >= date_trunc('month', now())),
    'total_earnings_month', (select coalesce(sum(earnings), 0) from public.trips where created_at >= date_trunc('month', now())),
    'total_km_month', (select coalesce(sum(km), 0) from public.trips where created_at >= date_trunc('month', now())),
    'revenue_hotmart', (select coalesce(sum(amount), 0) from public.payment_history where status = 'approved' and created_at >= date_trunc('month', now())),
    'recent_signups', (
      select coalesce(json_agg(row_to_json(r)), '[]'::json)
      from (select p.display_name, p.email, p.city, p.created_at
        from public.profiles p where p.role = 'driver'
        order by p.created_at desc limit 5) r
    ),
    'top_earners_today', (
      select coalesce(json_agg(row_to_json(te)), '[]'::json)
      from (
        select p.display_name, p.avatar_url, sum(t.earnings) as earnings, count(t.id) as trips
        from public.trips t join public.profiles p on p.id = t.user_id
        where t.created_at >= current_date
        group by p.id, p.display_name, p.avatar_url
        order by sum(t.earnings) desc limit 5
      ) te
    ),
    'alerts_active', (select count(*) from public.community_alerts where status = 'active')
  );
end;
$$ language plpgsql security definer;

-- ═══ Adicionar constraint unique em subscriptions ═══
-- Para ON CONFLICT funcionar no webhook
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'subscriptions_user_id_key') then
    alter table public.subscriptions add constraint subscriptions_user_id_key unique (user_id);
  end if;
end $$;

-- ═══ Trigger: criar profile automaticamente no signup ═══
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'driver'
  )
  on conflict (id) do nothing;

  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ═══ Storage bucket para avatars ═══
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Policy: upload próprio avatar
drop policy if exists "avatar_upload" on storage.objects;
create policy "avatar_upload" on storage.objects for insert
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar_read" on storage.objects;
create policy "avatar_read" on storage.objects for select
using (bucket_id = 'avatars');

-- ══════════════════════════════════════════════════════
-- FIM DO SCHEMA
-- Execute no SQL Editor do Supabase
-- ══════════════════════════════════════════════════════
