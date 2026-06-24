-- Yapılacaklarım: kişisel görev/hatırlatıcı katmanı. Sahip-özel → katı RLS.
-- Patern: teacher_duties (current_school_id() + auth.uid()).

create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id)  on delete cascade,
  user_id       uuid not null references auth.users(id)      on delete cascade,
  title         text not null check (char_length(title) between 1 and 200),
  student_id    uuid references public.students(id) on delete set null,
  class_id      uuid references public.classes(id)  on delete set null,
  due_date      date,            -- isteğe bağlı; geçmişse "gecikti" vurgusu
  snoozed_until date,            -- ertelenirse o güne kadar gizli
  done_at       timestamptz,     -- doluysa tamamlanmış
  created_at    timestamptz not null default now()
);

-- Açık görevler en sık sorgu: kullanıcı + done_at IS NULL.
create index if not exists idx_tasks_user_open
  on public.tasks (user_id) where done_at is null;

-- Öğrenci profili yüzeyi: o öğrencinin açık görevleri.
create index if not exists idx_tasks_student
  on public.tasks (student_id) where done_at is null;

alter table public.tasks enable row level security;

-- Sahip-özel: yalnız kendi okulundaki kendi satırların (okuma+yazma tek policy).
create policy "tasks_own" on public.tasks
  for all to authenticated
  using (school_id = current_school_id() and user_id = auth.uid())
  with check (school_id = current_school_id() and user_id = auth.uid());
