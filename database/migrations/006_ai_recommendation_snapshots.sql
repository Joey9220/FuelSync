create table if not exists ai_recommendation_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  created_at timestamptz default now(),
  input_json jsonb not null,
  output_json jsonb not null,
  model text not null,
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  applied boolean not null default false
);

create index if not exists ai_recommendation_snapshots_user_created_idx
on ai_recommendation_snapshots(user_id, created_at desc);
