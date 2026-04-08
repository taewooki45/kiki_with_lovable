-- 사용자 기본 데이터(닉네임/캐시/목표) + 일별 걸음수

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text,
  cash_balance numeric not null default 0,
  cash_per_step numeric not null default 0.5,
  goal_steps integer not null default 5000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_walk_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  walk_date date not null,
  steps integer not null default 0,
  goal_steps integer not null default 5000,
  updated_at timestamptz not null default now(),
  primary key (user_id, walk_date)
);

create index if not exists user_walk_daily_user_date_idx on public.user_walk_daily (user_id, walk_date desc);

alter table public.user_profiles enable row level security;
alter table public.user_walk_daily enable row level security;

drop policy if exists "user_profiles_select_own" on public.user_profiles;
create policy "user_profiles_select_own"
on public.user_profiles for select
using (auth.uid() = user_id);

drop policy if exists "user_profiles_insert_own" on public.user_profiles;
create policy "user_profiles_insert_own"
on public.user_profiles for insert
with check (auth.uid() = user_id);

drop policy if exists "user_profiles_update_own" on public.user_profiles;
create policy "user_profiles_update_own"
on public.user_profiles for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "user_walk_daily_select_own" on public.user_walk_daily;
create policy "user_walk_daily_select_own"
on public.user_walk_daily for select
using (auth.uid() = user_id);

drop policy if exists "user_walk_daily_insert_own" on public.user_walk_daily;
create policy "user_walk_daily_insert_own"
on public.user_walk_daily for insert
with check (auth.uid() = user_id);

drop policy if exists "user_walk_daily_update_own" on public.user_walk_daily;
create policy "user_walk_daily_update_own"
on public.user_walk_daily for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
