-- Haftalık çalışma planı (öğrenciye özel kaynak + talimat + durum).
-- Spec: docs/superpowers/specs/2026-09-09-haftalik-calisma-plani-design.md
-- Yalnız YENİ tablo ekler; mevcut tablolara dokunmaz. Geri alma: dosya sonundaki ROLLBACK bloğu.

create table if not exists public.student_sources (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null,
  student_id uuid not null references public.students(id) on delete cascade,
  subject    text not null,
  name       text not null check (char_length(name) between 1 and 120),
  active     boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.study_plan_items (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null,
  student_id  uuid not null references public.students(id) on delete cascade,
  teacher_id  uuid not null references public.profiles(id) on delete cascade,
  subject     text not null,
  week_start  date not null,
  plan_date   date,
  source      text check (source is null or char_length(source) <= 120),
  description text not null check (char_length(description) between 1 and 300),
  status      text not null default 'planlandi'
              check (status in ('planlandi', 'yapildi', 'eksik', 'yapilmadi')),
  note        text check (note is null or char_length(note) <= 300),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint spi_week_monday    check (extract(isodow from week_start) = 1),
  constraint spi_date_in_week   check (plan_date is null or (plan_date >= week_start and plan_date <= week_start + 6))
);

alter table public.student_sources  enable row level security;
alter table public.study_plan_items enable row level security;

drop policy if exists student_sources_school_all on public.student_sources;
create policy student_sources_school_all on public.student_sources
  for all to authenticated
  using      (school_id = (select profiles.school_id from public.profiles where profiles.id = (select auth.uid())))
  with check (school_id = (select profiles.school_id from public.profiles where profiles.id = (select auth.uid())));

drop policy if exists spi_school_all on public.study_plan_items;
create policy spi_school_all on public.study_plan_items
  for all to authenticated
  using      (school_id = (select profiles.school_id from public.profiles where profiles.id = (select auth.uid())))
  with check (school_id = (select profiles.school_id from public.profiles where profiles.id = (select auth.uid())));

create index if not exists idx_spi_student_week on public.study_plan_items (student_id, week_start);
create index if not exists idx_spi_teacher_week on public.study_plan_items (teacher_id, week_start);
create index if not exists idx_student_sources_student on public.student_sources (student_id) where active;

-- updated_at bakımı
create or replace function public.spi_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists trg_spi_touch on public.study_plan_items;
create trigger trg_spi_touch before update on public.study_plan_items
  for each row execute function public.spi_touch_updated_at();

-- ROLLBACK (özellik geri alınırsa SQL editöründe çalıştır):
-- drop trigger if exists trg_spi_touch on public.study_plan_items;
-- drop function if exists public.spi_touch_updated_at();
-- drop table if exists public.study_plan_items;
-- drop table if exists public.student_sources;
