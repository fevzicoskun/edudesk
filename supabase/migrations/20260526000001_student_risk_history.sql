CREATE TABLE student_risk_history (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id    uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  risk_level   text NOT NULL CHECK (risk_level IN ('high', 'medium', 'low')),
  risk_score   smallint NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  hw_misses    smallint NOT NULL DEFAULT 0,
  absences     smallint NOT NULL DEFAULT 0,
  snapshot_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON student_risk_history (student_id, snapshot_at DESC);
CREATE INDEX ON student_risk_history (teacher_id, snapshot_at DESC);

ALTER TABLE student_risk_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_risk_history_teacher_read" ON student_risk_history
  FOR SELECT USING (teacher_id = auth.uid());

CREATE POLICY "student_risk_history_teacher_insert" ON student_risk_history
  FOR INSERT WITH CHECK (teacher_id = auth.uid());
