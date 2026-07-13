-- Pickleball Player & Game Management — Supabase schema
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run).
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE / drop-then-create for policies.

-- ============================================================================
-- Extensions
-- ============================================================================
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ============================================================================
-- Tables
-- ============================================================================

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nickname text,
  photo_url text,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  contact_number text,
  url text,
  email text,
  created_at timestamptz not null default now()
);

-- Adds columns when re-running this script against a database created
-- before those columns existed.
alter table players add column if not exists email text;
alter table players add column if not exists phone text;
alter table venues add column if not exists location text;
alter table venues add column if not exists contact_number text;
alter table venues add column if not exists url text;
alter table venues add column if not exists email text;

create table if not exists game_days (
  id uuid primary key default gen_random_uuid(),
  session_date date not null,
  num_matches integer not null check (num_matches > 0),
  status text not null default 'setup' check (status in ('setup', 'in_progress', 'completed')),
  started_at timestamptz,
  ended_at timestamptz,
  venue_id uuid references venues (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Adds columns when re-running this script against a database created
-- before those columns existed.
alter table game_days add column if not exists started_at timestamptz;
alter table game_days add column if not exists ended_at timestamptz;
alter table game_days add column if not exists venue_id uuid references venues (id) on delete set null;

create table if not exists game_day_players (
  id uuid primary key default gen_random_uuid(),
  game_day_id uuid not null references game_days (id) on delete cascade,
  player_id uuid not null references players (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (game_day_id, player_id)
);

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  game_day_id uuid not null references game_days (id) on delete cascade,
  match_number integer not null,
  team1_player1_id uuid references players (id) on delete set null,
  team1_player2_id uuid references players (id) on delete set null,
  team2_player1_id uuid references players (id) on delete set null,
  team2_player2_id uuid references players (id) on delete set null,
  team1_score integer,
  team2_score integer,
  winner_team integer check (winner_team in (1, 2)),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'cancelled')),
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  created_at timestamptz not null default now(),
  unique (game_day_id, match_number)
);

-- Widens the status check when re-running this script against a database
-- created before 'cancelled' existed (used when a game day auto-ends after
-- 4 hours and some matches never got a final score — see
-- src/lib/game-day-lifecycle.ts).
alter table matches drop constraint if exists matches_status_check;
alter table matches add constraint matches_status_check
  check (status in ('pending', 'in_progress', 'completed', 'cancelled'));

create index if not exists idx_game_day_players_game_day on game_day_players (game_day_id);
create index if not exists idx_game_day_players_player on game_day_players (player_id);
create index if not exists idx_matches_game_day on matches (game_day_id);
create index if not exists idx_game_days_venue on game_days (venue_id);

-- A planned future session: date, time, venue, and roster set in advance.
-- promoted_game_day_id is null until src/lib/scheduled-game-day-promotion.ts
-- turns it into a real game_days row at its scheduled time — it then both
-- marks the session as done and links to the resulting game day. Cascading
-- the delete (rather than setting null) matters: a past-due session with a
-- null promoted_game_day_id looks unpromoted again, so if it weren't
-- cascaded, deleting the game day would make the lazy promotion check
-- recreate it on the next page load.
create table if not exists scheduled_game_days (
  id uuid primary key default gen_random_uuid(),
  session_date date not null,
  session_time time not null,
  num_matches integer not null default 12 check (num_matches > 0),
  venue_id uuid references venues (id) on delete set null,
  promoted_game_day_id uuid references game_days (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists scheduled_game_day_players (
  scheduled_game_day_id uuid not null references scheduled_game_days (id) on delete cascade,
  player_id uuid not null references players (id) on delete cascade,
  primary key (scheduled_game_day_id, player_id)
);

create index if not exists idx_scheduled_game_days_date on scheduled_game_days (session_date);
create index if not exists idx_scheduled_game_day_players_scheduled on scheduled_game_day_players (scheduled_game_day_id);

-- ============================================================================
-- Row Level Security
-- Any authenticated user may read everything (view access). Running a game
-- day — creating one, adding/removing existing players on its roster,
-- generating the schedule, and starting/ending matches — is also open to
-- any signed-in user; registering a brand-new player, deleting a game
-- day, and managing players/venues outside the roster flow, require the
-- admin role. A user's role lives in their JWT's app_metadata.role;
-- missing/null defaults to admin, so accounts that existed before roles
-- were introduced keep full access without needing a
-- data migration.
-- ============================================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'admin') = 'admin';
$$;

alter table players enable row level security;
alter table venues enable row level security;
alter table game_days enable row level security;
alter table game_day_players enable row level security;
alter table matches enable row level security;

drop policy if exists "authenticated full access" on players;
drop policy if exists "authenticated read" on players;
drop policy if exists "admin write" on players;
drop policy if exists "authenticated insert" on players;
create policy "authenticated read" on players
  for select using (auth.uid() is not null);
-- Registering a brand-new player (from the Players page or the game-day
-- roster panel's "Register a new player" flow) stays admin-only.
create policy "admin write" on players
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "authenticated full access" on venues;
drop policy if exists "authenticated read" on venues;
drop policy if exists "admin write" on venues;
create policy "authenticated read" on venues
  for select using (auth.uid() is not null);
create policy "admin write" on venues
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "authenticated full access" on game_days;
drop policy if exists "authenticated read" on game_days;
drop policy if exists "admin write" on game_days;
drop policy if exists "authenticated insert" on game_days;
drop policy if exists "authenticated update" on game_days;
create policy "authenticated read" on game_days
  for select using (auth.uid() is not null);
-- Any signed-in user can create and run a session (starting/ending matches
-- updates status, started_at, ended_at); deleting one stays admin-only via
-- "admin write" below.
create policy "authenticated insert" on game_days
  for insert with check (auth.uid() is not null);
create policy "authenticated update" on game_days
  for update using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "admin write" on game_days
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "authenticated full access" on game_day_players;
drop policy if exists "authenticated read" on game_day_players;
drop policy if exists "admin write" on game_day_players;
drop policy if exists "authenticated write" on game_day_players;
create policy "authenticated read" on game_day_players
  for select using (auth.uid() is not null);
-- Roster membership is managed by anyone who can run a game day.
create policy "authenticated write" on game_day_players
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "authenticated full access" on matches;
drop policy if exists "authenticated read" on matches;
drop policy if exists "admin write" on matches;
drop policy if exists "authenticated write" on matches;
create policy "authenticated read" on matches
  for select using (auth.uid() is not null);
-- Generating/regenerating the schedule and starting/ending matches are
-- available to anyone who can run a game day.
create policy "authenticated write" on matches
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

alter table scheduled_game_days enable row level security;
alter table scheduled_game_day_players enable row level security;

drop policy if exists "authenticated read" on scheduled_game_days;
drop policy if exists "authenticated write" on scheduled_game_days;
create policy "authenticated read" on scheduled_game_days
  for select using (auth.uid() is not null);
-- Scheduling a session is open to any signed-in user, same as creating a
-- game day directly.
create policy "authenticated write" on scheduled_game_days
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "authenticated read" on scheduled_game_day_players;
drop policy if exists "authenticated write" on scheduled_game_day_players;
create policy "authenticated read" on scheduled_game_day_players
  for select using (auth.uid() is not null);
create policy "authenticated write" on scheduled_game_day_players
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ============================================================================
-- Statistics views
-- Unpivot the 4 player slots per match into one row per (match, player),
-- then derive per-player and per-partnership win/loss aggregates.
-- security_invoker ensures the views respect the RLS policies above for
-- whichever user queries them, rather than running as the view owner.
-- ============================================================================

create or replace view match_player_results
  with (security_invoker = true) as
select m.id as match_id, m.game_day_id, m.match_number, m.status,
       m.started_at, m.ended_at, m.duration_seconds,
       1 as team_number, m.team1_player1_id as player_id,
       m.team1_player2_id as partner_id, (m.winner_team = 1) as won
from matches m
where m.team1_player1_id is not null
union all
select m.id, m.game_day_id, m.match_number, m.status,
       m.started_at, m.ended_at, m.duration_seconds,
       1, m.team1_player2_id, m.team1_player1_id, (m.winner_team = 1)
from matches m
where m.team1_player2_id is not null
union all
select m.id, m.game_day_id, m.match_number, m.status,
       m.started_at, m.ended_at, m.duration_seconds,
       2, m.team2_player1_id, m.team2_player2_id, (m.winner_team = 2)
from matches m
where m.team2_player1_id is not null
union all
select m.id, m.game_day_id, m.match_number, m.status,
       m.started_at, m.ended_at, m.duration_seconds,
       2, m.team2_player2_id, m.team2_player1_id, (m.winner_team = 2)
from matches m
where m.team2_player2_id is not null;

create or replace view player_stats
  with (security_invoker = true) as
select
  p.id as player_id,
  p.name,
  p.nickname,
  count(r.match_id) filter (where r.status = 'completed') as matches_played,
  count(r.match_id) filter (where r.status = 'completed' and r.won) as wins,
  count(r.match_id) filter (where r.status = 'completed' and not r.won) as losses
from players p
left join match_player_results r on r.player_id = p.id
group by p.id, p.name, p.nickname;

create or replace view partnership_stats
  with (security_invoker = true) as
select
  least(r.player_id, r.partner_id) as player_a_id,
  greatest(r.player_id, r.partner_id) as player_b_id,
  count(*) filter (where r.status = 'completed') / 2 as matches_played,
  count(*) filter (where r.status = 'completed' and r.won) / 2 as wins,
  count(*) filter (where r.status = 'completed' and not r.won) / 2 as losses
from match_player_results r
where r.partner_id is not null
group by least(r.player_id, r.partner_id), greatest(r.player_id, r.partner_id);

-- ============================================================================
-- Storage bucket for player photos
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('player-photos', 'player-photos', true)
on conflict (id) do nothing;

drop policy if exists "player photos public read" on storage.objects;
create policy "player photos public read" on storage.objects
  for select using (bucket_id = 'player-photos');

drop policy if exists "player photos authenticated write" on storage.objects;
drop policy if exists "player photos admin write" on storage.objects;
create policy "player photos admin write" on storage.objects
  for insert with check (bucket_id = 'player-photos' and public.is_admin());

drop policy if exists "player photos authenticated update" on storage.objects;
drop policy if exists "player photos admin update" on storage.objects;
create policy "player photos admin update" on storage.objects
  for update using (bucket_id = 'player-photos' and public.is_admin());

drop policy if exists "player photos authenticated delete" on storage.objects;
drop policy if exists "player photos admin delete" on storage.objects;
create policy "player photos admin delete" on storage.objects
  for delete using (bucket_id = 'player-photos' and public.is_admin());
