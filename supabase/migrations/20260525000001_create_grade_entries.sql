-- grade_entries: her öğrencinin bir sütundaki puanı
CREATE TABLE IF NOT EXISTS grade_entries (
  id               UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  grade_column_id  UUID         NOT NULL REFERENCES grade_columns(id) ON DELETE CASCADE,
  student_id       UUID         NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id        UUID         NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  score            NUMERIC(5,1) CHECK (score >= 0),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(grade_column_id, student_id)
);

CREATE INDEX IF NOT EXISTS grade_entries_column_id_idx  ON grade_entries(grade_column_id);
CREATE INDEX IF NOT EXISTS grade_entries_student_id_idx ON grade_entries(student_id);
CREATE INDEX IF NOT EXISTS grade_entries_school_id_idx  ON grade_entries(school_id);

ALTER TABLE grade_entries ENABLE ROW LEVEL SECURITY;

-- Öğretmen kendi sütunlarının notlarını görür; yöneticiler tüm okul notlarını görür
CREATE POLICY "grade_entries_select" ON grade_entries
  FOR SELECT TO authenticated
  USING (
    school_id = current_school_id()
    AND (
      EXISTS (
        SELECT 1 FROM grade_columns gc
        WHERE gc.id = grade_column_id
          AND gc.teacher_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('mudur', 'mudur_yardimcisi', 'zumre_baskani')
      )
    )
  );

-- Yalnızca sütunun sahibi not ekleyebilir
CREATE POLICY "grade_entries_insert" ON grade_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = current_school_id()
    AND EXISTS (
      SELECT 1 FROM grade_columns gc
      WHERE gc.id = grade_column_id
        AND gc.teacher_id = auth.uid()
        AND gc.school_id = current_school_id()
    )
  );

-- Yalnızca sütunun sahibi not güncelleyebilir
CREATE POLICY "grade_entries_update" ON grade_entries
  FOR UPDATE TO authenticated
  USING (
    school_id = current_school_id()
    AND EXISTS (
      SELECT 1 FROM grade_columns gc
      WHERE gc.id = grade_column_id AND gc.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    school_id = current_school_id()
    AND EXISTS (
      SELECT 1 FROM grade_columns gc
      WHERE gc.id = grade_column_id AND gc.teacher_id = auth.uid()
    )
  );

-- Yalnızca sütunun sahibi not silebilir
CREATE POLICY "grade_entries_delete" ON grade_entries
  FOR DELETE TO authenticated
  USING (
    school_id = current_school_id()
    AND EXISTS (
      SELECT 1 FROM grade_columns gc
      WHERE gc.id = grade_column_id AND gc.teacher_id = auth.uid()
    )
  );
