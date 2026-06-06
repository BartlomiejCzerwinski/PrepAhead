-- Fix finalize_generation_job: bypass RLS for definer-owned writes and inline usage increment.

create or replace function public.finalize_generation_job(
  p_job_id uuid,
  p_title text,
  p_cv_text text,
  p_content jsonb
)
returns table (
  job_id uuid,
  practice_set_id uuid,
  status text,
  usage_incremented boolean
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_user_id uuid := auth.uid();
  v_job public.generation_jobs%rowtype;
  v_usage_incremented boolean := false;
  v_anchor timestamptz;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_rows_updated integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if char_length(trim(coalesce(p_title, ''))) = 0 then
    raise exception 'Practice set title must not be empty' using errcode = '22023';
  end if;

  select gj.*
  into v_job
  from public.generation_jobs as gj
  where gj.id = p_job_id
    and gj.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Generation job not found for auth user' using errcode = 'P0002';
  end if;

  if v_job.status = 'succeeded' and v_job.finalized_at is not null then
    return query
    select
      v_job.id,
      v_job.practice_set_id,
      v_job.status,
      (v_job.usage_incremented_at is not null);
    return;
  end if;

  if v_job.status = 'failed' then
    raise exception 'Generation job already failed' using errcode = 'P0001';
  end if;

  update public.practice_sets as ps
  set
    title = p_title,
    cv_text = p_cv_text,
    content = p_content,
    deleted_at = null,
    updated_at = now()
  where ps.id = v_job.practice_set_id
    and ps.user_id = v_user_id;

  get diagnostics v_rows_updated = row_count;

  if v_rows_updated = 0 then
    raise exception 'Practice set not found for generation job' using errcode = 'P0002';
  end if;

  if v_job.usage_incremented_at is null then
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
      raise exception 'Could not resolve usage period for user' using errcode = 'P0001';
    end if;

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
      updated_at = now();

    v_usage_incremented := true;
  end if;

  update public.generation_jobs as gj
  set
    status = 'succeeded',
    failure_code = null,
    failure_message = null,
    finalized_at = coalesce(gj.finalized_at, now()),
    finished_at = coalesce(gj.finished_at, now()),
    usage_incremented_at = coalesce(
      gj.usage_incremented_at,
      case
        when v_usage_incremented then now()
        else null
      end
    )
  where gj.id = v_job.id;

  return query
  select
    v_job.id,
    v_job.practice_set_id,
    'succeeded'::text,
    ((v_job.usage_incremented_at is not null) or v_usage_incremented);
end;
$$;

comment on function public.finalize_generation_job(uuid, text, text, jsonb) is
  'Idempotently persists final practice-set content, increments generation usage once, and marks the durable job succeeded.';

revoke all on function public.finalize_generation_job(uuid, text, text, jsonb) from public;
revoke all on function public.finalize_generation_job(uuid, text, text, jsonb) from anon;
revoke all on function public.finalize_generation_job(uuid, text, text, jsonb) from service_role;
grant execute on function public.finalize_generation_job(uuid, text, text, jsonb) to authenticated;

create or replace function public.mark_generation_job_failed(
  p_job_id uuid,
  p_failure_code text,
  p_failure_message text
)
returns table (
  job_id uuid,
  practice_set_id uuid,
  status text
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_user_id uuid := auth.uid();
  v_job public.generation_jobs%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select gj.*
  into v_job
  from public.generation_jobs as gj
  where gj.id = p_job_id
    and gj.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Generation job not found for auth user' using errcode = 'P0002';
  end if;

  if v_job.status = 'succeeded' then
    return query
    select v_job.id, v_job.practice_set_id, v_job.status;
    return;
  end if;

  update public.generation_jobs as gj
  set
    status = 'failed',
    failure_code = left(trim(coalesce(p_failure_code, 'generation_failed')), 64),
    failure_message = left(trim(coalesce(p_failure_message, 'Generation failed.')), 240),
    finished_at = coalesce(gj.finished_at, now())
  where gj.id = v_job.id;

  return query
  select v_job.id, v_job.practice_set_id, 'failed'::text;
end;
$$;

comment on function public.mark_generation_job_failed(uuid, text, text) is
  'Marks a durable generation job failed without consuming generation usage.';

revoke all on function public.mark_generation_job_failed(uuid, text, text) from public;
revoke all on function public.mark_generation_job_failed(uuid, text, text) from anon;
revoke all on function public.mark_generation_job_failed(uuid, text, text) from service_role;
grant execute on function public.mark_generation_job_failed(uuid, text, text) to authenticated;
