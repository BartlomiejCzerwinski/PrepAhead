-- increment_check_usage must bypass RLS on usage_periods (writes are RPC-only).
-- Without row_security = off the upsert silently fails under RLS, matching the
-- generation finalize fix in 20260606161500_fix_finalize_generation_job.sql.

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

comment on function public.increment_check_usage() is
  'Atomically increment check_count for auth.uid() in the current rolling period.';

revoke all on function public.increment_check_usage() from public;
revoke all on function public.increment_check_usage() from anon;
revoke all on function public.increment_check_usage() from service_role;
grant execute on function public.increment_check_usage() to authenticated;
