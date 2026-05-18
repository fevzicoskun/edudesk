-- Zümre başkanının da mentör raporlarını görebilmesi
DROP POLICY IF EXISTS "mentor_reports_select" ON mentor_reports;
CREATE POLICY "mentor_reports_select" ON mentor_reports
  FOR SELECT TO authenticated
  USING (
    school_id = current_school_id() AND (
      mentor_id = auth.uid() OR
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('mudur', 'mudur_yardimcisi', 'zumre_baskani')
    )
  );
