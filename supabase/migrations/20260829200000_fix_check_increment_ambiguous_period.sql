-- Fix 42702: RETURNS TABLE column names (period_start, etc.) shadow usage_periods
-- columns inside ON CONFLICT. Prefer table columns for unqualified names.

create or replace function public.increment_check_usage_for_user(p_user_id uuid)
returns table (
  period_start timestamptz,
  period_end timestamptz,
  generation_count integer,
  check_count integer
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
#variable_conflict use_column
declare
  v_anchor timestamptz;
  v_period_start timestamptz;
  v_period_end timestamptz;
begin
  if p_user_id is null then
    raise exception 'User id is required' using errcode = '22023';
  end if;

  select p.created_at
  into v_anchor
  from public.profiles as p
  where p.id = p_user_id;

  if not found then
    raise exception 'Profile not found for user %', p_user_id using errcode = 'P0002';
  end if;

  select b.period_start, b.period_end
  into v_period_start, v_period_end
  from public.current_usage_period_bounds(v_anchor) as b;

  if v_period_start is null then
    raise exception 'Could not resolve usage period for user %', p_user_id using errcode = 'P0001';
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
  values (p_user_id, v_period_start, v_period_end, 0, 1, now())
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
set row_security = off
as $$
#variable_conflict use_column
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

revoke all on function public.increment_check_usage_for_user(uuid) from public;
revoke all on function public.increment_check_usage_for_user(uuid) from anon;
revoke all on function public.increment_check_usage_for_user(uuid) from authenticated;
grant execute on function public.increment_check_usage_for_user(uuid) to service_role;

revoke all on function public.increment_check_usage() from public;
revoke all on function public.increment_check_usage() from anon;
revoke all on function public.increment_check_usage() from service_role;
grant execute on function public.increment_check_usage() to authenticated;

notify pgrst, 'reload schema';
