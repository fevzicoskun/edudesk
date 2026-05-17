-- homework_submissions INSERT + UPDATE policy'lerini sıkılaştır:
-- school_id yeterli değil; homework'un teacher_id = auth.uid() VEYA
-- kullanıcı zümre başkanı olmalı.

DROP POLICY IF EXISTS "submissions_owner_upsert" ON homework_submissions;
DROP POLICY IF EXISTS "submissions_owner_update" ON homework_submissions;

CREATE POLICY "submissions_owner_upsert" ON homework_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = current_school_id()
    AND EXISTS (
      SELECT 1 FROM homeworks h
      WHERE h.id = homework_submissions.homework_id
        AND (h.teacher_id = auth.uid() OR is_zumre_baskani_in_school())
    )
  );

CREATE POLICY "submissions_owner_update" ON homework_submissions
  FOR UPDATE TO authenticated
  USING (
    school_id = current_school_id()
    AND EXISTS (
      SELECT 1 FROM homeworks h
      WHERE h.id = homework_submissions.homework_id
        AND (h.teacher_id = auth.uid() OR is_zumre_baskani_in_school())
    )
  )
  WITH CHECK (
    school_id = current_school_id()
    AND EXISTS (
      SELECT 1 FROM homeworks h
      WHERE h.id = homework_submissions.homework_id
        AND (h.teacher_id = auth.uid() OR is_zumre_baskani_in_school())
    )
  );
