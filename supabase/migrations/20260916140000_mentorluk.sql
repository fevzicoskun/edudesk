-- Mentörlük: kişisel öğrenci listesi + tanıma kartı
--
-- Notlar yalnız mentöre aittir; yönetici rolleri dahil kimse okuyamaz.
-- Kullanılmayan mentor_students tablosu (0 kayıt, okul öğrencisine bağlı değil)
-- kaldırılır — iki benzer tablo karışıklık yaratıyordu.

create table if not exists mentorships (
  id         uuid primary key default gen_random_uuid(),
  mentor_id  uuid not null references profiles(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  school_id  uuid not null references schools(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (mentor_id, student_id)
);

create index if not exists mentorships_mentor_idx on mentorships (mentor_id, school_id);

create table if not exists mentor_profiles (
  id                uuid primary key default gen_random_uuid(),
  mentor_id         uuid not null references profiles(id) on delete cascade,
  student_id        uuid not null references students(id) on delete cascade,
  school_id         uuid not null references schools(id) on delete cascade,
  goals_short       text,
  goals_long        text,
  interests         text,
  family_info       text,
  study_environment text,
  special_note      text,
  support_request   text,
  rules_explained_at date,
  updated_at        timestamptz not null default now(),
  unique (mentor_id, student_id)
);

create index if not exists mentor_profiles_mentor_idx on mentor_profiles (mentor_id, school_id);

alter table mentorships enable row level security;
alter table mentor_profiles enable row level security;

-- Satır sahibine aittir: dört işlem de aynı koşul
drop policy if exists mentorships_owner_all on mentorships;
create policy mentorships_owner_all on mentorships
  for all
  using (mentor_id = (select auth.uid()) and school_id = current_school_id())
  with check (mentor_id = (select auth.uid()) and school_id = current_school_id());

drop policy if exists mentor_profiles_owner_all on mentor_profiles;
create policy mentor_profiles_owner_all on mentor_profiles
  for all
  using (mentor_id = (select auth.uid()) and school_id = current_school_id())
  with check (mentor_id = (select auth.uid()) and school_id = current_school_id());

-- Görüşme notları artık yalnız mentöre görünür (yönetici okuma kolu kaldırıldı)
drop policy if exists mentor_reports_select on mentor_reports;
create policy mentor_reports_select on mentor_reports
  for select
  using (mentor_id = (select auth.uid()) and school_id = current_school_id());

-- Not ekleme artık sınıf rehberliğine değil kişisel mentörlük bağına dayanır:
-- mentörlük bu özellikte sınıf rehber öğretmenliğinden ayrıştırılıp
-- mentorships tablosundaki kişisel öğrenci listesine taşındı (spec kararı).
-- Eski koşul (classes.mentor_teacher_id) rehber olmayan mentörlerin kendi
-- öğrencisine bile not yazmasını RLS seviyesinde engellerdi.
drop policy if exists mentor_reports_insert on mentor_reports;
create policy mentor_reports_insert on mentor_reports
  for insert
  with check (
    school_id = current_school_id()
    and mentor_id = (select auth.uid())
    and exists (
      select 1 from mentorships m
      where m.student_id = mentor_reports.student_id
        and m.mentor_id = (select auth.uid())
        and m.school_id = current_school_id()
    )
  );

-- Ölü tablolar: 0 kayıt, UI'sı hiç yapılmadı, okul öğrencisine bağlı değildi.
-- mentor_student_notes, mentor_students'a FK ile bağlıydı (baseline şemasında
-- birlikte tanımlanmışlar); ikisi de kod tabanında kullanılmıyor, önce çocuk
-- tablo düşürülür.
drop table if exists mentor_student_notes;
drop table if exists mentor_students;
