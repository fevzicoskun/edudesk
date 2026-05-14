-- ============================================================
-- Migration: Multi-tenant school isolation
-- Date: 2026-05-15
-- Description: schools tablosu + tüm kritik tablolara school_id
-- ============================================================

-- 1. schools tablosu
CREATE TABLE IF NOT EXISTS schools (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Mevcut tüm veri için varsayılan okul
-- Sabit UUID — migration'ın idempotent olması için
INSERT INTO schools (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Varsayılan Okul')
ON CONFLICT (id) DO NOTHING;

-- 3. profiles — school_id
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);
UPDATE profiles SET school_id = '00000000-0000-0000-0000-000000000001' WHERE school_id IS NULL;

-- 4. classes — school_id
ALTER TABLE classes ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);
UPDATE classes SET school_id = '00000000-0000-0000-0000-000000000001' WHERE school_id IS NULL;

-- 5. students — school_id (sınıfın okulu miras alır)
ALTER TABLE students ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);
UPDATE students SET school_id = '00000000-0000-0000-0000-000000000001' WHERE school_id IS NULL;

-- 6. homeworks — school_id
ALTER TABLE homeworks ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);
UPDATE homeworks SET school_id = '00000000-0000-0000-0000-000000000001' WHERE school_id IS NULL;

-- 7. attendance — school_id
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);
UPDATE attendance SET school_id = '00000000-0000-0000-0000-000000000001' WHERE school_id IS NULL;

-- 8. zumre_meetings — school_id
ALTER TABLE zumre_meetings ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);
UPDATE zumre_meetings SET school_id = '00000000-0000-0000-0000-000000000001' WHERE school_id IS NULL;

-- 9. common_exams — school_id
ALTER TABLE common_exams ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);
UPDATE common_exams SET school_id = '00000000-0000-0000-0000-000000000001' WHERE school_id IS NULL;

-- 10. curriculum_progress — school_id
ALTER TABLE curriculum_progress ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);
UPDATE curriculum_progress SET school_id = '00000000-0000-0000-0000-000000000001' WHERE school_id IS NULL;

-- 11. student_notes — school_id (tablo varsa)
ALTER TABLE student_notes ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);
UPDATE student_notes SET school_id = '00000000-0000-0000-0000-000000000001' WHERE school_id IS NULL;

-- 12. homework_submissions — school_id
ALTER TABLE homework_submissions ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);
UPDATE homework_submissions SET school_id = '00000000-0000-0000-0000-000000000001' WHERE school_id IS NULL;

-- 13. audit_logs — school_id (varsa zaten, yoksa ekle)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);
UPDATE audit_logs SET school_id = '00000000-0000-0000-0000-000000000001' WHERE school_id IS NULL;

-- ============================================================
-- RLS Helper Fonksiyonları
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
