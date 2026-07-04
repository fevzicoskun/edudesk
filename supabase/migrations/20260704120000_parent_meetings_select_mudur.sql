-- Öğrenci 360: parent_meetings görünürlüğü sahip + müdür/MY'ye genişletildi.
-- FOR ALL "parent_meetings_own" komut-bazlı 4 politikaya ayrılır; yazma
-- (insert/update/delete) sahip-özel kalır — davranış değişmez.
-- SELECT'teki rol kontrolü lesson_schedules/teacher_duties deseniyle aynı;
-- (select ...) initplan sarması korunur (advisor 0003).

drop policy "parent_meetings_own" on public.parent_meetings;

create policy "parent_meetings_select" on public.parent_meetings
  for select to authenticated
  using (
    school_id = (select current_school_id())
    and (
      teacher_id = (select auth.uid())
      or (select role from public.profiles where id = (select auth.uid())) in ('mudur', 'mudur_yardimcisi')
    )
  );

create policy "parent_meetings_insert" on public.parent_meetings
  for insert to authenticated
  with check (school_id = (select current_school_id()) and teacher_id = (select auth.uid()));

create policy "parent_meetings_update" on public.parent_meetings
  for update to authenticated
  using (school_id = (select current_school_id()) and teacher_id = (select auth.uid()))
  with check (school_id = (select current_school_id()) and teacher_id = (select auth.uid()));

create policy "parent_meetings_delete" on public.parent_meetings
  for delete to authenticated
  using (school_id = (select current_school_id()) and teacher_id = (select auth.uid()));
