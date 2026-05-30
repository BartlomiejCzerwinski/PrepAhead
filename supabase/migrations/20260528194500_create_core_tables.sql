-- F-02 Phase 2: profiles, user_settings, usage_periods + auth bootstrap trigger.
-- F-03 OAuth assumes handle_new_user() creates profile + settings on auth.users insert.
--
-- Rolling usage period (UTC): period_start inclusive, period_end exclusive.
-- Anchor = profiles.created_at (same clock time each cycle).
-- Example: anchor 2026-05-15 → [2026-05-15, 2026-06-15).
-- Month-end anchors use Postgres: anchor + n * interval '1 month' (e.g. Jan 31 → Feb 28/29).

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  plan_tier text not null default 'FREE',
  constraint profiles_plan_tier_check check (plan_tier in ('FREE', 'PRO'))
);

comment on table public.profiles is 'App user row keyed by Supabase Auth user id.';
comment on column public.profiles.created_at is 'Signup time; default anchor for rolling usage_periods.';

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- user_settings
-- ---------------------------------------------------------------------------

create table public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  theme text,
  updated_at timestamptz not null default now(),
  constraint user_settings_theme_check check (
    theme is null or theme in ('light', 'dark', 'system')
  )
);

comment on table public.user_settings is 'Per-user preferences (theme, etc.).';

alter table public.user_settings enable row level security;

create policy "user_settings_select_own"
  on public.user_settings
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "user_settings_insert_own"
  on public.user_settings
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "user_settings_update_own"
  on public.user_settings
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- usage_periods
-- ---------------------------------------------------------------------------

create table public.usage_periods (
  user_id uuid not null references public.profiles (id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  generation_count integer not null default 0,
  check_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, period_start),
  constraint usage_periods_period_bounds check (period_end > period_start),
  constraint usage_periods_generation_count_nonneg check (generation_count >= 0),
  constraint usage_periods_check_count_nonneg check (check_count >= 0)
);

comment on table public.usage_periods is 'Rolling monthly generation/Check counters per user.';
comment on column public.usage_periods.period_start is 'Inclusive start of this usage period (UTC).';
comment on column public.usage_periods.period_end is 'Exclusive start of next period (UTC).';

create index usage_periods_user_id_idx on public.usage_periods (user_id);

alter table public.usage_periods enable row level security;

-- Mutations only via SECURITY DEFINER RPCs (Phase 4); users may read own rows only.
create policy "usage_periods_select_own"
  on public.usage_periods
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- updated_at helper (user_settings)
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auth bootstrap: profile + default settings on signup
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, created_at, plan_tier)
  values (new.id, now(), 'FREE');

  insert into public.user_settings (user_id, updated_at)
  values (new.id, now());

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Creates profiles + user_settings when auth.users row is inserted. Required for F-03 OAuth.';

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Grants (authenticated = user JWT; service_role bypasses RLS)
-- ---------------------------------------------------------------------------

grant select, update on table public.profiles to authenticated;
grant select, insert, update on table public.user_settings to authenticated;
grant select on table public.usage_periods to authenticated;
