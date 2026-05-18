CREATE TABLE IF NOT EXISTS mentor_reports (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mentor_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (char_length(content) >= 5),
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mentor_reports_student  ON mentor_reports(student_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_mentor_reports_class    ON mentor_reports(class_id);
CREATE INDEX IF NOT EXISTS idx_mentor_reports_school   ON mentor_reports(school_id);

ALTER TABLE mentor_reports ENABLE ROW LEVEL SECURITY;

-- Mentor kendi yazdıklarını + yöneticiler tüm okul kayıtlarını okuyabilir
CREATE POLICY "mentor_reports_select" ON mentor_reports
  FOR SELECT TO authenticated
  USING (
    school_id = current_school_id() AND (
      mentor_id = auth.uid() OR
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('mudur', 'mudur_yardimcisi')
    )
  );

-- Sadece sınıfın atanmış mentörü ekleyebilir
CREATE POLICY "mentor_reports_insert" ON mentor_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = current_school_id() AND
    mentor_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM classes
      WHERE id = class_id
        AND mentor_teacher_id = auth.uid()
        AND school_id = current_school_id()
    )
  );

-- Sadece yazan mentör silebilir
CREATE POLICY "mentor_reports_delete" ON mentor_reports
  FOR DELETE TO authenticated
  USING (mentor_id = auth.uid() AND school_id = current_school_id());
