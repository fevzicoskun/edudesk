-- 2026-10-10 pazartesi canlıya geçiş öncesi tarama (subagent bulguları, DB'de doğrulandı; kullanıcı onayladı).
-- Uygulama bu tablolara bu yollarla zaten yazmıyor (service client / RPC / SECURITY DEFINER trigger);
-- kapatılan şey PostgREST'e tarayıcıdan doğrudan gelen isteklerdi.

-- KRİTİK: herhangi bir kullanıcı kendine user_roles satırı (ör. müdür) ekleyebiliyordu.
-- Rol satırlarını SECURITY DEFINER sync_profile_to_user_roles trigger'ı yazar.
drop policy if exists user_roles_insert_service on user_roles;

-- YÜKSEK: her öğretmen okulun tüm öğrencilerini KALICI silebiliyor (18 tabloya cascade) / değiştirebiliyordu.
-- Uygulama yalnız soft-delete (UPDATE deleted_at) yapar → DELETE policy'si gereksiz.
drop policy if exists students_school_delete on students;
drop policy if exists students_school_update on students;
create policy students_update on students for update
  using (
    school_id = (select current_school_id())
    and (
      (select is_mudur_or_my())
      -- öğretmen: ders verdiği sınıfın veya mentörü olduğu öğrencinin (veli bilgisi; ClassService.updateVeliContact)
      or exists (select 1 from teacher_classes tc where tc.class_id = students.class_id and tc.teacher_id = (select auth.uid()))
      or exists (select 1 from mentorships m where m.student_id = students.id and m.mentor_id = (select auth.uid()))
    )
  )
  with check (school_id = (select current_school_id()));

-- YÜKSEK: zümre başkanı okulun abonelik alanlarını (status, plan, access_until) yazabiliyordu.
-- Okul güncellemesi service client ile yapılır (SchoolRepository.updateSchool, /platform).
drop policy if exists schools_baskan_update on schools;

-- Öğretmen kendini istediği sınıfa atayıp o sınıfın öğrencilerine yazma hakkı kazanabiliyordu.
-- Atama yalnız idare ekranından (service client). Okuma aynı kalır.
drop policy if exists tc_school_write on teacher_classes;
create policy tc_school_read on teacher_classes for select
  using (exists (select 1 from classes c where c.id = teacher_classes.class_id and c.school_id = (select current_school_id())));
create policy tc_manager_write on teacher_classes for all
  using ((select can_manage_classes()) and exists (select 1 from classes c where c.id = teacher_classes.class_id and c.school_id = (select current_school_id())))
  with check ((select can_manage_classes()) and exists (select 1 from classes c where c.id = teacher_classes.class_id and c.school_id = (select current_school_id())));

-- Veli görüşme kaydını okuldaki herkes silip değiştirebiliyordu → yalnız yazan öğretmen.
drop policy if exists pcl_school_all on parent_contact_logs;
create policy pcl_school_read on parent_contact_logs for select
  using (school_id = (select current_school_id()));
create policy pcl_own_insert on parent_contact_logs for insert
  with check (school_id = (select current_school_id()) and teacher_id = (select auth.uid()));
create policy pcl_own_update on parent_contact_logs for update
  using (school_id = (select current_school_id()) and teacher_id = (select auth.uid()))
  with check (school_id = (select current_school_id()) and teacher_id = (select auth.uid()));
create policy pcl_own_delete on parent_contact_logs for delete
  using (school_id = (select current_school_id()) and teacher_id = (select auth.uid()));

-- Ortak sınav: INSERT/DELETE zümre yetkisi istiyordu, UPDATE istemiyordu.
alter policy exams_yonetici_update on common_exams
  using (school_id = current_school_id() and can_manage_zumre_item(subject))
  with check (school_id = current_school_id() and can_manage_zumre_item(subject));

-- Ödev sahibi doğrudan API ile KALICI silebiliyordu (işaretler cascade gider). Uygulama soft-delete RPC'si kullanır.
drop policy if exists homeworks_owner_delete on homeworks;

-- HIZ: yetki fonksiyonu OR'lu policy'de her satır için çalışıyordu (aktivite raporu ort. 960 ms).
-- (select fn()) → InitPlan, sorgu başına bir kez.
alter policy teacher_activity_log_yonetici_read on teacher_activity_log
  using (school_id = (select current_school_id()) and (select is_mudur_or_my()));
alter policy usage_daily_yonetici_read on usage_daily
  using (school_id = (select current_school_id()) and (select is_mudur_or_my()));
alter policy mentorships_select on mentorships
  using (school_id = (select current_school_id()) and (mentor_id = (select auth.uid()) or (select is_mudur_or_my())));
alter policy bulten_gonderimleri_select on bulten_gonderimleri
  using (school_id = (select current_school_id()) and (mentor_id = (select auth.uid()) or (select is_mudur_or_my())));

create index if not exists idx_usage_daily_school_day on usage_daily (school_id, day);
create index if not exists idx_hsl_student on homework_submission_logs (student_id);
