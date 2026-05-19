create table if not exists withings_connections (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  withings_user_id text,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  measured_at timestamptz not null,
  weight_kg numeric,
  fat_mass_kg numeric,
  fat_percentage numeric,
  muscle_mass_kg numeric,
  bone_mass_kg numeric,
  fat_free_mass_kg numeric,
  source text not null default 'withings',
  source_measure_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint body_metrics_unique_measure unique (user_id, measured_at, source)
);

create index if not exists body_metrics_user_id_measured_at_idx on body_metrics(user_id, measured_at desc);

drop trigger if exists withings_connections_set_updated_at on withings_connections;
create trigger withings_connections_set_updated_at
before update on withings_connections
for each row execute function set_updated_at();

drop trigger if exists body_metrics_set_updated_at on body_metrics;
create trigger body_metrics_set_updated_at
before update on body_metrics
for each row execute function set_updated_at();
