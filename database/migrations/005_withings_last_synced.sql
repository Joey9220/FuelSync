alter table withings_connections
add column if not exists last_synced_at timestamptz;
