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
