-- Veli görüşme randevu defteri: öğretmene-özel tarihli randevular.
-- Patern: tasks (current_school_id() + auth.uid(), tek "own" policy).

create table if not exists public.parent_meetings (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id)   on delete cascade,
  teacher_id  uuid not null references public.profiles(id)  on delete cascade,
  student_id  uuid not null references public.students(id)  on delete cascade,
  meet_date   date not null,
  period      int  not null check (period between 1 and 9),
  status      text not null default 'planlandi'
              check (status in ('planlandi', 'yapildi', 'iptal')),
  note        text check (note is null or char_length(note) <= 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Aynı slota iki aktif randevu olmasın (iptal hariç).
create unique index if not exists parent_meetings_slot_uniq
  on public.parent_meetings (teacher_id, meet_date, period)
  where status <> 'iptal';

-- En sık sorgu: öğretmenin randevuları, tarihe göre.
create index if not exists idx_parent_meetings_teacher_date
  on public.parent_meetings (teacher_id, meet_date);

-- FK kapsama indexleri (mevcut hot_fk_covering_indexes pratiği).
create index if not exists idx_parent_meetings_student
  on public.parent_meetings (student_id);

alter table public.parent_meetings enable row level security;

-- Sahip-özel: yalnız kendi okulundaki kendi satırların (okuma+yazma tek policy).
create policy "parent_meetings_own" on public.parent_meetings
  for all to authenticated
  using (school_id = current_school_id() and teacher_id = auth.uid())
  with check (school_id = current_school_id() and teacher_id = auth.uid());

-- updated_at trigger (mevcut update_*_updated_at pattern'i ile aynı imza).
create or replace function public.update_parent_meetings_updated_at()
returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger parent_meetings_updated_at
  before update on public.parent_meetings
  for each row execute function public.update_parent_meetings_updated_at();
