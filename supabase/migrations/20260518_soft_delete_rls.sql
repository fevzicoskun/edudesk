-- Soft delete: update SELECT RLS policies to exclude soft-deleted records
-- Add UPDATE policies for soft delete / restore operations

-- classes
DROP POLICY IF EXISTS classes_school_read ON classes;
CREATE POLICY classes_school_read ON classes FOR SELECT
  USING (school_id = current_school_id() AND deleted_at IS NULL);

DROP POLICY IF EXISTS classes_manager_update ON classes;
CREATE POLICY classes_manager_update ON classes FOR UPDATE
  USING (school_id = current_school_id() AND can_manage_classes());

-- students
DROP POLICY IF EXISTS students_school_read ON students;
CREATE POLICY students_school_read ON students FOR SELECT
  USING (school_id = current_school_id() AND deleted_at IS NULL);

DROP POLICY IF EXISTS students_school_update ON students;
CREATE POLICY students_school_update ON students FOR UPDATE
  USING (school_id = current_school_id());

-- homeworks
DROP POLICY IF EXISTS homeworks_school_read ON homeworks;
CREATE POLICY homeworks_school_read ON homeworks FOR SELECT
  USING (school_id = current_school_id() AND deleted_at IS NULL);

DROP POLICY IF EXISTS homeworks_owner_update ON homeworks;
CREATE POLICY homeworks_owner_update ON homeworks FOR UPDATE
  USING (school_id = current_school_id() AND (teacher_id = auth.uid() OR is_zumre_baskani_in_school()));

-- zumre_meetings
DROP POLICY IF EXISTS meetings_school_read ON zumre_meetings;
CREATE POLICY meetings_school_read ON zumre_meetings FOR SELECT
  USING (school_id = current_school_id() AND can_see_zumre_item(branch) AND deleted_at IS NULL);

-- common_exams
DROP POLICY IF EXISTS exams_school_read ON common_exams;
CREATE POLICY exams_school_read ON common_exams FOR SELECT
  USING (school_id = current_school_id() AND can_see_zumre_item(subject) AND deleted_at IS NULL);
