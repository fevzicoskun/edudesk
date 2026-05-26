CREATE TABLE teacher_activity_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id   uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  action      text NOT NULL,
  meta        jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON teacher_activity_log (teacher_id, created_at DESC);

ALTER TABLE teacher_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_activity_log_own_read" ON teacher_activity_log
  FOR SELECT USING (teacher_id = auth.uid());

CREATE POLICY "teacher_activity_log_own_insert" ON teacher_activity_log
  FOR INSERT WITH CHECK (teacher_id = auth.uid());
