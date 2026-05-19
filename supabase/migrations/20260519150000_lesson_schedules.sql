CREATE TABLE IF NOT EXISTS lesson_schedules (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  schedule_type TEXT        NOT NULL DEFAULT 'resmi' CHECK (schedule_type IN ('resmi', 'okul')),
  type_label    TEXT        NOT NULL DEFAULT 'Okul Programı',
  teacher_id    UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  class_id      UUID        REFERENCES classes(id) ON DELETE CASCADE,
  title         TEXT,
  slots         JSONB       NOT NULL DEFAULT '[]',
  period_count  INT         NOT NULL DEFAULT 8,
  created_by    UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lesson_schedules_target_check CHECK (teacher_id IS NOT NULL OR class_id IS NOT NULL)
);

ALTER TABLE lesson_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lesson_schedules_select" ON lesson_schedules
  FOR SELECT TO authenticated
  USING (school_id = current_school_id());

CREATE POLICY "lesson_schedules_insert" ON lesson_schedules
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = current_school_id() AND
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('mudur', 'mudur_yardimcisi')
  );

CREATE POLICY "lesson_schedules_update" ON lesson_schedules
  FOR UPDATE TO authenticated
  USING (
    school_id = current_school_id() AND
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('mudur', 'mudur_yardimcisi')
  )
  WITH CHECK (
    school_id = current_school_id() AND
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('mudur', 'mudur_yardimcisi')
  );

CREATE POLICY "lesson_schedules_delete" ON lesson_schedules
  FOR DELETE TO authenticated
  USING (
    school_id = current_school_id() AND
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('mudur', 'mudur_yardimcisi')
  );

CREATE OR REPLACE FUNCTION update_lesson_schedules_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER lesson_schedules_updated_at
  BEFORE UPDATE ON lesson_schedules
  FOR EACH ROW EXECUTE FUNCTION update_lesson_schedules_updated_at();
