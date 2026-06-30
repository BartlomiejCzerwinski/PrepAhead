-- S-05 Phase 1: Stripe billing columns, webhook idempotency, daily usage, RLS hardening.

-- ---------------------------------------------------------------------------
-- profiles: Stripe identifiers and grace-period state
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column stripe_customer_id text,
  add column stripe_subscription_id text,
  add column subscription_grace_ends_at timestamptz;

alter table public.profiles
  add constraint profiles_stripe_customer_id_key unique (stripe_customer_id),
  add constraint profiles_stripe_subscription_id_key unique (stripe_subscription_id);

create index profiles_stripe_customer_id_idx on public.profiles (stripe_customer_id);

comment on column public.profiles.stripe_customer_id is 'Stripe Customer id; set on first checkout.';
comment on column public.profiles.stripe_subscription_id is 'Active Stripe Subscription id; cleared on downgrade.';
comment on column public.profiles.subscription_grace_ends_at is 'PRO grace end after invoice.payment_failed; cleared on invoice.paid.';

-- ---------------------------------------------------------------------------
-- stripe_webhook_events: idempotent webhook processing (service role only)
-- ---------------------------------------------------------------------------

create table public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

comment on table public.stripe_webhook_events is 'Processed Stripe webhook event ids for deduplication.';

revoke all on table public.stripe_webhook_events from public;
revoke all on table public.stripe_webhook_events from anon;
revoke all on table public.stripe_webhook_events from authenticated;
grant all on table public.stripe_webhook_events to service_role;

-- ---------------------------------------------------------------------------
-- usage_daily: PRO fair-use daily generation counter (UTC calendar day)
-- ---------------------------------------------------------------------------

create table public.usage_daily (
  user_id uuid not null references public.profiles (id) on delete cascade,
  usage_date date not null,
  generation_count integer not null default 0,
  primary key (user_id, usage_date),
  constraint usage_daily_generation_count_nonneg check (generation_count >= 0)
);

comment on table public.usage_daily is 'Per-user daily generation count for PRO fair-use cap (UTC date).';
comment on column public.usage_daily.usage_date is 'UTC calendar date: (now() at time zone ''utc'')::date.';

alter table public.usage_daily enable row level security;

create policy "usage_daily_select_own"
  on public.usage_daily
  for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke insert, update, delete on table public.usage_daily from authenticated;
grant select on table public.usage_daily to authenticated;

-- ---------------------------------------------------------------------------
-- RLS hardening: users must not self-promote plan_tier or mutate Stripe columns
-- ---------------------------------------------------------------------------

drop policy if exists "profiles_update_own" on public.profiles;

revoke update on table public.profiles from authenticated;

-- ---------------------------------------------------------------------------
-- set_plan_tier_from_billing: server-only tier sync for Stripe webhooks
-- ---------------------------------------------------------------------------

create or replace function public.set_plan_tier_from_billing(
  p_user_id uuid,
  p_plan_tier text,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_grace_ends_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_plan_tier not in ('FREE', 'PRO') then
    raise exception 'Invalid plan tier: %', p_plan_tier;
  end if;

  update public.profiles
  set
    plan_tier = p_plan_tier,
    stripe_customer_id = p_stripe_customer_id,
    stripe_subscription_id = p_stripe_subscription_id,
    subscription_grace_ends_at = p_grace_ends_at
  where id = p_user_id;

  if not found then
    raise exception 'Profile not found for user %', p_user_id using errcode = 'P0002';
  end if;
end;
$$;

comment on function public.set_plan_tier_from_billing(uuid, text, text, text, timestamptz) is
  'Updates plan tier and Stripe billing fields. Callable by service_role only (webhook handler).';

revoke all on function public.set_plan_tier_from_billing(uuid, text, text, text, timestamptz) from public;
revoke all on function public.set_plan_tier_from_billing(uuid, text, text, text, timestamptz) from anon;
revoke all on function public.set_plan_tier_from_billing(uuid, text, text, text, timestamptz) from authenticated;
grant execute on function public.set_plan_tier_from_billing(uuid, text, text, text, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- get_current_usage_summary: add daily_generation_count + period_generation_count
-- ---------------------------------------------------------------------------

create or replace function public.get_current_usage_summary()
returns table (
  plan_tier text,
  period_start timestamptz,
  period_end timestamptz,
  generation_count integer,
  check_count integer,
  daily_generation_count integer,
  period_generation_count integer
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
  v_period_generation integer;
  v_period_check integer;
  v_daily_generation integer;
  v_utc_today date := (now() at time zone 'utc')::date;
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

  select coalesce(up.generation_count, 0), coalesce(up.check_count, 0)
  into v_period_generation, v_period_check
  from (values (1)) as dummy(x)
  left join public.usage_periods as up
    on up.user_id = v_user_id
   and up.period_start = v_period_start;

  select coalesce(ud.generation_count, 0)
  into v_daily_generation
  from (values (1)) as dummy(x)
  left join public.usage_daily as ud
    on ud.user_id = v_user_id
   and ud.usage_date = v_utc_today;

  return query
  select
    v_plan_tier,
    v_period_start,
    v_period_end,
    v_period_generation,
    v_period_check,
    v_daily_generation,
    v_period_generation;
end;
$$;

comment on function public.get_current_usage_summary() is
  'Returns plan tier, rolling-period usage, and UTC daily generation count for auth.uid().';

revoke all on function public.get_current_usage_summary() from public;
revoke all on function public.get_current_usage_summary() from anon;
revoke all on function public.get_current_usage_summary() from service_role;
grant execute on function public.get_current_usage_summary() to authenticated;
