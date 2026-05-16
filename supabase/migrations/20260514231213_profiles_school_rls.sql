-- profiles tablosunu school_id bazında izole et (KVKK)
-- Herkese açık SELECT policy kaldırıldı

DROP POLICY IF EXISTS profiles_read_all ON profiles;

CREATE POLICY profiles_school_read ON profiles
FOR SELECT USING (
  auth.uid() = id
  OR (
    school_id IS NOT NULL
    AND school_id = current_school_id()
  )
);
