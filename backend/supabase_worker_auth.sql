-- Cloudflare Worker auth
-- Crea la tabla de sesiones propias del Worker.

create table if not exists public.worker_sessions (
  token_hash text primary key,
  role text not null,
  user_id text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists worker_sessions_user_id_idx
on public.worker_sessions (user_id);

create index if not exists worker_sessions_expires_at_idx
on public.worker_sessions (expires_at);

alter table public.worker_sessions enable row level security;

drop policy if exists "vf_public_read_worker_sessions" on public.worker_sessions;

revoke all on table public.worker_sessions from anon, authenticated;
