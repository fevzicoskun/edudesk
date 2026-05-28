CREATE TABLE ogretmen_dosyasi (
  teacher_id    uuid  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id     uuid  NOT NULL REFERENCES schools(id)    ON DELETE CASCADE,
  academic_year text  NOT NULL,
  checked_items text[] NOT NULL DEFAULT '{}',
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (teacher_id, academic_year)
);

ALTER TABLE ogretmen_dosyasi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ogretmen_dosyasi_own_select" ON ogretmen_dosyasi
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "ogretmen_dosyasi_own_insert" ON ogretmen_dosyasi
  FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "ogretmen_dosyasi_own_update" ON ogretmen_dosyasi
  FOR UPDATE TO authenticated
  USING  (teacher_id = auth.uid() AND school_id = current_school_id())
  WITH CHECK (teacher_id = auth.uid() AND school_id = current_school_id());
