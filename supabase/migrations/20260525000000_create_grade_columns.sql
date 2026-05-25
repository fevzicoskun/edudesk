-- grade_columns: öğretmenin oluşturduğu her ölçme sütunu (Yazılı 1, Quiz 3, Proje...)
CREATE TABLE IF NOT EXISTS grade_columns (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id  UUID    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id    UUID    NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  school_id   UUID    NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  grade_type  TEXT    NOT NULL CHECK (grade_type IN ('yazili', 'quiz', 'proje')),
  max_score   SMALLINT NOT NULL DEFAULT 100 CHECK (max_score BETWEEN 1 AND 1000),
  exam_date   DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS grade_columns_class_id_idx    ON grade_columns(class_id);
CREATE INDEX IF NOT EXISTS grade_columns_teacher_id_idx  ON grade_columns(teacher_id);
CREATE INDEX IF NOT EXISTS grade_columns_school_id_idx   ON grade_columns(school_id);

ALTER TABLE grade_columns ENABLE ROW LEVEL SECURITY;

-- Öğretmen kendi sütunlarını görür; yöneticiler tüm okul sütunlarını görür
CREATE POLICY "grade_columns_select" ON grade_columns
  FOR SELECT TO authenticated
  USING (
    school_id = current_school_id()
    AND (
      teacher_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('mudur', 'mudur_yardimcisi', 'zumre_baskani')
      )
    )
  );

-- Öğretmen ve zümre başkanı kendi adına sütun oluşturur
CREATE POLICY "grade_columns_insert" ON grade_columns
  FOR INSERT TO authenticated
  WITH CHECK (
    teacher_id = auth.uid()
    AND school_id = current_school_id()
  );

-- Yalnızca sütunun sahibi düzenleyebilir
CREATE POLICY "grade_columns_update" ON grade_columns
  FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid() AND school_id = current_school_id())
  WITH CHECK (teacher_id = auth.uid() AND school_id = current_school_id());

-- Yalnızca sütunun sahibi silebilir
CREATE POLICY "grade_columns_delete" ON grade_columns
  FOR DELETE TO authenticated
  USING (teacher_id = auth.uid() AND school_id = current_school_id());
