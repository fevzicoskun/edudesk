-- ============================================================
-- Migration: Security Hardening
-- 1. Anon blanket-read politikalarını kaldır
-- 2. is_zumre_baskani_in_school() school_id kontrolü ekle
-- 3. homework_submissions DELETE policy ekle
-- 4. school_id yeniden atamayı kilitle (trigger)
-- 5. admin_onboard_user RPC (onboarding için)
-- 6. admin_set_profile RPC güncelle (school_change_allowed flag)
-- 7. profiles self-update policy ekle
-- ============================================================

-- 1. Anon blanket-read policies — service role zaten bypass ediyor,
--    bu politikalar anon key bilen herkese tüm okul verisini açıyor.
DROP POLICY IF EXISTS "students_anon_read"      ON students;
DROP POLICY IF EXISTS "submissions_anon_read"   ON homework_submissions;
DROP POLICY IF EXISTS "attendance_anon_read"    ON attendance;
DROP POLICY IF EXISTS "student_notes_anon_read" ON student_notes;

-- 2. is_zumre_baskani_in_school: school_id kontrolü eksikti,
--    başka okulun başkanı da true dönüyordu.
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

-- 3. homework_submissions DELETE policy (önceden yoktu, silme işlemi
--    RLS default-deny ile sessizce başarısız oluyordu).
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

-- 4. school_id yeniden atama trigger'ı
--    Zaten okulu olan kullanıcı başka okula geçemez.
--    Admin işlemleri app.school_change_allowed='true' ile bypass eder.
CREATE OR REPLACE FUNCTION prevent_school_id_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.school_id IS NOT NULL
     AND NEW.school_id IS DISTINCT FROM OLD.school_id
     AND current_setting('app.school_change_allowed', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'school_id değiştirilemez';
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

-- 5. admin_onboard_user RPC: onboarding için school_id + opsiyonel rol atar.
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

-- 7. profiles self-update policy: kullanıcı kendi profilini güncelleyebilir;
--    role + school_id triggerlarla korunuyor.
DROP POLICY IF EXISTS "profiles_self_update" ON profiles;
CREATE POLICY "profiles_self_update" ON profiles
  FOR UPDATE TO authenticated
  USING  (id = auth.uid())
  WITH CHECK (id = auth.uid());
