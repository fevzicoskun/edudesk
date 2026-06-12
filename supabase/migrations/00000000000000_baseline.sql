-- =============================================================================
-- BASELINE MIGRATION — EduDesk (zumre-takip)
-- Generated: 2026-06-12
-- Squashed from 51 incremental migrations (20260515 → 20260607)
-- Apply to a fresh Supabase project: supabase db push
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 20260515_cleanup_cron_jobs.sql
-- -----------------------------------------------------------------------------

-- pg_cron ile otomatik temizlik job'larÄ±
-- Retention sÃ¼relerini deÄŸiÅŸtirmek iÃ§in INTERVAL deÄŸerlerini gÃ¼ncelle

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- revoked_tokens: her gÃ¼n 02:00 UTC â€” 30 gÃ¼nden eski kayÄ±tlarÄ± sil
-- (token max Ã¶mrÃ¼ 7 gÃ¼n, 30 gÃ¼n gÃ¼venli marj)
SELECT cron.schedule(
  'cleanup-revoked-tokens',
  '0 2 * * *',
  $$
    DELETE FROM public.revoked_tokens
    WHERE revoked_at < NOW() - INTERVAL '30 days';
  $$
);

-- audit_logs: her ayÄ±n 1'i 03:00 UTC â€” 1 yÄ±ldan eski log'larÄ± sil
SELECT cron.schedule(
  'cleanup-audit-logs',
  '0 3 1 * *',
  $$
    DELETE FROM public.audit_logs
    WHERE created_at < NOW() - INTERVAL '1 year';
  $$
);

-- Job durumunu kontrol etmek iÃ§in:
-- SELECT jobname, schedule, active FROM cron.job;
-- Manuel tetiklemek iÃ§in:
-- SELECT cron.run_job('cleanup-revoked-tokens');

-- -----------------------------------------------------------------------------
-- 20260515_drop_okul_adi.sql
-- -----------------------------------------------------------------------------

-- profiles.okul_adi denormalizasyonu kaldÄ±rÄ±ldÄ± (2026-05-15)
-- Okul adÄ± artÄ±k schools.name JOIN ile Ã§ekiliyor (single source of truth)
-- Rollback: ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS okul_adi TEXT;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS okul_adi;

-- -----------------------------------------------------------------------------
-- 20260515_fix_homework_submissions_trigger.sql
-- -----------------------------------------------------------------------------

-- Fix: create_submissions_for_homework trigger'Ä± school_id geÃ§irmiyordu.
-- Phase3 NOT NULL migration'Ä± sonrasÄ± her yeni Ã¶dev oluÅŸturmada patlamaya neden oluyordu.
-- NEW.school_id homeworks INSERT'inden alÄ±nÄ±r â€” propagation doÄŸru.

CREATE OR REPLACE FUNCTION create_submissions_for_homework()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO homework_submissions (homework_id, student_id, school_id)
  SELECT NEW.id, s.id, NEW.school_id
  FROM students s
  WHERE s.class_id = NEW.class_id;
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 20260515_phase3_constraints_jobs_revocation.sql
-- -----------------------------------------------------------------------------

-- ============================================================
-- Migration: Phase 3 â€” NOT NULL constraints + token revocation + export jobs
-- Date: 2026-05-15
-- ============================================================

-- ============================================================
-- 1. school_id NOT NULL enforcement
--    (Only after Phase 1 migration backfilled all rows)
-- ============================================================
ALTER TABLE profiles       ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE classes        ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE students       ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE homeworks      ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE attendance     ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE zumre_meetings ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE common_exams   ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE curriculum_progress ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE student_notes  ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE homework_submissions ALTER COLUMN school_id SET NOT NULL;

-- ============================================================
-- 2. Token revocation table
-- ============================================================
CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti        text        PRIMARY KEY,           -- unique token ID (from payload.jti)
  token_type text        NOT NULL,              -- 'veli' | 'yoklama' | 'tutanak'
  revoked_at timestamptz NOT NULL DEFAULT now(),
  revoked_by uuid        REFERENCES auth.users(id),
  reason     text
);

ALTER TABLE revoked_tokens ENABLE ROW LEVEL SECURITY;

-- Only baskan can revoke tokens; anyone (including anon) can read for verify checks
CREATE POLICY "revoked_tokens_anon_read" ON revoked_tokens
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "revoked_tokens_baskan_insert" ON revoked_tokens
  FOR INSERT TO authenticated
  WITH CHECK (is_zumre_baskani_in_school());

CREATE POLICY "revoked_tokens_baskan_delete" ON revoked_tokens
  FOR DELETE TO authenticated
  USING (is_zumre_baskani_in_school());

-- ============================================================
-- 3. Export jobs table (background job queue)
-- ============================================================
CREATE TABLE IF NOT EXISTS export_jobs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid        NOT NULL REFERENCES schools(id),
  user_id     uuid        NOT NULL REFERENCES auth.users(id),
  job_type    text        NOT NULL CHECK (job_type IN ('excel_odevler', 'excel_yoklama', 'excel_mufredat', 'excel_notlar')),
  status      text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'error')),
  params      jsonb       NOT NULL DEFAULT '{}',
  result_url  text,
  error_msg   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own school's jobs
CREATE POLICY "export_jobs_school_read" ON export_jobs
  FOR SELECT TO authenticated
  USING (school_id = current_school_id() AND user_id = auth.uid());

CREATE POLICY "export_jobs_school_insert" ON export_jobs
  FOR INSERT TO authenticated
  WITH CHECK (school_id = current_school_id() AND user_id = auth.uid());

CREATE POLICY "export_jobs_school_update" ON export_jobs
  FOR UPDATE TO authenticated
  USING (school_id = current_school_id() AND user_id = auth.uid())
  WITH CHECK (school_id = current_school_id() AND user_id = auth.uid());

-- Index for polling
CREATE INDEX IF NOT EXISTS export_jobs_user_status ON export_jobs (user_id, status, created_at DESC);

-- -----------------------------------------------------------------------------
-- 20260515_profiles_school_rls.sql
-- -----------------------------------------------------------------------------

-- profiles tablosunu school_id bazÄ±nda izole et (KVKK)
-- Herkese aÃ§Ä±k SELECT policy kaldÄ±rÄ±ldÄ±

DROP POLICY IF EXISTS profiles_read_all ON profiles;

CREATE POLICY profiles_school_read ON profiles
FOR SELECT USING (
  auth.uid() = id
  OR (
    school_id IS NOT NULL
    AND school_id = current_school_id()
  )
);

-- -----------------------------------------------------------------------------
-- 20260515_rls_hardening.sql
-- -----------------------------------------------------------------------------

-- ============================================================
-- Migration: RLS Hardening (Least-Privilege)
-- Date: 2026-05-15
-- Description: school_id + role bazlÄ± sÄ±kÄ± RLS politikalarÄ±
-- ============================================================

-- ============================================================
-- classes â€” okul izolasyonu + baskan write
-- ============================================================
DROP POLICY IF EXISTS "classes_read" ON classes;
DROP POLICY IF EXISTS "classes_insert" ON classes;
DROP POLICY IF EXISTS "classes_update" ON classes;
DROP POLICY IF EXISTS "classes_delete" ON classes;

CREATE POLICY "classes_school_read" ON classes
  FOR SELECT TO authenticated
  USING (school_id = current_school_id());

CREATE POLICY "classes_baskan_insert" ON classes
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = current_school_id()
    AND is_zumre_baskani_in_school()
  );

CREATE POLICY "classes_baskan_delete" ON classes
  FOR DELETE TO authenticated
  USING (
    school_id = current_school_id()
    AND is_zumre_baskani_in_school()
  );

-- ============================================================
-- students â€” sÄ±nÄ±fÄ±n okulu Ã¼zerinden izolasyon
-- ============================================================
DROP POLICY IF EXISTS "students_all" ON students;
DROP POLICY IF EXISTS "students_school_read" ON students;
DROP POLICY IF EXISTS "students_school_insert" ON students;
DROP POLICY IF EXISTS "students_school_delete" ON students;

CREATE POLICY "students_school_read" ON students
  FOR SELECT TO authenticated
  USING (school_id = current_school_id());

CREATE POLICY "students_school_insert" ON students
  FOR INSERT TO authenticated
  WITH CHECK (school_id = current_school_id());

CREATE POLICY "students_school_delete" ON students
  FOR DELETE TO authenticated
  USING (school_id = current_school_id());

-- anon read for public portal
DROP POLICY IF EXISTS "students_anon_read" ON students;
CREATE POLICY "students_anon_read" ON students
  FOR SELECT TO anon
  USING (true);

-- ============================================================
-- homeworks â€” sahip + okul izolasyonu
-- ============================================================
DROP POLICY IF EXISTS "homeworks_all" ON homeworks;
DROP POLICY IF EXISTS "homeworks_school_read" ON homeworks;
DROP POLICY IF EXISTS "homeworks_owner_write" ON homeworks;
DROP POLICY IF EXISTS "homeworks_owner_delete" ON homeworks;

CREATE POLICY "homeworks_school_read" ON homeworks
  FOR SELECT TO authenticated
  USING (school_id = current_school_id());

CREATE POLICY "homeworks_owner_insert" ON homeworks
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = current_school_id()
    AND teacher_id = auth.uid()
  );

CREATE POLICY "homeworks_owner_delete" ON homeworks
  FOR DELETE TO authenticated
  USING (
    school_id = current_school_id()
    AND (teacher_id = auth.uid() OR is_zumre_baskani_in_school())
  );

-- ============================================================
-- homework_submissions â€” Ã¶dev sahibi + baskan write
-- ============================================================
DROP POLICY IF EXISTS "submissions_read" ON homework_submissions;
DROP POLICY IF EXISTS "submissions_update" ON homework_submissions;
DROP POLICY IF EXISTS "homework_submissions_read" ON homework_submissions;
DROP POLICY IF EXISTS "homework_submissions_update" ON homework_submissions;
DROP POLICY IF EXISTS "sub_update_owner_or_baskan" ON homework_submissions;

CREATE POLICY "submissions_school_read" ON homework_submissions
  FOR SELECT TO authenticated
  USING (school_id = current_school_id());

CREATE POLICY "submissions_owner_upsert" ON homework_submissions
  FOR INSERT TO authenticated
  WITH CHECK (school_id = current_school_id());

CREATE POLICY "submissions_owner_update" ON homework_submissions
  FOR UPDATE TO authenticated
  USING (school_id = current_school_id())
  WITH CHECK (school_id = current_school_id());

-- anon read for veli portal
DROP POLICY IF EXISTS "submissions_anon_read" ON homework_submissions;
CREATE POLICY "submissions_anon_read" ON homework_submissions
  FOR SELECT TO anon
  USING (true);

-- ============================================================
-- attendance â€” teacher ownership + okul izolasyonu
-- ============================================================
DROP POLICY IF EXISTS "attendance_own" ON attendance;
DROP POLICY IF EXISTS "attendance_public_read" ON attendance;

CREATE POLICY "attendance_school_read" ON attendance
  FOR SELECT TO authenticated
  USING (school_id = current_school_id());

CREATE POLICY "attendance_teacher_write" ON attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = current_school_id()
    AND teacher_id = auth.uid()
  );

CREATE POLICY "attendance_teacher_update" ON attendance
  FOR UPDATE TO authenticated
  USING (
    school_id = current_school_id()
    AND teacher_id = auth.uid()
  )
  WITH CHECK (
    school_id = current_school_id()
    AND teacher_id = auth.uid()
  );

-- anon read for public print page
CREATE POLICY "attendance_anon_read" ON attendance
  FOR SELECT TO anon
  USING (true);

-- ============================================================
-- zumre_meetings â€” okul izolasyonu + baskan write
-- ============================================================
DROP POLICY IF EXISTS "meetings_read" ON zumre_meetings;
DROP POLICY IF EXISTS "meetings_baskan_insert" ON zumre_meetings;
DROP POLICY IF EXISTS "meetings_baskan_update" ON zumre_meetings;
DROP POLICY IF EXISTS "meetings_baskan_delete" ON zumre_meetings;

CREATE POLICY "meetings_school_read" ON zumre_meetings
  FOR SELECT TO authenticated
  USING (school_id = current_school_id());

CREATE POLICY "meetings_baskan_insert" ON zumre_meetings
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = current_school_id()
    AND is_zumre_baskani_in_school()
    AND created_by = auth.uid()
  );

CREATE POLICY "meetings_baskan_update" ON zumre_meetings
  FOR UPDATE TO authenticated
  USING (school_id = current_school_id() AND is_zumre_baskani_in_school())
  WITH CHECK (school_id = current_school_id() AND is_zumre_baskani_in_school());

CREATE POLICY "meetings_baskan_delete" ON zumre_meetings
  FOR DELETE TO authenticated
  USING (school_id = current_school_id() AND is_zumre_baskani_in_school());

-- ============================================================
-- common_exams â€” okul izolasyonu + baskan write
-- ============================================================
DROP POLICY IF EXISTS "exams_read" ON common_exams;
DROP POLICY IF EXISTS "exams_baskan_insert" ON common_exams;
DROP POLICY IF EXISTS "exams_baskan_update" ON common_exams;
DROP POLICY IF EXISTS "exams_baskan_delete" ON common_exams;

CREATE POLICY "exams_school_read" ON common_exams
  FOR SELECT TO authenticated
  USING (school_id = current_school_id());

CREATE POLICY "exams_baskan_insert" ON common_exams
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = current_school_id()
    AND is_zumre_baskani_in_school()
    AND created_by = auth.uid()
  );

CREATE POLICY "exams_baskan_update" ON common_exams
  FOR UPDATE TO authenticated
  USING (school_id = current_school_id())
  WITH CHECK (school_id = current_school_id());

CREATE POLICY "exams_baskan_delete" ON common_exams
  FOR DELETE TO authenticated
  USING (school_id = current_school_id() AND is_zumre_baskani_in_school());

-- ============================================================
-- curriculum_progress â€” teacher + okul izolasyonu
-- ============================================================
DROP POLICY IF EXISTS "curriculum_read_own_baskan" ON curriculum_progress;
DROP POLICY IF EXISTS "curriculum_write_own" ON curriculum_progress;
DROP POLICY IF EXISTS "curriculum_delete_own" ON curriculum_progress;

CREATE POLICY "curriculum_school_read" ON curriculum_progress
  FOR SELECT TO authenticated
  USING (
    school_id = current_school_id()
    AND (teacher_id = auth.uid() OR is_zumre_baskani_in_school())
  );

CREATE POLICY "curriculum_teacher_insert" ON curriculum_progress
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = current_school_id()
    AND teacher_id = auth.uid()
  );

CREATE POLICY "curriculum_teacher_update" ON curriculum_progress
  FOR UPDATE TO authenticated
  USING (school_id = current_school_id() AND teacher_id = auth.uid())
  WITH CHECK (school_id = current_school_id() AND teacher_id = auth.uid());

CREATE POLICY "curriculum_teacher_delete" ON curriculum_progress
  FOR DELETE TO authenticated
  USING (school_id = current_school_id() AND teacher_id = auth.uid());

-- ============================================================
-- student_notes â€” teacher + okul
-- ============================================================
DROP POLICY IF EXISTS "student_notes_read" ON student_notes;
DROP POLICY IF EXISTS "student_notes_insert" ON student_notes;
DROP POLICY IF EXISTS "student_notes_delete" ON student_notes;

CREATE POLICY "student_notes_school_read" ON student_notes
  FOR SELECT TO authenticated
  USING (school_id = current_school_id());

CREATE POLICY "student_notes_teacher_insert" ON student_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = current_school_id()
    AND teacher_id = auth.uid()
  );

CREATE POLICY "student_notes_teacher_delete" ON student_notes
  FOR DELETE TO authenticated
  USING (school_id = current_school_id() AND teacher_id = auth.uid());

-- anon read for veli portal
CREATE POLICY "student_notes_anon_read" ON student_notes
  FOR SELECT TO anon
  USING (true);

-- -----------------------------------------------------------------------------
-- 20260515_schools_isolation.sql
-- -----------------------------------------------------------------------------

-- ============================================================
-- Migration: Multi-tenant school isolation
-- Date: 2026-05-15
-- Description: schools tablosu + tÃ¼m kritik tablolara school_id
-- ============================================================

-- 1. schools tablosu
CREATE TABLE IF NOT EXISTS schools (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Mevcut tÃ¼m veri iÃ§in varsayÄ±lan okul
-- Sabit UUID â€” migration'Ä±n idempotent olmasÄ± iÃ§in
INSERT INTO schools (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'VarsayÄ±lan Okul')
ON CONFLICT (id) DO NOTHING;

-- 3. profiles â€” school_id
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);
UPDATE profiles SET school_id = '00000000-0000-0000-0000-000000000001' WHERE school_id IS NULL;

-- 4. classes â€” school_id
ALTER TABLE classes ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);
UPDATE classes SET school_id = '00000000-0000-0000-0000-000000000001' WHERE school_id IS NULL;

-- 5. students â€” school_id (sÄ±nÄ±fÄ±n okulu miras alÄ±r)
ALTER TABLE students ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);
UPDATE students SET school_id = '00000000-0000-0000-0000-000000000001' WHERE school_id IS NULL;

-- 6. homeworks â€” school_id
ALTER TABLE homeworks ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);
UPDATE homeworks SET school_id = '00000000-0000-0000-0000-000000000001' WHERE school_id IS NULL;

-- 7. attendance â€” school_id
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);
UPDATE attendance SET school_id = '00000000-0000-0000-0000-000000000001' WHERE school_id IS NULL;

-- 8. zumre_meetings â€” school_id
ALTER TABLE zumre_meetings ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);
UPDATE zumre_meetings SET school_id = '00000000-0000-0000-0000-000000000001' WHERE school_id IS NULL;

-- 9. common_exams â€” school_id
ALTER TABLE common_exams ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);
UPDATE common_exams SET school_id = '00000000-0000-0000-0000-000000000001' WHERE school_id IS NULL;

-- 10. curriculum_progress â€” school_id
ALTER TABLE curriculum_progress ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);
UPDATE curriculum_progress SET school_id = '00000000-0000-0000-0000-000000000001' WHERE school_id IS NULL;

-- 11. student_notes â€” school_id (tablo varsa)
ALTER TABLE student_notes ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);
UPDATE student_notes SET school_id = '00000000-0000-0000-0000-000000000001' WHERE school_id IS NULL;

-- 12. homework_submissions â€” school_id
ALTER TABLE homework_submissions ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);
UPDATE homework_submissions SET school_id = '00000000-0000-0000-0000-000000000001' WHERE school_id IS NULL;

-- 13. audit_logs â€” school_id (varsa zaten, yoksa ekle)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);
UPDATE audit_logs SET school_id = '00000000-0000-0000-0000-000000000001' WHERE school_id IS NULL;

-- ============================================================
-- RLS Helper FonksiyonlarÄ±
-- ============================================================

CREATE OR REPLACE FUNCTION current_school_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION is_school_member(p_school_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND school_id = p_school_id
  )
$$;

CREATE OR REPLACE FUNCTION is_zumre_baskani_in_school()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'zumre_baskani'
  )
$$;

-- ============================================================
-- schools RLS
-- ============================================================
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schools_member_read" ON schools;
CREATE POLICY "schools_member_read" ON schools
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND school_id = schools.id
    )
  );

-- -----------------------------------------------------------------------------
-- 20260517_security_hardening.sql
-- -----------------------------------------------------------------------------

-- ============================================================
-- Migration: Security Hardening
-- 1. Anon blanket-read politikalarÄ±nÄ± kaldÄ±r
-- 2. is_zumre_baskani_in_school() school_id kontrolÃ¼ ekle
-- 3. homework_submissions DELETE policy ekle
-- 4. school_id yeniden atamayÄ± kilitle (trigger)
-- 5. admin_onboard_user RPC (onboarding iÃ§in)
-- 6. admin_set_profile RPC gÃ¼ncelle (school_change_allowed flag)
-- 7. profiles self-update policy ekle
-- ============================================================

-- 1. Anon blanket-read policies â€” service role zaten bypass ediyor,
--    bu politikalar anon key bilen herkese tÃ¼m okul verisini aÃ§Ä±yor.
DROP POLICY IF EXISTS "students_anon_read"      ON students;
DROP POLICY IF EXISTS "submissions_anon_read"   ON homework_submissions;
DROP POLICY IF EXISTS "attendance_anon_read"    ON attendance;
DROP POLICY IF EXISTS "student_notes_anon_read" ON student_notes;

-- 2. is_zumre_baskani_in_school: school_id kontrolÃ¼ eksikti,
--    baÅŸka okulun baÅŸkanÄ± da true dÃ¶nÃ¼yordu.
CREATE OR REPLACE FUNCTION is_zumre_baskani_in_school()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'zumre_baskani'
      AND school_id = current_school_id()
  )
$$;

-- 3. homework_submissions DELETE policy (Ã¶nceden yoktu, silme iÅŸlemi
--    RLS default-deny ile sessizce baÅŸarÄ±sÄ±z oluyordu).
DROP POLICY IF EXISTS "submissions_owner_delete" ON homework_submissions;
CREATE POLICY "submissions_owner_delete" ON homework_submissions
  FOR DELETE TO authenticated
  USING (
    school_id = current_school_id()
    AND EXISTS (
      SELECT 1 FROM homeworks h
      WHERE h.id = homework_submissions.homework_id
        AND (h.teacher_id = auth.uid() OR is_zumre_baskani_in_school())
    )
  );

-- 4. school_id yeniden atama trigger'Ä±
--    Zaten okulu olan kullanÄ±cÄ± baÅŸka okula geÃ§emez.
--    Admin iÅŸlemleri app.school_change_allowed='true' ile bypass eder.
CREATE OR REPLACE FUNCTION prevent_school_id_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.school_id IS NOT NULL
     AND NEW.school_id IS DISTINCT FROM OLD.school_id
     AND current_setting('app.school_change_allowed', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'school_id deÄŸiÅŸtirilemez';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_school_id_reassignment ON profiles;
CREATE TRIGGER prevent_school_id_reassignment
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  WHEN (NEW.school_id IS DISTINCT FROM OLD.school_id)
  EXECUTE FUNCTION prevent_school_id_change();

-- 5. admin_onboard_user RPC: onboarding iÃ§in school_id + opsiyonel rol atar.
CREATE OR REPLACE FUNCTION admin_onboard_user(
  p_id        uuid,
  p_school_id uuid,
  p_role      text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  PERFORM set_config('app.role_change_allowed',  'true', true);
  PERFORM set_config('app.school_change_allowed', 'true', true);
  IF p_role IS NOT NULL THEN
    UPDATE profiles SET school_id = p_school_id, role = p_role WHERE id = p_id;
  ELSE
    UPDATE profiles SET school_id = p_school_id WHERE id = p_id;
  END IF;
  PERFORM set_config('app.role_change_allowed',  'false', true);
  PERFORM set_config('app.school_change_allowed', 'false', true);
END;
$$;

-- 6. admin_set_profile: school_change_allowed flag'ini de ekle
CREATE OR REPLACE FUNCTION admin_set_profile(
  p_id        uuid,
  p_full_name text,
  p_subject   text,
  p_role      text,
  p_school_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  PERFORM set_config('app.role_change_allowed',  'true', true);
  PERFORM set_config('app.school_change_allowed', 'true', true);
  INSERT INTO profiles (id, full_name, subject, role, school_id)
  VALUES (p_id, p_full_name, p_subject, p_role, p_school_id)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    subject   = EXCLUDED.subject,
    role      = EXCLUDED.role,
    school_id = EXCLUDED.school_id;
  PERFORM set_config('app.role_change_allowed',  'false', true);
  PERFORM set_config('app.school_change_allowed', 'false', true);
END;
$$;

-- 7. profiles self-update policy: kullanÄ±cÄ± kendi profilini gÃ¼ncelleyebilir;
--    role + school_id triggerlarla korunuyor.
DROP POLICY IF EXISTS "profiles_self_update" ON profiles;
CREATE POLICY "profiles_self_update" ON profiles
  FOR UPDATE TO authenticated
  USING  (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- -----------------------------------------------------------------------------
-- 20260517_tighten_submissions_write_policy.sql
-- -----------------------------------------------------------------------------

-- homework_submissions INSERT + UPDATE policy'lerini sÄ±kÄ±laÅŸtÄ±r:
-- school_id yeterli deÄŸil; homework'un teacher_id = auth.uid() VEYA
-- kullanÄ±cÄ± zÃ¼mre baÅŸkanÄ± olmalÄ±.

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

-- -----------------------------------------------------------------------------
-- 20260518_retention_cron.sql
-- -----------------------------------------------------------------------------

-- Retention cron jobs (pg_cron already installed)
-- Run once; idempotent via job names

-- user_sessions: 90 gÃ¼n
SELECT cron.schedule(
  'retention_user_sessions',
  '0 3 * * *',
  $$DELETE FROM user_sessions WHERE created_at < now() - interval '90 days'$$
) ON CONFLICT DO NOTHING;

-- export_jobs: terminal durumlar 30 gÃ¼n
SELECT cron.schedule(
  'retention_export_jobs',
  '15 3 * * *',
  $$DELETE FROM export_jobs
    WHERE status IN ('done','error','cancelled','dead_letter')
      AND updated_at < now() - interval '30 days'$$
) ON CONFLICT DO NOTHING;

-- audit_logs: 2 yÄ±l (haftalÄ±k pazar sabahÄ±)
SELECT cron.schedule(
  'retention_audit_logs',
  '30 3 * * 0',
  $$DELETE FROM audit_logs WHERE created_at < now() - interval '2 years'$$
) ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 20260518_soft_delete_rls.sql
-- -----------------------------------------------------------------------------

-- Soft delete: update SELECT RLS policies to exclude soft-deleted records
-- Add UPDATE policies for soft delete / restore operations

-- classes
DROP POLICY IF EXISTS classes_school_read ON classes;
CREATE POLICY classes_school_read ON classes FOR SELECT
  USING (school_id = current_school_id() AND deleted_at IS NULL);

DROP POLICY IF EXISTS classes_manager_update ON classes;
CREATE POLICY classes_manager_update ON classes FOR UPDATE
  USING (school_id = current_school_id() AND can_manage_classes());

-- students
DROP POLICY IF EXISTS students_school_read ON students;
CREATE POLICY students_school_read ON students FOR SELECT
  USING (school_id = current_school_id() AND deleted_at IS NULL);

DROP POLICY IF EXISTS students_school_update ON students;
CREATE POLICY students_school_update ON students FOR UPDATE
  USING (school_id = current_school_id());

-- homeworks
DROP POLICY IF EXISTS homeworks_school_read ON homeworks;
CREATE POLICY homeworks_school_read ON homeworks FOR SELECT
  USING (school_id = current_school_id() AND deleted_at IS NULL);

DROP POLICY IF EXISTS homeworks_owner_update ON homeworks;
CREATE POLICY homeworks_owner_update ON homeworks FOR UPDATE
  USING (school_id = current_school_id() AND (teacher_id = auth.uid() OR is_zumre_baskani_in_school()));

-- zumre_meetings
DROP POLICY IF EXISTS meetings_school_read ON zumre_meetings;
CREATE POLICY meetings_school_read ON zumre_meetings FOR SELECT
  USING (school_id = current_school_id() AND can_see_zumre_item(branch) AND deleted_at IS NULL);

-- common_exams
DROP POLICY IF EXISTS exams_school_read ON common_exams;
CREATE POLICY exams_school_read ON common_exams FOR SELECT
  USING (school_id = current_school_id() AND can_see_zumre_item(subject) AND deleted_at IS NULL);

-- Restore UI: managers can read their school's soft-deleted records
CREATE POLICY classes_manager_read_deleted ON classes FOR SELECT
  USING (school_id = current_school_id() AND deleted_at IS NOT NULL AND can_manage_classes());

CREATE POLICY students_manager_read_deleted ON students FOR SELECT
  USING (school_id = current_school_id() AND deleted_at IS NOT NULL AND can_manage_classes());

CREATE POLICY homeworks_manager_read_deleted ON homeworks FOR SELECT
  USING (school_id = current_school_id() AND deleted_at IS NOT NULL AND is_zumre_baskani_in_school());

CREATE POLICY meetings_manager_read_deleted ON zumre_meetings FOR SELECT
  USING (school_id = current_school_id() AND deleted_at IS NOT NULL AND can_manage_zumre_item(branch));

CREATE POLICY exams_manager_read_deleted ON common_exams FOR SELECT
  USING (school_id = current_school_id() AND deleted_at IS NOT NULL AND can_manage_zumre_item(subject));

-- -----------------------------------------------------------------------------
-- 20260518_student_notes_fkeys.sql
-- -----------------------------------------------------------------------------

-- student_notes: student_id ve teacher_id FK kÄ±sÄ±tlarÄ± eksikti
-- PostgREST iliÅŸkiyi gÃ¶remediÄŸinden .select('students(full_name)') hata veriyordu

ALTER TABLE student_notes
  ADD CONSTRAINT student_notes_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  ADD CONSTRAINT student_notes_teacher_id_fkey
    FOREIGN KEY (teacher_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- -----------------------------------------------------------------------------
-- 20260518164330_normalize_exam_entries.sql
-- -----------------------------------------------------------------------------

-- common_exams.grades (integer[]) ve grade_map (jsonb) kaldÄ±rÄ±ldÄ±.
-- Not verileri artÄ±k exam_entries tablosunda tutulur.
-- Her satÄ±r: exam_id FK + opsiyonel student_id FK + opsiyonel name + grade integer.

CREATE TABLE exam_entries (
  id          UUID     DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_id     UUID     NOT NULL REFERENCES common_exams(id) ON DELETE CASCADE,
  student_id  UUID     REFERENCES students(id) ON DELETE SET NULL,
  name        TEXT     CHECK (name IS NULL OR char_length(name) <= 120),
  grade       SMALLINT NOT NULL CHECK (grade >= 0 AND grade <= 100),
  school_id   UUID     NOT NULL REFERENCES schools(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX exam_entries_exam_id_idx    ON exam_entries(exam_id);
CREATE INDEX exam_entries_school_id_idx  ON exam_entries(school_id);
CREATE INDEX exam_entries_student_id_idx ON exam_entries(student_id) WHERE student_id IS NOT NULL;

ALTER TABLE exam_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entries_school_read" ON exam_entries
  FOR SELECT TO authenticated
  USING (school_id = current_school_id());

CREATE POLICY "entries_baskan_insert" ON exam_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = current_school_id()
    AND is_zumre_baskani_in_school()
  );

CREATE POLICY "entries_baskan_delete" ON exam_entries
  FOR DELETE TO authenticated
  USING (
    school_id = current_school_id()
    AND is_zumre_baskani_in_school()
  );

ALTER TABLE common_exams DROP COLUMN IF EXISTS grades;
ALTER TABLE common_exams DROP COLUMN IF EXISTS grade_map;

-- -----------------------------------------------------------------------------
-- 20260519100000_add_mentor_teacher.sql
-- -----------------------------------------------------------------------------

-- classes tablosuna mentor_teacher_id ekle
ALTER TABLE classes ADD COLUMN IF NOT EXISTS mentor_teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Sadece mudur_yardimcisi mentor atayabilir
CREATE POLICY "mudur_yardimcisi_mentor_atama" ON classes
  FOR UPDATE
  USING (school_id = current_school_id())
  WITH CHECK (
    school_id = current_school_id() AND
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'mudur_yardimcisi'
  );

-- -----------------------------------------------------------------------------
-- 20260519110000_add_mentor_reports.sql
-- -----------------------------------------------------------------------------

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

-- Mentor kendi yazdÄ±klarÄ±nÄ± + yÃ¶neticiler tÃ¼m okul kayÄ±tlarÄ±nÄ± okuyabilir
CREATE POLICY "mentor_reports_select" ON mentor_reports
  FOR SELECT TO authenticated
  USING (
    school_id = current_school_id() AND (
      mentor_id = auth.uid() OR
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('mudur', 'mudur_yardimcisi')
    )
  );

-- Sadece sÄ±nÄ±fÄ±n atanmÄ±ÅŸ mentÃ¶rÃ¼ ekleyebilir
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

-- Sadece yazan mentÃ¶r silebilir
CREATE POLICY "mentor_reports_delete" ON mentor_reports
  FOR DELETE TO authenticated
  USING (mentor_id = auth.uid() AND school_id = current_school_id());

-- -----------------------------------------------------------------------------
-- 20260519130000_mentor_reports_zumre_baskani.sql
-- -----------------------------------------------------------------------------

-- ZÃ¼mre baÅŸkanÄ±nÄ±n da mentÃ¶r raporlarÄ±nÄ± gÃ¶rebilmesi
DROP POLICY IF EXISTS "mentor_reports_select" ON mentor_reports;
CREATE POLICY "mentor_reports_select" ON mentor_reports
  FOR SELECT TO authenticated
  USING (
    school_id = current_school_id() AND (
      mentor_id = auth.uid() OR
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('mudur', 'mudur_yardimcisi', 'zumre_baskani')
    )
  );

-- -----------------------------------------------------------------------------
-- 20260519150000_lesson_schedules.sql
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lesson_schedules (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  schedule_type TEXT        NOT NULL DEFAULT 'resmi' CHECK (schedule_type IN ('resmi', 'okul')),
  type_label    TEXT        NOT NULL DEFAULT 'Okul ProgramÄ±',
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

-- -----------------------------------------------------------------------------
-- 20260519160000_schedule_files.sql
-- -----------------------------------------------------------------------------

ALTER TABLE lesson_schedules
  ADD COLUMN IF NOT EXISTS file_url  TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT;

-- -----------------------------------------------------------------------------
-- 20260519170000_mentor_students.sql
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS mentor_students (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL CHECK (char_length(full_name) >= 2),
  parent_name TEXT,
  phone       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mentor_student_notes (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mentor_student_id UUID NOT NULL REFERENCES mentor_students(id) ON DELETE CASCADE,
  teacher_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id         UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  content           TEXT NOT NULL CHECK (char_length(content) >= 2),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mentor_students_teacher ON mentor_students(teacher_id, school_id);
CREATE INDEX IF NOT EXISTS idx_mentor_student_notes_student ON mentor_student_notes(mentor_student_id);

ALTER TABLE mentor_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_student_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mentor_students_select" ON mentor_students
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "mentor_students_insert" ON mentor_students
  FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "mentor_students_delete" ON mentor_students
  FOR DELETE TO authenticated
  USING (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "mentor_student_notes_select" ON mentor_student_notes
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "mentor_student_notes_insert" ON mentor_student_notes
  FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "mentor_student_notes_delete" ON mentor_student_notes
  FOR DELETE TO authenticated
  USING (teacher_id = auth.uid() AND school_id = current_school_id());

-- -----------------------------------------------------------------------------
-- 20260519200000_tenant_management.sql
-- -----------------------------------------------------------------------------

-- Tenant Management: SaaS multi-school lifecycle control
-- Adds platform_admins table, school status/plan columns, quotas, and metrics views.

-- â”€â”€â”€ 1. Platform Admins â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Super-admins who can manage any school tenant.
-- Separate from school RBAC â€” these users have cross-tenant visibility.

create table if not exists platform_admins (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);

-- Only service_role can read/write platform_admins
alter table platform_admins enable row level security;

create policy "platform_admins: service_role only"
  on platform_admins
  using (false)
  with check (false);

-- â”€â”€â”€ 2. School Tenant Status & Plan â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

alter table schools
  add column if not exists status       text not null default 'active'
    check (status in ('active', 'suspended', 'trial', 'cancelled')),
  add column if not exists plan         text not null default 'free'
    check (plan in ('free', 'starter', 'pro', 'enterprise')),
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_by uuid references auth.users(id),
  add column if not exists trial_ends_at timestamptz;

-- â”€â”€â”€ 3. School Quotas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

create table if not exists school_quotas (
  school_id           uuid primary key references schools(id) on delete cascade,
  max_teachers        int  not null default 20,
  max_students        int  not null default 500,
  max_storage_mb      int  not null default 1024,
  used_storage_mb     int  not null default 0,
  updated_at          timestamptz not null default now()
);

-- Seed default quotas for existing schools
insert into school_quotas (school_id)
select id from schools
on conflict (school_id) do nothing;

-- Only service_role and school-scoped reads via function
alter table school_quotas enable row level security;

create policy "school_quotas: school members read own"
  on school_quotas for select
  using (
    exists (
      select 1 from profiles
       where profiles.user_id = auth.uid()
         and profiles.school_id = school_quotas.school_id
    )
  );

-- â”€â”€â”€ 4. Blocked access for suspended schools â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- RLS helper function: returns false for suspended schools.
-- Import into existing policies where needed.

create or replace function school_is_active(sid uuid)
returns boolean
language sql stable security definer
as $$
  select exists (
    select 1 from schools
     where id = sid
       and status = 'active'
  )
$$;

-- â”€â”€â”€ 5. Tenant Metrics View â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Used by super-admin dashboard â€” cross-school aggregate.
-- Not exposed via RLS; read by service_role only.

create or replace view tenant_metrics as
select
  s.id                                          as school_id,
  s.name                                        as school_name,
  s.status,
  s.plan,
  s.created_at,
  s.trial_ends_at,
  count(distinct p.user_id) filter (
    where p.role not in ('veli', 'ogrenci')
  )                                             as teacher_count,
  count(distinct st.id)                         as student_count,
  coalesce(q.max_teachers,  20)                 as max_teachers,
  coalesce(q.max_students,  500)                as max_students,
  coalesce(q.used_storage_mb, 0)                as used_storage_mb,
  coalesce(q.max_storage_mb, 1024)              as max_storage_mb,
  count(distinct ej.id) filter (
    where ej.status = 'failed'
    and   ej.created_at > now() - interval '7 days'
  )                                             as failed_exports_7d
from schools s
left join profiles       p  on p.school_id = s.id
left join students       st on st.school_id = s.id
left join school_quotas  q  on q.school_id  = s.id
left join export_jobs    ej on ej.school_id = s.id
group by s.id, s.name, s.status, s.plan, s.created_at, s.trial_ends_at,
         q.max_teachers, q.max_students, q.used_storage_mb, q.max_storage_mb;

-- â”€â”€â”€ 6. Updated-at trigger for quotas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end
$$;

drop trigger if exists school_quotas_updated_at on school_quotas;
create trigger school_quotas_updated_at
  before update on school_quotas
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- 20260519210000_wire_school_active_check.sql
-- -----------------------------------------------------------------------------

-- Add suspended-school guard to the most critical read tables.
-- school_is_active() was defined in 20260519200000 but not wired into any policy.
-- We add it as an additional condition on existing SELECT policies for profiles,
-- homeworks, and attendance â€” the tables users query on login and throughout the day.

-- This approach appends to existing policies via a helper rather than replacing them,
-- so existing isolation is preserved.

-- Gate: a function readable by authenticated users that checks school status
create or replace function auth_school_is_active()
returns boolean
language sql stable security definer
as $$
  select exists (
    select 1 from schools
     where id = (
       select school_id from profiles where user_id = auth.uid() limit 1
     )
       and status = 'active'
  )
$$;

-- -----------------------------------------------------------------------------
-- 20260519220000_analytics_functions.sql
-- -----------------------------------------------------------------------------

-- at_risk_student_count: counts students with >= min_days recorded and attendance_rate < threshold
-- Replaces the client-side Map aggregation in the analytics route.
create or replace function at_risk_student_count(
  p_school_id  uuid,
  p_since      date,
  p_min_days   int     default 5,
  p_threshold  numeric default 0.7
)
returns bigint
language sql stable security definer
as $$
  select count(*)
  from (
    select student_id
    from attendance
    where school_id = p_school_id
      and date >= p_since
    group by student_id
    having count(*) >= p_min_days
       and count(*) filter (where status = 'present')::numeric / count(*) < p_threshold
  ) sub
$$;

-- Atomic storage increment â€” avoids read-modify-write race condition
create or replace function increment_school_storage(p_school_id uuid, p_delta_mb int)
returns void
language sql
as $$
  update school_quotas
  set used_storage_mb = greatest(0, used_storage_mb + p_delta_mb),
      updated_at = now()
  where school_id = p_school_id
$$;

-- -----------------------------------------------------------------------------
-- 20260519230000_enforce_school_status_rls.sql
-- -----------------------------------------------------------------------------

-- Enforce school suspension: modify current_school_id() to return NULL when
-- school is not active. Every downstream policy using current_school_id()
-- automatically blocks suspended tenants â€” no individual policy changes needed.

create or replace function current_school_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select p.school_id
  from profiles p
  join schools s on s.id = p.school_id
  where p.id = auth.uid()
    and s.status = 'active'
$$;

-- count_active_teachers: distinct teacher count â€” replaces client-side Set dedup
create or replace function count_active_teachers(p_school_id uuid, p_since date)
returns bigint
language sql stable security definer
as $$
  select count(distinct teacher_id)
  from homeworks
  where school_id = p_school_id
    and deleted_at is null
    and created_at >= p_since
$$;

-- -----------------------------------------------------------------------------
-- 20260521000000_fix_roles_and_class_rls.sql
-- -----------------------------------------------------------------------------

-- â”€â”€â”€ Rol kÄ±sÄ±tÄ±nÄ± 4 role geniÅŸlet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- schema.sql'deki CHECK sadece 2 rol iÃ§eriyordu; tÃ¼m geÃ§erli rolleri ekle.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('ogretmen', 'zumre_baskani', 'mudur_yardimcisi', 'mudur'));

-- â”€â”€â”€ YardÄ±mcÄ± fonksiyon â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE FUNCTION is_mudur_yardimcisi_or_above()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS(
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('mudur_yardimcisi', 'mudur')
  )
$$;

-- â”€â”€â”€ SÄ±nÄ±f RLS: sadece mudur_yardimcisi ve mÃ¼dÃ¼r yazabilir â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DROP POLICY IF EXISTS "classes_insert" ON classes;
DROP POLICY IF EXISTS "classes_update" ON classes;
DROP POLICY IF EXISTS "classes_delete" ON classes;

CREATE POLICY "classes_insert" ON classes FOR INSERT TO authenticated
  WITH CHECK (is_mudur_yardimcisi_or_above());
CREATE POLICY "classes_update" ON classes FOR UPDATE TO authenticated
  USING (is_mudur_yardimcisi_or_above());
CREATE POLICY "classes_delete" ON classes FOR DELETE TO authenticated
  USING (is_mudur_yardimcisi_or_above());

-- -----------------------------------------------------------------------------
-- 20260523000000_notifications.sql
-- -----------------------------------------------------------------------------

-- 1. students tablosuna veli_email sÃ¼tunu
ALTER TABLE students ADD COLUMN IF NOT EXISTS veli_email TEXT;

-- 2. Bildirim tercihleri (Ã¶ÄŸretmen baÅŸÄ±na)
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  days_before  SMALLINT NOT NULL DEFAULT 1 CHECK (days_before BETWEEN 1 AND 7),
  email_on     BOOLEAN  NOT NULL DEFAULT true,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kullanici kendi tercihlerini okuyabilir"
  ON notification_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Kullanici kendi tercihlerini yazabilir"
  ON notification_preferences FOR ALL
  USING (user_id = auth.uid());

-- 3. In-app bildirimler
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id   UUID        NOT NULL,
  title       TEXT        NOT NULL,
  body        TEXT,
  homework_id UUID        REFERENCES homeworks(id) ON DELETE CASCADE,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kullanici kendi bildirimlerini okuyabilir"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Kullanici kendi bildirimlerini guncelleyebilir"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Service role insert iÃ§in policy (cron job)
CREATE POLICY "Service role bildirim ekleyebilir"
  ON notifications FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS notifications_user_unread
  ON notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

-- -----------------------------------------------------------------------------
-- 20260523000100_add_veli_telefon.sql
-- -----------------------------------------------------------------------------

ALTER TABLE students ADD COLUMN IF NOT EXISTS veli_telefon TEXT;

-- -----------------------------------------------------------------------------
-- 20260523000200_add_veli_ad.sql
-- -----------------------------------------------------------------------------

ALTER TABLE students ADD COLUMN IF NOT EXISTS veli_ad TEXT;

-- -----------------------------------------------------------------------------
-- 20260523000300_add_veli_email_opt_out.sql
-- -----------------------------------------------------------------------------

ALTER TABLE students ADD COLUMN veli_email_opt_out BOOLEAN NOT NULL DEFAULT FALSE;

-- -----------------------------------------------------------------------------
-- 20260524000000_announcements.sql
-- -----------------------------------------------------------------------------

-- Duyuru tablolarÄ±

CREATE TABLE announcements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  message      TEXT NOT NULL,
  created_by   UUID NOT NULL REFERENCES auth.users(id),
  target_roles TEXT[] NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE announcement_reads (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id  UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id),
  read_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE (announcement_id, user_id)
);

CREATE INDEX idx_announcement_reads_user ON announcement_reads (user_id, announcement_id);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;

-- Sadece mÃ¼dÃ¼r/MY duyuru oluÅŸturabilir
CREATE POLICY "insert_announcements" ON announcements
  FOR INSERT WITH CHECK (
    school_id = current_school_id() AND
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('mudur', 'mudur_yardimcisi')
    )
  );

-- Hedeflenen role sahip kiÅŸiler veya gÃ¶nderen kendi duyurularÄ±nÄ± gÃ¶rebilir
CREATE POLICY "select_announcements" ON announcements
  FOR SELECT USING (
    school_id = current_school_id() AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
          AND p.role = ANY(target_roles)
      )
    )
  );

CREATE POLICY "select_reads" ON announcement_reads
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "insert_reads" ON announcement_reads
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 20260524000001_get_first_unread_announcement_fn.sql
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_first_unread_announcement(
  p_user_id   UUID,
  p_user_role TEXT,
  p_school_id UUID
)
RETURNS SETOF announcements
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.*
  FROM announcements a
  WHERE a.school_id = p_school_id
    AND a.created_by != p_user_id
    AND p_user_role = ANY(a.target_roles)
    AND NOT EXISTS (
      SELECT 1 FROM announcement_reads ar
      WHERE ar.announcement_id = a.id
        AND ar.user_id = p_user_id
    )
  ORDER BY a.created_at ASC
  LIMIT 1;
$$;

-- -----------------------------------------------------------------------------
-- 20260524000002_announcement_sender_name.sql
-- -----------------------------------------------------------------------------

-- RPC'ye sender_name JOIN ekle

DROP FUNCTION IF EXISTS get_first_unread_announcement(UUID, TEXT, UUID);

CREATE TYPE unread_announcement_row AS (
  id           UUID,
  school_id    UUID,
  message      TEXT,
  created_by   UUID,
  sender_name  TEXT,
  target_roles TEXT[],
  created_at   TIMESTAMPTZ
);

CREATE OR REPLACE FUNCTION get_first_unread_announcement(
  p_user_id   UUID,
  p_user_role TEXT,
  p_school_id UUID
)
RETURNS SETOF unread_announcement_row
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.school_id, a.message, a.created_by,
         p.full_name AS sender_name,
         a.target_roles, a.created_at
  FROM announcements a
  JOIN profiles p ON p.id = a.created_by
  WHERE a.school_id = p_school_id
    AND a.created_by != p_user_id
    AND p_user_role = ANY(a.target_roles)
    AND NOT EXISTS (
      SELECT 1 FROM announcement_reads ar
      WHERE ar.announcement_id = a.id
        AND ar.user_id = p_user_id
    )
  ORDER BY a.created_at ASC
  LIMIT 1;
$$;

-- -----------------------------------------------------------------------------
-- 20260524100000_revoked_tokens_rls_v2.sql
-- -----------------------------------------------------------------------------

-- revoked_tokens RLS v2
-- DeÄŸiÅŸiklikler:
--   1. SELECT: anon eriÅŸimi kaldÄ±rÄ±ldÄ± (yalnÄ±zca authenticated)
--   2. INSERT/DELETE: is_zumre_baskani_in_school() â†’ can_revoke_tokens() (mudur + MY + baskan)
--   3. DELETE: WORM gÃ¼vencesi korunuyor â€” sadece can_revoke_tokens() silebilir
-- Not: token doÄŸrulama artÄ±k service role client ile yapÄ±lÄ±r (anon'a gerek yok)

-- Eski politikalarÄ± kaldÄ±r
DROP POLICY IF EXISTS "revoked_tokens_anon_read"     ON revoked_tokens;
DROP POLICY IF EXISTS "revoked_tokens_baskan_insert" ON revoked_tokens;
DROP POLICY IF EXISTS "revoked_tokens_baskan_delete" ON revoked_tokens;
DROP POLICY IF EXISTS "revoked_tokens_server_read"   ON revoked_tokens;
DROP POLICY IF EXISTS "revoked_tokens_manager_insert" ON revoked_tokens;
DROP POLICY IF EXISTS "revoked_tokens_manager_delete" ON revoked_tokens;

-- Yeni politikalar
CREATE POLICY "revoked_tokens_server_read" ON revoked_tokens
  FOR SELECT TO public
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "revoked_tokens_manager_insert" ON revoked_tokens
  FOR INSERT TO authenticated
  WITH CHECK (can_revoke_tokens());

-- DELETE sadece can_revoke_tokens() â€” WORM gÃ¼vencesi korunuyor
CREATE POLICY "revoked_tokens_manager_delete" ON revoked_tokens
  FOR DELETE TO authenticated
  USING (can_revoke_tokens());

-- can_revoke_tokens() fonksiyonu (idempotent)
CREATE OR REPLACE FUNCTION public.can_revoke_tokens()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('mudur', 'mudur_yardimcisi', 'zumre_baskani')
      AND school_id = current_school_id()
  )
$$;

-- -----------------------------------------------------------------------------
-- 20260524110000_revoked_tokens_issuer_can_revoke.sql
-- -----------------------------------------------------------------------------

-- revoked_tokens INSERT policy v2
-- Sorun: ogretmen kendi oluÅŸturduÄŸu veli tokenÄ±nÄ± revoke edemiyordu.
-- Servis katmanÄ± izin veriyordu ama RLS engelliyordu.
--
-- Ã‡Ã¶zÃ¼m: INSERT policy'ye ikinci koÅŸul eklendi:
--   can_revoke_tokens() â†’ yÃ¶neticiler her tokenÄ± revoke edebilir
--   OR issued_by = auth.uid() â†’ token sahibi kendi oluÅŸturduÄŸu tokenÄ± revoke edebilir

DROP POLICY IF EXISTS "revoked_tokens_manager_insert" ON revoked_tokens;

CREATE POLICY "revoked_tokens_manager_insert" ON revoked_tokens
  FOR INSERT TO authenticated
  WITH CHECK (
    can_revoke_tokens()
    OR EXISTS (
      SELECT 1 FROM veli_tokens
      WHERE veli_tokens.jti = revoked_tokens.jti
        AND veli_tokens.issued_by = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 20260525000000_create_grade_columns.sql
-- -----------------------------------------------------------------------------

-- grade_columns: Ã¶ÄŸretmenin oluÅŸturduÄŸu her Ã¶lÃ§me sÃ¼tunu (YazÄ±lÄ± 1, Quiz 3, Proje...)
CREATE TABLE IF NOT EXISTS grade_columns (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id  UUID    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id    UUID    NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  school_id   UUID    NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  grade_type  TEXT    NOT NULL CHECK (grade_type IN ('yazili', 'quiz', 'proje')),
  max_score   SMALLINT NOT NULL DEFAULT 100 CHECK (max_score BETWEEN 1 AND 1000),
  exam_date   DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS grade_columns_class_id_idx    ON grade_columns(class_id);
CREATE INDEX IF NOT EXISTS grade_columns_teacher_id_idx  ON grade_columns(teacher_id);
CREATE INDEX IF NOT EXISTS grade_columns_school_id_idx   ON grade_columns(school_id);

ALTER TABLE grade_columns ENABLE ROW LEVEL SECURITY;

-- Ã–ÄŸretmen kendi sÃ¼tunlarÄ±nÄ± gÃ¶rÃ¼r; yÃ¶neticiler tÃ¼m okul sÃ¼tunlarÄ±nÄ± gÃ¶rÃ¼r
CREATE POLICY "grade_columns_select" ON grade_columns
  FOR SELECT TO authenticated
  USING (
    school_id = current_school_id()
    AND (
      teacher_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('mudur', 'mudur_yardimcisi', 'zumre_baskani')
      )
    )
  );

-- Ã–ÄŸretmen ve zÃ¼mre baÅŸkanÄ± kendi adÄ±na sÃ¼tun oluÅŸturur
CREATE POLICY "grade_columns_insert" ON grade_columns
  FOR INSERT TO authenticated
  WITH CHECK (
    teacher_id = auth.uid()
    AND school_id = current_school_id()
  );

-- YalnÄ±zca sÃ¼tunun sahibi dÃ¼zenleyebilir
CREATE POLICY "grade_columns_update" ON grade_columns
  FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid() AND school_id = current_school_id())
  WITH CHECK (teacher_id = auth.uid() AND school_id = current_school_id());

-- YalnÄ±zca sÃ¼tunun sahibi silebilir
CREATE POLICY "grade_columns_delete" ON grade_columns
  FOR DELETE TO authenticated
  USING (teacher_id = auth.uid() AND school_id = current_school_id());

-- -----------------------------------------------------------------------------
-- 20260525000001_create_grade_entries.sql
-- -----------------------------------------------------------------------------

-- grade_entries: her Ã¶ÄŸrencinin bir sÃ¼tundaki puanÄ±
CREATE TABLE IF NOT EXISTS grade_entries (
  id               UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  grade_column_id  UUID         NOT NULL REFERENCES grade_columns(id) ON DELETE CASCADE,
  student_id       UUID         NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id        UUID         NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  score            NUMERIC(5,1) CHECK (score >= 0),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(grade_column_id, student_id)
);

CREATE INDEX IF NOT EXISTS grade_entries_column_id_idx  ON grade_entries(grade_column_id);
CREATE INDEX IF NOT EXISTS grade_entries_student_id_idx ON grade_entries(student_id);
CREATE INDEX IF NOT EXISTS grade_entries_school_id_idx  ON grade_entries(school_id);

ALTER TABLE grade_entries ENABLE ROW LEVEL SECURITY;

-- Ã–ÄŸretmen kendi sÃ¼tunlarÄ±nÄ±n notlarÄ±nÄ± gÃ¶rÃ¼r; yÃ¶neticiler tÃ¼m okul notlarÄ±nÄ± gÃ¶rÃ¼r
CREATE POLICY "grade_entries_select" ON grade_entries
  FOR SELECT TO authenticated
  USING (
    school_id = current_school_id()
    AND (
      EXISTS (
        SELECT 1 FROM grade_columns gc
        WHERE gc.id = grade_column_id
          AND gc.teacher_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('mudur', 'mudur_yardimcisi', 'zumre_baskani')
      )
    )
  );

-- YalnÄ±zca sÃ¼tunun sahibi not ekleyebilir
CREATE POLICY "grade_entries_insert" ON grade_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = current_school_id()
    AND EXISTS (
      SELECT 1 FROM grade_columns gc
      WHERE gc.id = grade_column_id
        AND gc.teacher_id = auth.uid()
        AND gc.school_id = current_school_id()
    )
  );

-- YalnÄ±zca sÃ¼tunun sahibi not gÃ¼ncelleyebilir
CREATE POLICY "grade_entries_update" ON grade_entries
  FOR UPDATE TO authenticated
  USING (
    school_id = current_school_id()
    AND EXISTS (
      SELECT 1 FROM grade_columns gc
      WHERE gc.id = grade_column_id AND gc.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    school_id = current_school_id()
    AND EXISTS (
      SELECT 1 FROM grade_columns gc
      WHERE gc.id = grade_column_id AND gc.teacher_id = auth.uid()
    )
  );

-- YalnÄ±zca sÃ¼tunun sahibi not silebilir
CREATE POLICY "grade_entries_delete" ON grade_entries
  FOR DELETE TO authenticated
  USING (
    school_id = current_school_id()
    AND EXISTS (
      SELECT 1 FROM grade_columns gc
      WHERE gc.id = grade_column_id AND gc.teacher_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 20260525000002_grades_rbac_seed.sql
-- -----------------------------------------------------------------------------

-- grades resource izinleri â€” Ã¶ÄŸretmen yazar, yÃ¶neticiler okur
-- Idempotent: ON CONFLICT DO NOTHING ile tekrar Ã§alÄ±ÅŸtÄ±rÄ±labilir

INSERT INTO permissions (id, resource, action, scope, description) VALUES
  (gen_random_uuid(), 'grades', 'create', 'own',    'Not defteri sÃ¼tunu oluÅŸtur'),
  (gen_random_uuid(), 'grades', 'read',   'own',    'Kendi not defterini gÃ¶r'),
  (gen_random_uuid(), 'grades', 'read',   'school', 'TÃ¼m not defterlerini gÃ¶r'),
  (gen_random_uuid(), 'grades', 'update', 'own',    'Kendi not defteri giriÅŸlerini gÃ¼ncelle'),
  (gen_random_uuid(), 'grades', 'delete', 'own',    'Kendi not defteri sÃ¼tununu sil')
ON CONFLICT (resource, action, scope) DO NOTHING;

-- ogretmen + zumre_baskani: yazma (own) + okuma (own)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.resource = 'grades'
  AND p.action IN ('create', 'update', 'delete')
  AND p.scope = 'own'
  AND r.name IN ('ogretmen', 'zumre_baskani', 'mudur_yardimcisi', 'mudur')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.resource = 'grades'
  AND p.action = 'read'
  AND p.scope = 'own'
  AND r.name IN ('ogretmen', 'zumre_baskani', 'mudur_yardimcisi', 'mudur')
ON CONFLICT DO NOTHING;

-- zumre_baskani + mudur_yardimcisi + mudur: okul geneli okuma
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.resource = 'grades'
  AND p.action = 'read'
  AND p.scope = 'school'
  AND r.name IN ('zumre_baskani', 'mudur_yardimcisi', 'mudur')
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 20260526000000_teacher_activity_log.sql
-- -----------------------------------------------------------------------------

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

-- -----------------------------------------------------------------------------
-- 20260526000001_student_risk_history.sql
-- -----------------------------------------------------------------------------

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

-- -----------------------------------------------------------------------------
-- 20260527000000_inspection_tables.sql
-- -----------------------------------------------------------------------------

-- â”€â”€ daily_plans â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE daily_plans (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id        uuid        NOT NULL REFERENCES schools(id)    ON DELETE CASCADE,
  class_id         uuid        NOT NULL REFERENCES classes(id)    ON DELETE CASCADE,
  plan_date        date        NOT NULL,
  lesson_hour      smallint    NOT NULL CHECK (lesson_hour BETWEEN 1 AND 8),
  unit             text        NOT NULL,
  topic            text        NOT NULL,
  objectives       text[]      NOT NULL DEFAULT '{}',
  methods          text[]      NOT NULL DEFAULT '{}',
  materials        text[]      NOT NULL DEFAULT '{}',
  intro_text       text        NOT NULL,
  development_text text        NOT NULL,
  conclusion_text  text        NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

CREATE INDEX ON daily_plans (teacher_id, plan_date DESC);
CREATE INDEX ON daily_plans (school_id, class_id);
CREATE UNIQUE INDEX ON daily_plans (teacher_id, class_id, plan_date, lesson_hour) WHERE deleted_at IS NULL;

ALTER TABLE daily_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_plans_own_select" ON daily_plans
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() AND school_id = current_school_id() AND deleted_at IS NULL);

CREATE POLICY "daily_plans_own_insert" ON daily_plans
  FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "daily_plans_own_update" ON daily_plans
  FOR UPDATE TO authenticated
  USING  (teacher_id = auth.uid() AND school_id = current_school_id())
  WITH CHECK (teacher_id = auth.uid() AND school_id = current_school_id());

-- â”€â”€ annual_plans â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE annual_plans (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id     uuid        NOT NULL REFERENCES schools(id)    ON DELETE CASCADE,
  academic_year text        NOT NULL,
  subject       text        NOT NULL,
  weekly_plan   jsonb       NOT NULL DEFAULT '[]',
  approved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ON annual_plans (teacher_id, school_id, academic_year, subject);

ALTER TABLE annual_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "annual_plans_own_select" ON annual_plans
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "annual_plans_own_insert" ON annual_plans
  FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "annual_plans_own_update" ON annual_plans
  FOR UPDATE TO authenticated
  USING  (teacher_id = auth.uid() AND school_id = current_school_id())
  WITH CHECK (teacher_id = auth.uid() AND school_id = current_school_id());

-- â”€â”€ sok_reports â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE sok_reports (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id     uuid        NOT NULL REFERENCES schools(id)    ON DELETE CASCADE,
  class_id      uuid        NOT NULL REFERENCES classes(id)    ON DELETE CASCADE,
  meeting_date  date        NOT NULL,
  term          smallint    NOT NULL CHECK (term IN (1, 2)),
  academic_year text        NOT NULL,
  participants  jsonb       NOT NULL DEFAULT '[]',
  agenda_items  jsonb       NOT NULL DEFAULT '[]',
  decisions     jsonb       NOT NULL DEFAULT '[]',
  student_notes jsonb       NOT NULL DEFAULT '[]',
  created_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

CREATE INDEX ON sok_reports (teacher_id, meeting_date DESC);
CREATE INDEX ON sok_reports (school_id, meeting_date DESC);

ALTER TABLE sok_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sok_reports_own_select" ON sok_reports
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() AND school_id = current_school_id() AND deleted_at IS NULL);

CREATE POLICY "sok_reports_own_insert" ON sok_reports
  FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "sok_reports_own_update" ON sok_reports
  FOR UPDATE TO authenticated
  USING  (teacher_id = auth.uid() AND school_id = current_school_id())
  WITH CHECK (teacher_id = auth.uid() AND school_id = current_school_id());

-- â”€â”€ notebook_checks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE notebook_checks (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id   uuid        NOT NULL REFERENCES schools(id)    ON DELETE CASCADE,
  class_id    uuid        NOT NULL REFERENCES classes(id)    ON DELETE CASCADE,
  check_date  date        NOT NULL,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON notebook_checks (teacher_id, check_date DESC);

ALTER TABLE notebook_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notebook_checks_own_select" ON notebook_checks
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "notebook_checks_own_insert" ON notebook_checks
  FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "notebook_checks_own_update" ON notebook_checks
  FOR UPDATE TO authenticated
  USING  (teacher_id = auth.uid() AND school_id = current_school_id())
  WITH CHECK (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "notebook_checks_own_delete" ON notebook_checks
  FOR DELETE TO authenticated
  USING (teacher_id = auth.uid() AND school_id = current_school_id());

-- -----------------------------------------------------------------------------
-- 20260527000001_inspection_tables_fix.sql
-- -----------------------------------------------------------------------------

-- Corrective migration: fixes security and integrity issues introduced in
-- 20260527000000_inspection_tables.sql which was already applied to the live DB.

-- â”€â”€ 1. Add TO authenticated + WITH CHECK to all UPDATE policies â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- daily_plans
DROP POLICY "daily_plans_own_select" ON daily_plans;
DROP POLICY "daily_plans_own_insert" ON daily_plans;
DROP POLICY "daily_plans_own_update" ON daily_plans;

CREATE POLICY "daily_plans_own_select" ON daily_plans
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() AND school_id = current_school_id() AND deleted_at IS NULL);

CREATE POLICY "daily_plans_own_insert" ON daily_plans
  FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "daily_plans_own_update" ON daily_plans
  FOR UPDATE TO authenticated
  USING  (teacher_id = auth.uid() AND school_id = current_school_id())
  WITH CHECK (teacher_id = auth.uid() AND school_id = current_school_id());

-- annual_plans
DROP POLICY "annual_plans_own_select" ON annual_plans;
DROP POLICY "annual_plans_own_insert" ON annual_plans;
DROP POLICY "annual_plans_own_update" ON annual_plans;

CREATE POLICY "annual_plans_own_select" ON annual_plans
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "annual_plans_own_insert" ON annual_plans
  FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "annual_plans_own_update" ON annual_plans
  FOR UPDATE TO authenticated
  USING  (teacher_id = auth.uid() AND school_id = current_school_id())
  WITH CHECK (teacher_id = auth.uid() AND school_id = current_school_id());

-- sok_reports
DROP POLICY "sok_reports_own_select" ON sok_reports;
DROP POLICY "sok_reports_own_insert" ON sok_reports;
DROP POLICY "sok_reports_own_update" ON sok_reports;

CREATE POLICY "sok_reports_own_select" ON sok_reports
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() AND school_id = current_school_id() AND deleted_at IS NULL);

CREATE POLICY "sok_reports_own_insert" ON sok_reports
  FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "sok_reports_own_update" ON sok_reports
  FOR UPDATE TO authenticated
  USING  (teacher_id = auth.uid() AND school_id = current_school_id())
  WITH CHECK (teacher_id = auth.uid() AND school_id = current_school_id());

-- notebook_checks
DROP POLICY "notebook_checks_own_select" ON notebook_checks;
DROP POLICY "notebook_checks_own_insert" ON notebook_checks;
DROP POLICY "notebook_checks_own_update" ON notebook_checks;
DROP POLICY "notebook_checks_own_delete" ON notebook_checks;

CREATE POLICY "notebook_checks_own_select" ON notebook_checks
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "notebook_checks_own_insert" ON notebook_checks
  FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "notebook_checks_own_update" ON notebook_checks
  FOR UPDATE TO authenticated
  USING  (teacher_id = auth.uid() AND school_id = current_school_id())
  WITH CHECK (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "notebook_checks_own_delete" ON notebook_checks
  FOR DELETE TO authenticated
  USING (teacher_id = auth.uid() AND school_id = current_school_id());

-- â”€â”€ 2. Fix annual_plans unique index to include school_id â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DROP INDEX annual_plans_teacher_id_academic_year_subject_idx;
CREATE UNIQUE INDEX ON annual_plans (teacher_id, school_id, academic_year, subject);

-- â”€â”€ 3. Add daily_plans duplicate lesson slot constraint â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE UNIQUE INDEX ON daily_plans (teacher_id, class_id, plan_date, lesson_hour) WHERE deleted_at IS NULL;

-- â”€â”€ 4. Add sok_reports school index â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE INDEX ON sok_reports (school_id, meeting_date DESC);

-- -----------------------------------------------------------------------------
-- 20260528000000_ogretmen_dosyasi.sql
-- -----------------------------------------------------------------------------

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

-- -----------------------------------------------------------------------------
-- 20260528000001_homework_sources.sql
-- -----------------------------------------------------------------------------

-- homework_sources: Ã¶ÄŸretmenin kullandÄ±ÄŸÄ± kaynak/kitap listesi
CREATE TABLE homework_sources (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID        NOT NULL REFERENCES profiles(id),
  school_id  UUID        NOT NULL REFERENCES schools(id),
  name       TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  subject    TEXT        CHECK (char_length(subject) <= 100), -- NULL = tÃ¼m dersler
  active     BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE homework_sources ENABLE ROW LEVEL SECURITY;

-- Ã–ÄŸretmen yalnÄ±zca kendi kaynaklarÄ±nÄ± gÃ¶rebilir ve yÃ¶netebilir
CREATE POLICY "sources_teacher_own" ON homework_sources
  FOR ALL
  USING (teacher_id = auth.uid() AND school_id = current_school_id());

-- Homeworks tablosuna kaynak baÄŸlantÄ±sÄ±
ALTER TABLE homeworks ADD COLUMN source_id UUID REFERENCES homework_sources(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- 20260528000002_homework_sources_index.sql
-- -----------------------------------------------------------------------------

CREATE INDEX idx_homework_sources_teacher ON homework_sources (teacher_id, school_id, active);

-- -----------------------------------------------------------------------------
-- 20260528000003_homework_perf_indexes.sql
-- -----------------------------------------------------------------------------

-- Composite partial index: findHomeworkDates sorgusunu O(W)'e dÃ¼ÅŸÃ¼rÃ¼r
-- (teacher_id, school_id, assigned_date) Ã¼Ã§lÃ¼sÃ¼ + partial WHERE deleted_at IS NULL AND source_id IS NOT NULL
CREATE INDEX idx_homeworks_source_lookup
  ON homeworks (teacher_id, school_id, assigned_date DESC)
  WHERE deleted_at IS NULL AND source_id IS NOT NULL;

-- Covering index: (teacher_id, school_id, active, name) â€” ORDER BY name iÃ§in ayrÄ± sort adÄ±mÄ±nÄ± kaldÄ±rÄ±r
DROP INDEX IF EXISTS idx_homework_sources_teacher;
CREATE INDEX idx_homework_sources_teacher
  ON homework_sources (teacher_id, school_id, active, name);

-- -----------------------------------------------------------------------------
-- 20260531000000_mudur_yardimcisi_school_update.sql
-- -----------------------------------------------------------------------------

-- mudur_yardimcisi'na school:update izni ver (toplantÄ± ekle/dÃ¼zenle/sil iÃ§in gerekli)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'mudur_yardimcisi'
  AND p.resource = 'school'
  AND p.action = 'update'
  AND p.scope = 'school'
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 20260531000001_create_kanaat_notlari.sql
-- -----------------------------------------------------------------------------

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

-- -----------------------------------------------------------------------------
-- 20260601000000_homework_veli_notifications.sql
-- -----------------------------------------------------------------------------

-- Teslim sonrasÄ± veli bildirimi dedup tablosu
create table if not exists homework_veli_notifications (
  homework_id  uuid        not null references homeworks(id)  on delete cascade,
  student_id   uuid        not null references students(id)   on delete cascade,
  sent_at      timestamptz not null default now(),
  primary key (homework_id, student_id)
);

-- Sadece service role eriÅŸebilir (Inngest)
alter table homework_veli_notifications enable row level security;

-- -----------------------------------------------------------------------------
-- 20260601000001_homework_templates.sql
-- -----------------------------------------------------------------------------

-- Ã–dev ÅŸablon desteÄŸi
alter table homeworks add column if not exists is_template boolean not null default false;

-- ÅablonlarÄ±n due_date'i olmayabilir
alter table homeworks alter column due_date drop not null;

-- Åablonlar normal Ã¶dev sorgularÄ±ndan hariÃ§ tutulsun diye index
create index if not exists homeworks_is_template_idx on homeworks(is_template) where is_template = true;

-- -----------------------------------------------------------------------------
-- 20260606000001_backfill_submissions_on_student_insert.sql
-- -----------------------------------------------------------------------------

-- Yeni Ã¶ÄŸrenci sÄ±nÄ±fa eklendiÄŸinde, o sÄ±nÄ±fÄ±n mevcut aktif Ã¶devleri iÃ§in
-- homework_submissions kayÄ±tlarÄ±nÄ± otomatik oluÅŸtur.
-- GeÃ§ kayÄ±t durumunu (Ã¶dev oluÅŸturulduktan sonra eklenen Ã¶ÄŸrenci) kapatÄ±r.
-- ON CONFLICT DO NOTHING: idempotent â€” tekrar Ã§alÄ±ÅŸsa da zarar vermez.

CREATE OR REPLACE FUNCTION backfill_submissions_for_new_student()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO homework_submissions (homework_id, student_id, school_id)
  SELECT h.id, NEW.id, NEW.school_id
  FROM homeworks h
  WHERE h.class_id  = NEW.class_id
    AND h.school_id = NEW.school_id
    AND h.deleted_at IS NULL
    AND h.is_template = FALSE
  ON CONFLICT (homework_id, student_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS backfill_submissions_on_student_insert ON students;

CREATE TRIGGER backfill_submissions_on_student_insert
  AFTER INSERT ON students
  FOR EACH ROW
  EXECUTE FUNCTION backfill_submissions_for_new_student();

-- -----------------------------------------------------------------------------
-- 20260606000002_homework_submission_logs.sql
-- -----------------------------------------------------------------------------

-- Ã–dev teslim durumu deÄŸiÅŸikliklerini izlemek iÃ§in audit log tablosu.
-- Her updateSubmissionStatus Ã§aÄŸrÄ±sÄ±nda bir kayÄ±t oluÅŸturulur.
-- old_status NULL ise submission Ã¶nceden yoktu (ilk kez yazÄ±ldÄ±).

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

-- Ã–dev + Ã¶ÄŸrenci bazlÄ± kronolojik sorgu (StatusBoard geÃ§miÅŸ paneli iÃ§in)
CREATE INDEX homework_submission_logs_hw_stu_idx
  ON homework_submission_logs (homework_id, student_id, changed_at DESC);

-- Okul bazlÄ± RLS lookup
CREATE INDEX homework_submission_logs_school_idx
  ON homework_submission_logs (school_id);

ALTER TABLE homework_submission_logs ENABLE ROW LEVEL SECURITY;

-- AynÄ± okuldaki kullanÄ±cÄ±lar kendi okullarÄ±nÄ±n loglarÄ±nÄ± okuyabilir
CREATE POLICY "submission_logs_school_read" ON homework_submission_logs
  FOR SELECT TO authenticated
  USING (school_id = current_school_id());

-- KullanÄ±cÄ± yalnÄ±zca kendi changed_by'Ä±nÄ± yazabilir
CREATE POLICY "submission_logs_insert" ON homework_submission_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id  = current_school_id()
    AND changed_by = auth.uid()
  );

-- -----------------------------------------------------------------------------
-- 20260607000000_performance_indexes.sql
-- -----------------------------------------------------------------------------

-- Phase 8 â€” Performance Indexes (Phase 9 ile gÃ¼ncellendi)
--
-- Analiz sonucu: homeworks(teacher+school), attendance(class+date), students(class+school)
-- iÃ§in eÅŸdeÄŸer index'ler DB'de zaten mevcuttu (migration dosyalarÄ±na yansÄ±mamÄ±ÅŸ).
-- Bu migration yalnÄ±zca gerÃ§ekten eksik olan 2 index'i ekler.
--
-- KORUNAN mevcut index'ler (DROP edilmedi):
--   idx_homeworks_active                â€” (teacher_id, school_id, due_date DESC) WHERE deleted_at IS NULL
--   attendance_class_date_idx           â€” (class_id, date)
--   idx_attendance_class_teacher_date   â€” (class_id, teacher_id, date DESC)
--   idx_students_active                 â€” (class_id, school_id) WHERE deleted_at IS NULL

-- â”€â”€â”€ homeworks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- SÄ±nÄ±f bazlÄ± Ã¶dev sorgularÄ±: getClassSubmissions iÃ§ sorgu, findStudentHomeworkProfile
-- WHERE class_id = X AND school_id = X AND deleted_at IS NULL ORDER BY due_date DESC
-- (Mevcut idx_homeworks_class_id ve idx_homeworks_school_class_date'i supersede eder)
CREATE INDEX IF NOT EXISTS idx_homeworks_class_school_due
  ON homeworks (class_id, school_id, due_date DESC)
  WHERE deleted_at IS NULL;

-- â”€â”€â”€ attendance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- MÃ¼dÃ¼r okul geneli devamsÄ±zlÄ±k sorgusu: getAbsentYearRows
-- WHERE school_id = X AND status IN ('absent','late') AND date >= yearStart LIMIT 15000
-- Partial: sadece 'absent' ve 'late' satÄ±rlarÄ± â†’ ~%40 daha kÃ¼Ã§Ã¼k index
CREATE INDEX IF NOT EXISTS idx_attendance_school_date
  ON attendance (school_id, date DESC)
  WHERE status IN ('absent', 'late');
