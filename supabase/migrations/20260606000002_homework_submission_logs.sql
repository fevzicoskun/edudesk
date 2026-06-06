-- Ödev teslim durumu değişikliklerini izlemek için audit log tablosu.
-- Her updateSubmissionStatus çağrısında bir kayıt oluşturulur.
-- old_status NULL ise submission önceden yoktu (ilk kez yazıldı).

CREATE TABLE IF NOT EXISTS homework_submission_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id uuid        NOT NULL REFERENCES homeworks(id) ON DELETE CASCADE,
  student_id  uuid        NOT NULL,
  school_id   uuid        NOT NULL,
  changed_by  uuid        NOT NULL,
  old_status  text,
  new_status  text        NOT NULL,
  changed_at  timestamptz NOT NULL DEFAULT now()
);

-- Ödev + öğrenci bazlı kronolojik sorgu (StatusBoard geçmiş paneli için)
CREATE INDEX homework_submission_logs_hw_stu_idx
  ON homework_submission_logs (homework_id, student_id, changed_at DESC);

-- Okul bazlı RLS lookup
CREATE INDEX homework_submission_logs_school_idx
  ON homework_submission_logs (school_id);

ALTER TABLE homework_submission_logs ENABLE ROW LEVEL SECURITY;

-- Aynı okuldaki kullanıcılar kendi okullarının loglarını okuyabilir
CREATE POLICY "submission_logs_school_read" ON homework_submission_logs
  FOR SELECT TO authenticated
  USING (school_id = current_school_id());

-- Kullanıcı yalnızca kendi changed_by'ını yazabilir
CREATE POLICY "submission_logs_insert" ON homework_submission_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id  = current_school_id()
    AND changed_by = auth.uid()
  );
