-- attendance tablosuna DELETE policy eklendi (daha önce hiç yoktu).
-- curriculum_progress DELETE policy'si baskanı kapsayacak şekilde genişletildi.
-- Sorun: deleteClass action'ı attendance kayıtlarını silmeye çalışırken
--        RLS sessizce engelliyordu → students FK ihlali → sınıf silinemiyordu.

-- attendance DELETE: öğretmen kendi yoklamasını, baskan okuldaki tüm yoklamaları silebilir
CREATE POLICY "attendance_delete"
  ON public.attendance
  FOR DELETE
  USING (
    school_id = current_school_id()
    AND (teacher_id = auth.uid() OR is_zumre_baskani_in_school())
  );

-- curriculum_progress DELETE: baskan da silebilsin (sınıf silinirken cascade için)
DROP POLICY IF EXISTS "curriculum_teacher_delete" ON public.curriculum_progress;
CREATE POLICY "curriculum_delete"
  ON public.curriculum_progress
  FOR DELETE
  USING (
    school_id = current_school_id()
    AND (teacher_id = auth.uid() OR is_zumre_baskani_in_school())
  );
