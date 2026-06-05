-- S-01: authenticated read RPC for current usage period summary.
-- Reuses current_usage_period_bounds() so period math stays in Postgres.

create or replace function public.get_current_usage_summary()
returns table (
  plan_tier text,
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
  v_plan_tier text;
  v_period_start timestamptz;
  v_period_end timestamptz;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select p.created_at, p.plan_tier
  into v_anchor, v_plan_tier
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
  select
    v_plan_tier,
    v_period_start,
    v_period_end,
    coalesce(up.generation_count, 0)::integer,
    coalesce(up.check_count, 0)::integer
  from (values (1)) as dummy(x)
  left join public.usage_periods as up
    on up.user_id = v_user_id
   and up.period_start = v_period_start;
end;
$$;

comment on function public.get_current_usage_summary() is
  'Returns plan tier and current rolling-period usage for auth.uid(). Zero counts when no usage_periods row exists yet.';

revoke all on function public.get_current_usage_summary() from public;
revoke all on function public.get_current_usage_summary() from anon;
revoke all on function public.get_current_usage_summary() from service_role;
grant execute on function public.get_current_usage_summary() to authenticated;
