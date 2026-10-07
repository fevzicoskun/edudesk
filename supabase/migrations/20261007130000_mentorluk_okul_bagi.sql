-- Mentörlük okul bağı (final review I1, 2026-10-07):
-- unique(student_id) tablo genelinde geçerli olduğu için başka okulun öğrencisine
-- doğrudan API ile satır yazılırsa o öğrenci kendi okulunda "kilitlenirdi"
-- (B okulu ne atayabilir ne silebilirdi). Öğrenci ve mentör çağıranın okulunda olmalı.

drop policy if exists mentorships_insert on mentorships;
create policy mentorships_insert on mentorships for insert
  with check (
    school_id = current_school_id()
    and assigned_by = (select auth.uid())
    and (mentor_id = (select auth.uid()) or is_mudur_or_my())
    and exists (select 1 from students s where s.id = student_id and s.school_id = current_school_id())
    and exists (select 1 from profiles p where p.id = mentor_id and p.school_id = current_school_id())
  );

drop policy if exists mentorships_update on mentorships;
create policy mentorships_update on mentorships for update
  using (school_id = current_school_id() and is_mudur_or_my())
  with check (
    school_id = current_school_id()
    and is_mudur_or_my()
    and assigned_by = (select auth.uid())
    and exists (select 1 from students s where s.id = student_id and s.school_id = current_school_id())
    and exists (select 1 from profiles p where p.id = mentor_id and p.school_id = current_school_id())
  );
