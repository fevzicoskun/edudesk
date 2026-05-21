-- ─── Rol kısıtını 4 role genişlet ─────────────────────────────────────────────
-- schema.sql'deki CHECK sadece 2 rol içeriyordu; tüm geçerli rolleri ekle.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('ogretmen', 'zumre_baskani', 'mudur_yardimcisi', 'mudur'));

-- ─── Yardımcı fonksiyon ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_mudur_yardimcisi_or_above()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS(
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('mudur_yardimcisi', 'mudur')
  )
$$;

-- ─── Sınıf RLS: sadece mudur_yardimcisi ve müdür yazabilir ───────────────────
DROP POLICY IF EXISTS "classes_insert" ON classes;
DROP POLICY IF EXISTS "classes_update" ON classes;
DROP POLICY IF EXISTS "classes_delete" ON classes;

CREATE POLICY "classes_insert" ON classes FOR INSERT TO authenticated
  WITH CHECK (is_mudur_yardimcisi_or_above());
CREATE POLICY "classes_update" ON classes FOR UPDATE TO authenticated
  USING (is_mudur_yardimcisi_or_above());
CREATE POLICY "classes_delete" ON classes FOR DELETE TO authenticated
  USING (is_mudur_yardimcisi_or_above());
