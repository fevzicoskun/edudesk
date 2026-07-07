-- parent_contact_logs: veli iletişim geçmişi (öğrenci sayfası "Veli İletişim" bölümü).
-- Tablo canlıda 2026-06 civarı doğrudan oluşturulmuş, migration dosyası repoya
-- eklenmemişti (şema drifti — Codex 2026-07-07 bulgusu). Bu dosya canlı tanımın
-- birebir, idempotent kopyasıdır: canlıda no-op, taze kurulumda tabloyu oluşturur.

create table if not exists public.parent_contact_logs (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null,
  student_id     uuid not null references public.students(id) on delete cascade,
  teacher_id     uuid not null references public.profiles(id) on delete cascade,
  note           text not null,
  contact_method text not null default 'diger',
  contacted_at   timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

alter table public.parent_contact_logs enable row level security;

drop policy if exists pcl_school_all on public.parent_contact_logs;
create policy pcl_school_all on public.parent_contact_logs
  for all to authenticated
  using (school_id = (select profiles.school_id from public.profiles where profiles.id = (select auth.uid())))
  with check (school_id = (select profiles.school_id from public.profiles where profiles.id = (select auth.uid())));

create index if not exists idx_pcl_student
  on public.parent_contact_logs using btree (student_id, contacted_at desc);
