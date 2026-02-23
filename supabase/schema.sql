-- overlap-time MVP schema (Supabase / PostgreSQL)

create extension if not exists pgcrypto;

create table if not exists public.events (
  id text primary key,
  name text not null,
  timezone text not null default 'Asia/Tokyo',
  start_date date not null,
  end_date date not null,
  day_start_time time not null,
  day_end_time time not null,
  slot_minutes integer not null check (slot_minutes in (15, 30)),
  created_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (day_end_time > day_start_time)
);

create table if not exists public.participants (
  id text primary key,
  event_id text not null references public.events(id) on delete cascade,
  display_name text not null,
  edit_token_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.availabilities (
  event_id text not null references public.events(id) on delete cascade,
  participant_id text not null references public.participants(id) on delete cascade,
  date date not null,
  bitset text not null,
  updated_at timestamptz not null default now(),
  primary key (event_id, participant_id, date)
);

create index if not exists idx_participants_event_id on public.participants(event_id);
create index if not exists idx_availabilities_event_id on public.availabilities(event_id);
create index if not exists idx_availabilities_date on public.availabilities(date);

-- NOTE:
-- RLS policy should be added after deciding token handling strategy.
