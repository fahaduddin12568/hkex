-- ─── HKEX WorkSpace — Supabase Schema ────────────────────────────────────────
-- Run this entire file in: Supabase Dashboard → SQL Editor → New Query → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. PROFILES TABLE
--    Stores user display names, roles and balance.
--    Linked 1-to-1 with Supabase Auth (auth.users).
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text        not null,
  role        text        not null default 'user' check (role in ('admin','user')),
  balance     numeric     not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Admins can read all profiles; users can only read their own
create policy "Profiles: admin read all" on public.profiles
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "Profiles: user read own" on public.profiles
  for select using (auth.uid() = id);

-- Only admins can insert/update profiles (user creation goes through admin panel)
create policy "Profiles: admin write" on public.profiles
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );


-- 2. TABLE_DATA TABLE
--    Stores the full 25-row × 9-col grid for each user as a JSONB array.
create table if not exists public.table_data (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  data        jsonb not null default '[]',
  updated_at  timestamptz not null default now()
);

create unique index if not exists table_data_user_idx on public.table_data(user_id);

alter table public.table_data enable row level security;

-- Users can read/write their own data; admins can read/write all
create policy "TableData: user own" on public.table_data
  for all using (auth.uid() = user_id);

create policy "TableData: admin all" on public.table_data
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );


-- 3. PRESENCE TABLE
--    Lightweight heartbeat table — one row per user, upserted on heartbeat.
create table if not exists public.presence (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  last_seen  timestamptz not null default now()
);

alter table public.presence enable row level security;

create policy "Presence: user write own" on public.presence
  for all using (auth.uid() = user_id);

create policy "Presence: admin read all" on public.presence
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );


-- 4. SEED ADMIN USER
--    After running this schema, create the admin user in:
--    Supabase Dashboard → Authentication → Users → Invite user
--    Email: admin@hkex.com  Password: admin123
--    Then paste the resulting UUID below and run:

-- insert into public.profiles (id, name, role, balance)
-- values ('<paste-admin-uuid-here>', 'Administrator', 'admin', 0);
