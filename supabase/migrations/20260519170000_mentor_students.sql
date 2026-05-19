CREATE TABLE IF NOT EXISTS mentor_students (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL CHECK (char_length(full_name) >= 2),
  parent_name TEXT,
  phone       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mentor_student_notes (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mentor_student_id UUID NOT NULL REFERENCES mentor_students(id) ON DELETE CASCADE,
  teacher_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id         UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  content           TEXT NOT NULL CHECK (char_length(content) >= 2),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mentor_students_teacher ON mentor_students(teacher_id, school_id);
CREATE INDEX IF NOT EXISTS idx_mentor_student_notes_student ON mentor_student_notes(mentor_student_id);

ALTER TABLE mentor_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_student_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mentor_students_select" ON mentor_students
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "mentor_students_insert" ON mentor_students
  FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "mentor_students_delete" ON mentor_students
  FOR DELETE TO authenticated
  USING (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "mentor_student_notes_select" ON mentor_student_notes
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "mentor_student_notes_insert" ON mentor_student_notes
  FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "mentor_student_notes_delete" ON mentor_student_notes
  FOR DELETE TO authenticated
  USING (teacher_id = auth.uid() AND school_id = current_school_id());
