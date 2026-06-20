-- Nöbet Bilgilerim: her öğretmenin TEK nöbet kaydı. Kişisel veri → katı RLS.
-- Patern: lesson_schedules öğretmen-self politikaları (current_school_id() + auth.uid()).

create table if not exists public.teacher_duties (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  teacher_id  uuid not null references auth.users(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 5), -- 1=Pzt .. 5=Cuma
  time_range  text not null check (char_length(time_range) between 1 and 40),
  location    text not null check (char_length(location) between 1 and 100),
  notes       text check (notes is null or char_length(notes) <= 200),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Öğretmen başına tek satır (upsert conflict hedefi). Tenant izolasyonu için school_id dahil.
  constraint teacher_duties_school_teacher_uniq unique (school_id, teacher_id)
);

-- Müdür/MY raporlaması başka öğretmeni güne göre filtreleyebilsin diye yardımcı index.
create index if not exists teacher_duties_school_day_idx
  on public.teacher_duties (school_id, day_of_week);

alter table public.teacher_duties enable row level security;

-- SELECT: kendi satırı VEYA müdür/MY (gözetim). En az ayrıcalık.
create policy "teacher_duties_select" on public.teacher_duties
  for select to authenticated
  using (
    school_id = current_school_id()
    and (
      teacher_id = auth.uid()
      or (select role from public.profiles where id = auth.uid()) in ('mudur','mudur_yardimcisi')
    )
  );

-- Yazma yalnızca kendi adına: with check teacher_id = auth.uid() → başkası adına ekleme/güncelleme imkânsız.
create policy "teacher_duties_insert" on public.teacher_duties
  for insert to authenticated
  with check (school_id = current_school_id() and teacher_id = auth.uid());

create policy "teacher_duties_update" on public.teacher_duties
  for update to authenticated
  using (school_id = current_school_id() and teacher_id = auth.uid())
  with check (school_id = current_school_id() and teacher_id = auth.uid());

create policy "teacher_duties_delete" on public.teacher_duties
  for delete to authenticated
  using (school_id = current_school_id() and teacher_id = auth.uid());
