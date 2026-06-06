create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  practice_set_id uuid not null references public.practice_sets (id) on delete cascade,
  idempotency_key text not null,
  status text not null default 'queued',
  failure_code text,
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  claimed_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  finalized_at timestamptz,
  usage_incremented_at timestamptz,
  constraint generation_jobs_status_check
    check (status in ('queued', 'running', 'succeeded', 'failed')),
  constraint generation_jobs_idempotency_key_nonempty
    check (char_length(trim(idempotency_key)) > 0),
  constraint generation_jobs_user_idempotency_key_key
    unique (user_id, idempotency_key),
  constraint generation_jobs_practice_set_id_key
    unique (practice_set_id)
);

comment on table public.generation_jobs is
  'Durable async generation jobs for JD-grounded practice-set creation.';
comment on column public.generation_jobs.failure_message is
  'Sanitized internal failure summary. Do not store raw JD/CV or provider payloads.';

create index generation_jobs_user_created_idx
  on public.generation_jobs (user_id, created_at desc);

create index generation_jobs_status_created_idx
  on public.generation_jobs (status, created_at asc);

alter table public.generation_jobs enable row level security;

create policy "generation_jobs_select_own"
  on public.generation_jobs
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "generation_jobs_insert_own"
  on public.generation_jobs
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "generation_jobs_update_own"
  on public.generation_jobs
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create trigger generation_jobs_set_updated_at
  before update on public.generation_jobs
  for each row
  execute function public.set_updated_at();

grant select, insert, update on table public.generation_jobs to authenticated;
