-- ============================================================
-- Migration: RLS Hardening (Least-Privilege)
-- Date: 2026-05-15
-- Description: school_id + role bazlı sıkı RLS politikaları
-- ============================================================

-- ============================================================
-- classes — okul izolasyonu + baskan write
-- ============================================================
DROP POLICY IF EXISTS "classes_read" ON classes;
DROP POLICY IF EXISTS "classes_insert" ON classes;
DROP POLICY IF EXISTS "classes_update" ON classes;
DROP POLICY IF EXISTS "classes_delete" ON classes;

CREATE POLICY "classes_school_read" ON classes
  FOR SELECT TO authenticated
  USING (school_id = current_school_id());

CREATE POLICY "classes_baskan_insert" ON classes
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = current_school_id()
    AND is_zumre_baskani_in_school()
  );

CREATE POLICY "classes_baskan_delete" ON classes
  FOR DELETE TO authenticated
  USING (
    school_id = current_school_id()
    AND is_zumre_baskani_in_school()
  );

-- ============================================================
-- students — sınıfın okulu üzerinden izolasyon
-- ============================================================
DROP POLICY IF EXISTS "students_all" ON students;
DROP POLICY IF EXISTS "students_school_read" ON students;
DROP POLICY IF EXISTS "students_school_insert" ON students;
DROP POLICY IF EXISTS "students_school_delete" ON students;

CREATE POLICY "students_school_read" ON students
  FOR SELECT TO authenticated
  USING (school_id = current_school_id());

CREATE POLICY "students_school_insert" ON students
  FOR INSERT TO authenticated
  WITH CHECK (school_id = current_school_id());

CREATE POLICY "students_school_delete" ON students
  FOR DELETE TO authenticated
  USING (school_id = current_school_id());

-- anon read for public portal
DROP POLICY IF EXISTS "students_anon_read" ON students;
CREATE POLICY "students_anon_read" ON students
  FOR SELECT TO anon
  USING (true);

-- ============================================================
-- homeworks — sahip + okul izolasyonu
-- ============================================================
DROP POLICY IF EXISTS "homeworks_all" ON homeworks;
DROP POLICY IF EXISTS "homeworks_school_read" ON homeworks;
DROP POLICY IF EXISTS "homeworks_owner_write" ON homeworks;
DROP POLICY IF EXISTS "homeworks_owner_delete" ON homeworks;

CREATE POLICY "homeworks_school_read" ON homeworks
  FOR SELECT TO authenticated
  USING (school_id = current_school_id());

CREATE POLICY "homeworks_owner_insert" ON homeworks
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = current_school_id()
    AND teacher_id = auth.uid()
  );

CREATE POLICY "homeworks_owner_delete" ON homeworks
  FOR DELETE TO authenticated
  USING (
    school_id = current_school_id()
    AND (teacher_id = auth.uid() OR is_zumre_baskani_in_school())
  );

-- ============================================================
-- homework_submissions — ödev sahibi + baskan write
-- ============================================================
DROP POLICY IF EXISTS "submissions_read" ON homework_submissions;
DROP POLICY IF EXISTS "submissions_update" ON homework_submissions;
DROP POLICY IF EXISTS "homework_submissions_read" ON homework_submissions;
DROP POLICY IF EXISTS "homework_submissions_update" ON homework_submissions;
DROP POLICY IF EXISTS "sub_update_owner_or_baskan" ON homework_submissions;

CREATE POLICY "submissions_school_read" ON homework_submissions
  FOR SELECT TO authenticated
  USING (school_id = current_school_id());

CREATE POLICY "submissions_owner_upsert" ON homework_submissions
  FOR INSERT TO authenticated
  WITH CHECK (school_id = current_school_id());

CREATE POLICY "submissions_owner_update" ON homework_submissions
  FOR UPDATE TO authenticated
  USING (school_id = current_school_id())
  WITH CHECK (school_id = current_school_id());

-- anon read for veli portal
DROP POLICY IF EXISTS "submissions_anon_read" ON homework_submissions;
CREATE POLICY "submissions_anon_read" ON homework_submissions
  FOR SELECT TO anon
  USING (true);

-- ============================================================
-- attendance — teacher ownership + okul izolasyonu
-- ============================================================
DROP POLICY IF EXISTS "attendance_own" ON attendance;
DROP POLICY IF EXISTS "attendance_public_read" ON attendance;

CREATE POLICY "attendance_school_read" ON attendance
  FOR SELECT TO authenticated
  USING (school_id = current_school_id());

CREATE POLICY "attendance_teacher_write" ON attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = current_school_id()
    AND teacher_id = auth.uid()
  );

CREATE POLICY "attendance_teacher_update" ON attendance
  FOR UPDATE TO authenticated
  USING (
    school_id = current_school_id()
    AND teacher_id = auth.uid()
  )
  WITH CHECK (
    school_id = current_school_id()
    AND teacher_id = auth.uid()
  );

-- anon read for public print page
CREATE POLICY "attendance_anon_read" ON attendance
  FOR SELECT TO anon
  USING (true);

-- ============================================================
-- zumre_meetings — okul izolasyonu + baskan write
-- ============================================================
DROP POLICY IF EXISTS "meetings_read" ON zumre_meetings;
DROP POLICY IF EXISTS "meetings_baskan_insert" ON zumre_meetings;
DROP POLICY IF EXISTS "meetings_baskan_update" ON zumre_meetings;
DROP POLICY IF EXISTS "meetings_baskan_delete" ON zumre_meetings;

CREATE POLICY "meetings_school_read" ON zumre_meetings
  FOR SELECT TO authenticated
  USING (school_id = current_school_id());

CREATE POLICY "meetings_baskan_insert" ON zumre_meetings
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = current_school_id()
    AND is_zumre_baskani_in_school()
    AND created_by = auth.uid()
  );

CREATE POLICY "meetings_baskan_update" ON zumre_meetings
  FOR UPDATE TO authenticated
  USING (school_id = current_school_id() AND is_zumre_baskani_in_school())
  WITH CHECK (school_id = current_school_id() AND is_zumre_baskani_in_school());

CREATE POLICY "meetings_baskan_delete" ON zumre_meetings
  FOR DELETE TO authenticated
  USING (school_id = current_school_id() AND is_zumre_baskani_in_school());

-- ============================================================
-- common_exams — okul izolasyonu + baskan write
-- ============================================================
DROP POLICY IF EXISTS "exams_read" ON common_exams;
DROP POLICY IF EXISTS "exams_baskan_insert" ON common_exams;
DROP POLICY IF EXISTS "exams_baskan_update" ON common_exams;
DROP POLICY IF EXISTS "exams_baskan_delete" ON common_exams;

CREATE POLICY "exams_school_read" ON common_exams
  FOR SELECT TO authenticated
  USING (school_id = current_school_id());

CREATE POLICY "exams_baskan_insert" ON common_exams
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = current_school_id()
    AND is_zumre_baskani_in_school()
    AND created_by = auth.uid()
  );

CREATE POLICY "exams_baskan_update" ON common_exams
  FOR UPDATE TO authenticated
  USING (school_id = current_school_id())
  WITH CHECK (school_id = current_school_id());

CREATE POLICY "exams_baskan_delete" ON common_exams
  FOR DELETE TO authenticated
  USING (school_id = current_school_id() AND is_zumre_baskani_in_school());

-- ============================================================
-- curriculum_progress — teacher + okul izolasyonu
-- ============================================================
DROP POLICY IF EXISTS "curriculum_read_own_baskan" ON curriculum_progress;
DROP POLICY IF EXISTS "curriculum_write_own" ON curriculum_progress;
DROP POLICY IF EXISTS "curriculum_delete_own" ON curriculum_progress;

CREATE POLICY "curriculum_school_read" ON curriculum_progress
  FOR SELECT TO authenticated
  USING (
    school_id = current_school_id()
    AND (teacher_id = auth.uid() OR is_zumre_baskani_in_school())
  );

CREATE POLICY "curriculum_teacher_insert" ON curriculum_progress
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = current_school_id()
    AND teacher_id = auth.uid()
  );

CREATE POLICY "curriculum_teacher_update" ON curriculum_progress
  FOR UPDATE TO authenticated
  USING (school_id = current_school_id() AND teacher_id = auth.uid())
  WITH CHECK (school_id = current_school_id() AND teacher_id = auth.uid());

CREATE POLICY "curriculum_teacher_delete" ON curriculum_progress
  FOR DELETE TO authenticated
  USING (school_id = current_school_id() AND teacher_id = auth.uid());

-- ============================================================
-- student_notes — teacher + okul
-- ============================================================
DROP POLICY IF EXISTS "student_notes_read" ON student_notes;
DROP POLICY IF EXISTS "student_notes_insert" ON student_notes;
DROP POLICY IF EXISTS "student_notes_delete" ON student_notes;

CREATE POLICY "student_notes_school_read" ON student_notes
  FOR SELECT TO authenticated
  USING (school_id = current_school_id());

CREATE POLICY "student_notes_teacher_insert" ON student_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = current_school_id()
    AND teacher_id = auth.uid()
  );

CREATE POLICY "student_notes_teacher_delete" ON student_notes
  FOR DELETE TO authenticated
  USING (school_id = current_school_id() AND teacher_id = auth.uid());

-- anon read for veli portal
CREATE POLICY "student_notes_anon_read" ON student_notes
  FOR SELECT TO anon
  USING (true);
