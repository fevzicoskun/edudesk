-- Ders Programım: periods kolonu + öğretmen başına teklik + daraltılmış SELECT + öğretmen-self yazma.

alter table lesson_schedules
  add column if not exists periods jsonb not null default '[]'::jsonb;

-- Öğretmen başına tek satır (upsert conflict hedefi). teacher_id nullable;
-- Postgres'te UNIQUE içindeki NULL'lar ayrık → olası sınıf-bazlı satırları bozmaz.
alter table lesson_schedules
  add constraint lesson_schedules_school_teacher_uniq unique (school_id, teacher_id);

-- SELECT daralt: kendi satırı VEYA müdür/MY (en az ayrıcalık; gözetim geldiğinde genişletilir).
drop policy if exists "lesson_schedules_select" on lesson_schedules;
create policy "lesson_schedules_select" on lesson_schedules
  for select to authenticated
  using (
    school_id = current_school_id()
    and (
      teacher_id = auth.uid()
      or (select role from profiles where id = auth.uid()) in ('mudur','mudur_yardimcisi')
    )
  );

-- Öğretmen-self yazma (mevcut müdür/MY politikaları korunur).
create policy "lesson_schedules_teacher_insert" on lesson_schedules
  for insert to authenticated
  with check (school_id = current_school_id() and teacher_id = auth.uid());

create policy "lesson_schedules_teacher_update" on lesson_schedules
  for update to authenticated
  using (school_id = current_school_id() and teacher_id = auth.uid())
  with check (school_id = current_school_id() and teacher_id = auth.uid());

create policy "lesson_schedules_teacher_delete" on lesson_schedules
  for delete to authenticated
  using (school_id = current_school_id() and teacher_id = auth.uid());
