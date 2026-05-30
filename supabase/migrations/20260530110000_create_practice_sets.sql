-- F-02 Phase 3: practice_sets with JSONB content + soft-delete.
-- One row per generation request; questions/answers/check state live in content jsonb.
-- Suggested content keys: currentQuestionIndex, questions[] (see plan Critical Implementation Details).

create table public.practice_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  job_description_text text not null,
  cv_text text,
  status text not null default 'in_progress',
  content jsonb not null default '{}'::jsonb,
  constraint practice_sets_status_check check (status in ('in_progress', 'completed')),
  constraint practice_sets_title_nonempty check (char_length(trim(title)) > 0)
);

comment on table public.practice_sets is 'Generated practice set per user; sensitive JD/CV + full practice state in content.';
comment on column public.practice_sets.title is 'Display name for history/dashboard; set at generation time.';
comment on column public.practice_sets.deleted_at is 'Soft delete (FR-010); non-null means hidden from user history.';
comment on column public.practice_sets.content is 'JSONB practice document: progress, questions, answers, Check feedback.';

create index practice_sets_user_id_idx on public.practice_sets (user_id);
create index practice_sets_user_active_idx on public.practice_sets (user_id, created_at desc)
  where deleted_at is null;

alter table public.practice_sets enable row level security;

create policy "practice_sets_select_own"
  on public.practice_sets
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "practice_sets_insert_own"
  on public.practice_sets
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "practice_sets_update_own"
  on public.practice_sets
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create trigger practice_sets_set_updated_at
  before update on public.practice_sets
  for each row
  execute function public.set_updated_at();

grant select, insert, update on table public.practice_sets to authenticated;
