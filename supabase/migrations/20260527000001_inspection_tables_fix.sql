-- Corrective migration: fixes security and integrity issues introduced in
-- 20260527000000_inspection_tables.sql which was already applied to the live DB.

-- ── 1. Add TO authenticated + WITH CHECK to all UPDATE policies ──────────────

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

-- ── 2. Fix annual_plans unique index to include school_id ────────────────────
DROP INDEX annual_plans_teacher_id_academic_year_subject_idx;
CREATE UNIQUE INDEX ON annual_plans (teacher_id, school_id, academic_year, subject);

-- ── 3. Add daily_plans duplicate lesson slot constraint ──────────────────────
CREATE UNIQUE INDEX ON daily_plans (teacher_id, class_id, plan_date, lesson_hour) WHERE deleted_at IS NULL;

-- ── 4. Add sok_reports school index ─────────────────────────────────────────
CREATE INDEX ON sok_reports (school_id, meeting_date DESC);
