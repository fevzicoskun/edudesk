-- ─── RLS Update — Rol Bazlı Güvenlik ───────────────────────────────────────
-- Supabase Dashboard > SQL Editor'de çalıştır.
-- schema.sql'den SONRA çalıştırılmalıdır.

-- Yardımcı fonksiyon: mevcut kullanıcının zümre_baskani olup olmadığını kontrol eder
CREATE OR REPLACE FUNCTION is_zumre_baskani()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS(
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'zumre_baskani'
  )
$$;

-- ─── CLASSES ──────────────────────────────────────────────────────────────────
-- Okuma: tüm authenticated kullanıcılar
-- Yazma: yalnızca zümre_baskani

DROP POLICY IF EXISTS "classes_all" ON classes;

CREATE POLICY "classes_read"   ON classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "classes_insert" ON classes FOR INSERT TO authenticated WITH CHECK (is_zumre_baskani());
CREATE POLICY "classes_update" ON classes FOR UPDATE TO authenticated USING (is_zumre_baskani());
CREATE POLICY "classes_delete" ON classes FOR DELETE TO authenticated USING (is_zumre_baskani());

-- ─── ZUMRE MEETINGS ───────────────────────────────────────────────────────────
-- Okuma: tüm authenticated kullanıcılar
-- Oluşturma: yalnızca zümre_baskani
-- Düzenleme/Silme: oluşturan veya zümre_baskani

DROP POLICY IF EXISTS "meetings_all" ON zumre_meetings;

CREATE POLICY "meetings_read"   ON zumre_meetings FOR SELECT TO authenticated USING (true);
CREATE POLICY "meetings_insert" ON zumre_meetings FOR INSERT TO authenticated
  WITH CHECK (is_zumre_baskani());
CREATE POLICY "meetings_update" ON zumre_meetings FOR UPDATE TO authenticated
  USING (is_zumre_baskani() OR auth.uid() = created_by);
CREATE POLICY "meetings_delete" ON zumre_meetings FOR DELETE TO authenticated
  USING (is_zumre_baskani() OR auth.uid() = created_by);

-- ─── COMMON EXAMS ─────────────────────────────────────────────────────────────
-- Okuma: tüm authenticated kullanıcılar
-- Oluşturma: yalnızca zümre_baskani
-- Düzenleme/Silme: oluşturan veya zümre_baskani

DROP POLICY IF EXISTS "exams_all" ON common_exams;

CREATE POLICY "exams_read"   ON common_exams FOR SELECT TO authenticated USING (true);
CREATE POLICY "exams_insert" ON common_exams FOR INSERT TO authenticated
  WITH CHECK (is_zumre_baskani());
CREATE POLICY "exams_update" ON common_exams FOR UPDATE TO authenticated
  USING (is_zumre_baskani() OR auth.uid() = created_by);
CREATE POLICY "exams_delete" ON common_exams FOR DELETE TO authenticated
  USING (is_zumre_baskani() OR auth.uid() = created_by);

-- ─── HOMEWORK SUBMISSIONS ─────────────────────────────────────────────────────
-- UPDATE: yalnızca ödevin sahibi öğretmen veya zümre_baskani

DROP POLICY IF EXISTS "sub_update" ON homework_submissions;

CREATE POLICY "sub_update" ON homework_submissions FOR UPDATE TO authenticated
  USING (
    is_zumre_baskani() OR
    EXISTS(
      SELECT 1 FROM homeworks h
      WHERE h.id = homework_submissions.homework_id
        AND h.teacher_id = auth.uid()
    )
  );

-- ─── CURRICULUM PROGRESS ──────────────────────────────────────────────────────
-- Okuma: kendi kayıtları + zümre_baskani tümünü görür

DROP POLICY IF EXISTS "curriculum_all" ON curriculum_progress;

CREATE POLICY "curriculum_read" ON curriculum_progress FOR SELECT TO authenticated
  USING (is_zumre_baskani() OR auth.uid() = teacher_id);
CREATE POLICY "curriculum_insert" ON curriculum_progress FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "curriculum_update" ON curriculum_progress FOR UPDATE TO authenticated
  USING (is_zumre_baskani() OR auth.uid() = teacher_id);
CREATE POLICY "curriculum_delete" ON curriculum_progress FOR DELETE TO authenticated
  USING (is_zumre_baskani() OR auth.uid() = teacher_id);
