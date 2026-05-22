alter table daily_food_entries
add column if not exists intake_time time;

create index if not exists daily_food_entries_user_id_date_time_idx on daily_food_entries(user_id, date, intake_time);
