-- common_exams.grades (integer[]) ve grade_map (jsonb) kaldırıldı.
-- Not verileri artık exam_entries tablosunda tutulur.
-- Her satır: exam_id FK + opsiyonel student_id FK + opsiyonel name + grade integer.

CREATE TABLE exam_entries (
  id          UUID     DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_id     UUID     NOT NULL REFERENCES common_exams(id) ON DELETE CASCADE,
  student_id  UUID     REFERENCES students(id) ON DELETE SET NULL,
  name        TEXT     CHECK (name IS NULL OR char_length(name) <= 120),
  grade       SMALLINT NOT NULL CHECK (grade >= 0 AND grade <= 100),
  school_id   UUID     NOT NULL REFERENCES schools(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX exam_entries_exam_id_idx    ON exam_entries(exam_id);
CREATE INDEX exam_entries_school_id_idx  ON exam_entries(school_id);
CREATE INDEX exam_entries_student_id_idx ON exam_entries(student_id) WHERE student_id IS NOT NULL;

ALTER TABLE exam_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entries_school_read" ON exam_entries
  FOR SELECT TO authenticated
  USING (school_id = current_school_id());

CREATE POLICY "entries_baskan_insert" ON exam_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = current_school_id()
    AND is_zumre_baskani_in_school()
  );

CREATE POLICY "entries_baskan_delete" ON exam_entries
  FOR DELETE TO authenticated
  USING (
    school_id = current_school_id()
    AND is_zumre_baskani_in_school()
  );

ALTER TABLE common_exams DROP COLUMN IF EXISTS grades;
ALTER TABLE common_exams DROP COLUMN IF EXISTS grade_map;
