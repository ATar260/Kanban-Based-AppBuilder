-- Usage tracking persistence (monthly counters)
-- Run this in Supabase SQL Editor.

create table if not exists public.usage_monthly (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  period text not null, -- YYYY-MM

  ai_generations integer not null default 0,
  sandbox_seconds integer not null default 0,

  last_sandbox_ping_at timestamptz,
  last_sandbox_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, period)
);

create index if not exists usage_monthly_user_period_idx
  on public.usage_monthly (user_id, period);

alter table public.usage_monthly enable row level security;

-- No RLS policies are created here:
-- - The app writes/reads usage from server-side API routes using SUPABASE_SERVICE_ROLE_KEY.
-- - This prevents clients from directly reading/writing usage counters.

