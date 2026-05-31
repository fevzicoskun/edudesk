CREATE TABLE kanaat_notlari (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid        NOT NULL REFERENCES students(id)  ON DELETE CASCADE,
  class_id    uuid        NOT NULL REFERENCES classes(id)   ON DELETE CASCADE,
  teacher_id  uuid        NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  school_id   uuid        NOT NULL,
  score       smallint    NOT NULL CHECK (score BETWEEN 1 AND 5),
  text        text        NOT NULL,
  donem       text        NOT NULL CHECK (donem ~ '^\d{4}-\d{4}-(1|2)$'),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, donem)
);

ALTER TABLE kanaat_notlari ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_isolation" ON kanaat_notlari
  USING (
    school_id = (
      SELECT school_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    school_id = (
      SELECT school_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE INDEX idx_kanaat_class_donem ON kanaat_notlari (class_id, donem);
