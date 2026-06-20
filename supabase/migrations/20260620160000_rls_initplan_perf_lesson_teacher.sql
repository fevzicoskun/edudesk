-- Perf hardening for lesson_schedules + teacher_duties RLS (advisor WARN cleanup):
--   * auth_rls_initplan (8): wrap bare auth.uid() in (select auth.uid()) so it is
--     evaluated once per query instead of once per row.
--   * multiple_permissive_policies (3): collapse the separate "mudur" and "teacher"
--     permissive policies on lesson_schedules INSERT/UPDATE/DELETE into one OR'd policy
--     (semantically identical to two permissive policies, matches the SELECT policy).
-- Also revokes EXECUTE on the orphan is_zumre_baskani() (not used by any policy or the app;
-- the policy-facing helper is is_zumre_baskani_in_school()).

-- ============ lesson_schedules ============

DROP POLICY IF EXISTS lesson_schedules_select ON public.lesson_schedules;
CREATE POLICY lesson_schedules_select ON public.lesson_schedules
  FOR SELECT TO authenticated
  USING (
    school_id = current_school_id()
    AND (
      teacher_id = (SELECT auth.uid())
      OR (SELECT role FROM profiles WHERE id = (SELECT auth.uid()))
           = ANY (ARRAY['mudur'::text, 'mudur_yardimcisi'::text])
    )
  );

DROP POLICY IF EXISTS lesson_schedules_delete ON public.lesson_schedules;
DROP POLICY IF EXISTS lesson_schedules_teacher_delete ON public.lesson_schedules;
CREATE POLICY lesson_schedules_delete ON public.lesson_schedules
  FOR DELETE TO authenticated
  USING (
    school_id = current_school_id()
    AND (
      teacher_id = (SELECT auth.uid())
      OR (SELECT role FROM profiles WHERE id = (SELECT auth.uid()))
           = ANY (ARRAY['mudur'::text, 'mudur_yardimcisi'::text])
    )
  );

DROP POLICY IF EXISTS lesson_schedules_insert ON public.lesson_schedules;
DROP POLICY IF EXISTS lesson_schedules_teacher_insert ON public.lesson_schedules;
CREATE POLICY lesson_schedules_insert ON public.lesson_schedules
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = current_school_id()
    AND (
      teacher_id = (SELECT auth.uid())
      OR (SELECT role FROM profiles WHERE id = (SELECT auth.uid()))
           = ANY (ARRAY['mudur'::text, 'mudur_yardimcisi'::text])
    )
  );

DROP POLICY IF EXISTS lesson_schedules_update ON public.lesson_schedules;
DROP POLICY IF EXISTS lesson_schedules_teacher_update ON public.lesson_schedules;
CREATE POLICY lesson_schedules_update ON public.lesson_schedules
  FOR UPDATE TO authenticated
  USING (
    school_id = current_school_id()
    AND (
      teacher_id = (SELECT auth.uid())
      OR (SELECT role FROM profiles WHERE id = (SELECT auth.uid()))
           = ANY (ARRAY['mudur'::text, 'mudur_yardimcisi'::text])
    )
  )
  WITH CHECK (
    school_id = current_school_id()
    AND (
      teacher_id = (SELECT auth.uid())
      OR (SELECT role FROM profiles WHERE id = (SELECT auth.uid()))
           = ANY (ARRAY['mudur'::text, 'mudur_yardimcisi'::text])
    )
  );

-- ============ teacher_duties (one policy per action; teacher writes own, mudur reads all) ============

DROP POLICY IF EXISTS teacher_duties_select ON public.teacher_duties;
CREATE POLICY teacher_duties_select ON public.teacher_duties
  FOR SELECT TO authenticated
  USING (
    school_id = current_school_id()
    AND (
      teacher_id = (SELECT auth.uid())
      OR (SELECT role FROM profiles WHERE id = (SELECT auth.uid()))
           = ANY (ARRAY['mudur'::text, 'mudur_yardimcisi'::text])
    )
  );

DROP POLICY IF EXISTS teacher_duties_delete ON public.teacher_duties;
CREATE POLICY teacher_duties_delete ON public.teacher_duties
  FOR DELETE TO authenticated
  USING (school_id = current_school_id() AND teacher_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS teacher_duties_insert ON public.teacher_duties;
CREATE POLICY teacher_duties_insert ON public.teacher_duties
  FOR INSERT TO authenticated
  WITH CHECK (school_id = current_school_id() AND teacher_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS teacher_duties_update ON public.teacher_duties;
CREATE POLICY teacher_duties_update ON public.teacher_duties
  FOR UPDATE TO authenticated
  USING (school_id = current_school_id() AND teacher_id = (SELECT auth.uid()))
  WITH CHECK (school_id = current_school_id() AND teacher_id = (SELECT auth.uid()));

-- ============ security hygiene ============
REVOKE EXECUTE ON FUNCTION public.is_zumre_baskani() FROM anon, authenticated;
