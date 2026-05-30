-- F-02 Phase 4: RLS inventory + atomic usage increment RPCs.
--
-- RLS enabled (verified in prior migrations):
--   profiles       — select/update own
--   user_settings  — select/insert/update own
--   usage_periods  — select own; writes via RPC only
--   practice_sets  — select/insert/update own
--
-- Rolling period (UTC): period_start inclusive, period_end exclusive.
-- Anchor = profiles.created_at; bounds via anchor + n * interval '1 month'.

-- ---------------------------------------------------------------------------
-- Internal: resolve current usage period for an anchor timestamp
-- ---------------------------------------------------------------------------

create or replace function public.current_usage_period_bounds(p_anchor timestamptz)
returns table (period_start timestamptz, period_end timestamptz)
language sql
stable
set search_path = public
as $$
  select p.period_start, p.period_end
  from (
    select
      p_anchor + (n * interval '1 month') as period_start,
      p_anchor + ((n + 1) * interval '1 month') as period_end
    from generate_series(0, 1200) as n
  ) as p
  where p.period_start <= now()
    and now() < p.period_end
  limit 1;
$$;

comment on function public.current_usage_period_bounds(timestamptz) is
  'Returns rolling period bounds for p_anchor. Internal; called by usage increment RPCs.';

revoke all on function public.current_usage_period_bounds(timestamptz) from public;
revoke all on function public.current_usage_period_bounds(timestamptz) from anon;
revoke all on function public.current_usage_period_bounds(timestamptz) from authenticated;
revoke all on function public.current_usage_period_bounds(timestamptz) from service_role;

-- ---------------------------------------------------------------------------
-- increment_generation_usage()
-- ---------------------------------------------------------------------------

create or replace function public.increment_generation_usage()
returns table (
  period_start timestamptz,
  period_end timestamptz,
  generation_count integer,
  check_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_anchor timestamptz;
  v_period_start timestamptz;
  v_period_end timestamptz;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select p.created_at
  into v_anchor
  from public.profiles as p
  where p.id = v_user_id;

  if not found then
    raise exception 'Profile not found for auth user' using errcode = 'P0002';
  end if;

  select b.period_start, b.period_end
  into v_period_start, v_period_end
  from public.current_usage_period_bounds(v_anchor) as b;

  if v_period_start is null then
    raise exception 'Could not resolve usage period for anchor %', v_anchor;
  end if;

  return query
  insert into public.usage_periods as up (
    user_id,
    period_start,
    period_end,
    generation_count,
    check_count,
    updated_at
  )
  values (v_user_id, v_period_start, v_period_end, 1, 0, now())
  on conflict (user_id, period_start)
  do update set
    generation_count = up.generation_count + 1,
    updated_at = now()
  returning
    up.period_start,
    up.period_end,
    up.generation_count,
    up.check_count;
end;
$$;

comment on function public.increment_generation_usage() is
  'Atomically increment generation_count for auth.uid() in the current rolling period.';

revoke all on function public.increment_generation_usage() from public;
revoke all on function public.increment_generation_usage() from anon;
revoke all on function public.increment_generation_usage() from service_role;
grant execute on function public.increment_generation_usage() to authenticated;

-- ---------------------------------------------------------------------------
-- increment_check_usage()
-- ---------------------------------------------------------------------------

create or replace function public.increment_check_usage()
returns table (
  period_start timestamptz,
  period_end timestamptz,
  generation_count integer,
  check_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_anchor timestamptz;
  v_period_start timestamptz;
  v_period_end timestamptz;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select p.created_at
  into v_anchor
  from public.profiles as p
  where p.id = v_user_id;

  if not found then
    raise exception 'Profile not found for auth user' using errcode = 'P0002';
  end if;

  select b.period_start, b.period_end
  into v_period_start, v_period_end
  from public.current_usage_period_bounds(v_anchor) as b;

  if v_period_start is null then
    raise exception 'Could not resolve usage period for anchor %', v_anchor;
  end if;

  return query
  insert into public.usage_periods as up (
    user_id,
    period_start,
    period_end,
    generation_count,
    check_count,
    updated_at
  )
  values (v_user_id, v_period_start, v_period_end, 0, 1, now())
  on conflict (user_id, period_start)
  do update set
    check_count = up.check_count + 1,
    updated_at = now()
  returning
    up.period_start,
    up.period_end,
    up.generation_count,
    up.check_count;
end;
$$;

comment on function public.increment_check_usage() is
  'Atomically increment check_count for auth.uid() in the current rolling period.';

revoke all on function public.increment_check_usage() from public;
revoke all on function public.increment_check_usage() from anon;
revoke all on function public.increment_check_usage() from service_role;
grant execute on function public.increment_check_usage() to authenticated;

-- usage_periods: authenticated may read only (no direct insert/update/delete grants).
revoke insert, update, delete on table public.usage_periods from authenticated;
