-- Run this in your Supabase SQL Editor

create table leagues (
  id text primary key,
  name text not null,
  scoring_type text check (scoring_type in ('americano', 'traditional')) not null default 'americano',
  created_at timestamptz default now()
);

-- Migration (run this if the table already exists):
-- alter table leagues add column scoring_type text check (scoring_type in ('americano', 'traditional')) not null default 'americano';

create table players (
  id uuid primary key default gen_random_uuid(),
  league_id text references leagues(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now(),
  unique (league_id, name)
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  league_id text references leagues(id) on delete cascade not null,
  date date not null default current_date,
  label text,
  excluded boolean default false,
  created_at timestamptz default now()
);

-- Migration (run this if the table already exists):
-- alter table sessions add column excluded boolean default false;
-- alter table sessions add column short_id text unique;

create table matches (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade not null,
  scoring_type text check (scoring_type in ('americano', 'traditional')) not null,
  team1_p1 uuid references players(id) not null,
  team1_p2 uuid references players(id) not null,
  team2_p1 uuid references players(id) not null,
  team2_p2 uuid references players(id) not null,
  team1_score integer not null check (team1_score >= 0),
  team2_score integer not null check (team2_score >= 0),
  created_at timestamptz default now()
);

create table session_signups (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade not null,
  player_id uuid references players(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (session_id, player_id)
);

-- Migration (run this if the table already exists):
-- create table session_signups (
--   id uuid primary key default gen_random_uuid(),
--   session_id uuid references sessions(id) on delete cascade not null,
--   player_id uuid references players(id) on delete cascade not null,
--   created_at timestamptz default now(),
--   unique (session_id, player_id)
-- );

-- Enable Row Level Security (open read/write via anon key — link = access)
alter table leagues enable row level security;
alter table players enable row level security;
alter table sessions enable row level security;
alter table matches enable row level security;

create policy "Public access" on leagues for all using (true) with check (true);
create policy "Public access" on players for all using (true) with check (true);
create policy "Public access" on sessions for all using (true) with check (true);
create policy "Public access" on matches for all using (true) with check (true);
alter table session_signups enable row level security;
create policy "Public access" on session_signups for all using (true) with check (true);
