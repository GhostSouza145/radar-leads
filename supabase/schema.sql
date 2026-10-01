-- Radar de Leads — schema. Idempotente: pode rodar mais de uma vez.

create extension if not exists pgcrypto;

create table if not exists public.settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  seller_name text,
  company text,
  offer text,
  differentials text,
  tone text not null default 'consultivo',
  cta text,
  maps_provider text not null default 'google',
  google_places_key text,
  serper_key text,
  anthropic_key text,
  ai_model text not null default 'claude-opus-5-5',
  webhook_url text,
  updated_at timestamptz not null default now()
);

create table if not exists public.monitors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source text not null check (source in ('maps', 'cnpj')),
  label text not null,
  params jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  last_run_at timestamptz,
  last_new integer,
  last_error text,
  created_at timestamptz not null default now()
);

create table if not exists public.searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source text not null check (source in ('maps', 'cnpj')),
  label text not null,
  params jsonb not null default '{}'::jsonb,
  total_found integer not null default 0,
  new_leads integer not null default 0,
  monitor_id uuid references public.monitors (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source text not null check (source in ('maps', 'cnpj', 'manual')),
  external_id text not null,
  name text not null,
  category text,
  address text,
  city text,
  state text,
  phone text,
  email text,
  website text,
  instagram text,
  maps_url text,
  rating numeric(2, 1),
  reviews_count integer,
  cnpj text,
  opened_at date,
  extra jsonb not null default '{}'::jsonb,
  status text not null default 'novo'
    check (status in ('novo', 'contatado', 'respondeu', 'reuniao', 'fechado', 'perdido')),
  score integer,
  signals jsonb not null default '[]'::jsonb,
  site_data jsonb,
  instagram_data jsonb,
  diagnosis text,
  pitch_whatsapp text,
  pitch_email_subject text,
  pitch_email_body text,
  pitch_by_ai boolean not null default false,
  analyzed_at timestamptz,
  notes text,
  search_id uuid references public.searches (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);

create index if not exists leads_user_created_idx on public.leads (user_id, created_at desc);
create index if not exists leads_user_status_idx on public.leads (user_id, status);
create index if not exists leads_user_score_idx on public.leads (user_id, score desc nulls last);
create index if not exists searches_user_created_idx on public.searches (user_id, created_at desc);

-- App de um dono só: depois da primeira conta, ninguém mais consegue se cadastrar,
-- nem chamando a API de autenticação do Supabase diretamente com a chave pública.
create or replace function public.single_owner_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from auth.users) then
    raise exception 'Cadastro fechado: este app já tem um dono.';
  end if;
  return new;
end $$;

drop trigger if exists single_owner_guard on auth.users;
create trigger single_owner_guard before insert on auth.users
  for each row execute function public.single_owner_guard();

alter table public.settings enable row level security;
alter table public.monitors enable row level security;
alter table public.searches enable row level security;
alter table public.leads enable row level security;

drop policy if exists "owner" on public.settings;
create policy "owner" on public.settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "owner" on public.monitors;
create policy "owner" on public.monitors for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "owner" on public.searches;
create policy "owner" on public.searches for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "owner" on public.leads;
create policy "owner" on public.leads for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
