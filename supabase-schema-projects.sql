-- ─── HKEX WorkSpace — Projects Schema ───────────────────────────────────────
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- projects_data: a single shared table of project tiers, editable by admins only.
-- All authenticated users can read it; only admins can write it.
-- Data is stored as a JSONB array of project objects.

create table if not exists public.projects_data (
  id          int primary key default 1 check (id = 1),  -- singleton row
  data        jsonb not null default '[]',
  updated_at  timestamptz not null default now()
);

alter table public.projects_data enable row level security;

-- Any authenticated user can read the projects table
create policy "Projects: authenticated read" on public.projects_data
  for select using (auth.uid() is not null);

-- Only admins can insert or update
create policy "Projects: admin write" on public.projects_data
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Seed the default 4 rows
insert into public.projects_data (id, data) values (1, '[
  {"name":"Bronze",  "value":3500,  "period":13, "roi_pct":68, "roi_usd":2380,  "final_equity":5880},
  {"name":"Silver",  "value":10000, "period":11, "roi_pct":72, "roi_usd":7200,  "final_equity":17200},
  {"name":"Gold",    "value":25000, "period":10, "roi_pct":74, "roi_usd":18500, "final_equity":43500},
  {"name":"Platinum","value":50000, "period":9,  "roi_pct":77, "roi_usd":38500, "final_equity":88500}
]')
on conflict (id) do nothing;
