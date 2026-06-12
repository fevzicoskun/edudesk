CREATE TABLE IF NOT EXISTS veli_portal_events (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token_jti     TEXT NOT NULL,
  student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id     UUID NOT NULL,
  event_type    TEXT NOT NULL CHECK (event_type IN ('page_view', 'section_view', 'session_end')),
  section       TEXT CHECK (section IN ('odevler', 'devamsizlik', 'notlar')),
  duration_sec  INTEGER CHECK (duration_sec >= 0 AND duration_sec <= 7200),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vpe_student  ON veli_portal_events(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vpe_school   ON veli_portal_events(school_id);
CREATE INDEX IF NOT EXISTS idx_vpe_jti      ON veli_portal_events(token_jti);

ALTER TABLE veli_portal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vpe_school_read" ON veli_portal_events
  FOR SELECT TO authenticated
  USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));
