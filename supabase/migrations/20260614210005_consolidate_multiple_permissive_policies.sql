-- Perf raporu #10: aynı tablo+cmd+rol için birden fazla PERMISSIVE policy konsolidasyonu.
-- Permissive politikalar Postgres'te zaten OR ile birleşir → tek policy(A OR B) birebir eşdeğer,
-- yalnızca satır başına değerlendirilen policy sayısı azalır. auth.uid() sarmaları korunur (#2).

-- 1) classes SELECT
DROP POLICY IF EXISTS classes_manager_read_deleted ON public.classes;
DROP POLICY IF EXISTS classes_school_read ON public.classes;
CREATE POLICY classes_school_read ON public.classes FOR SELECT TO public
USING (
  ((school_id = current_school_id()) AND (deleted_at IS NULL))
  OR ((school_id = current_school_id()) AND (deleted_at IS NOT NULL) AND can_manage_classes())
);

-- 2) classes UPDATE (manager_update.with_check NULL → effektif check = qual)
DROP POLICY IF EXISTS classes_manager_update ON public.classes;
DROP POLICY IF EXISTS mudur_yardimcisi_mentor_atama ON public.classes;
CREATE POLICY classes_update ON public.classes FOR UPDATE TO public
USING (
  ((school_id = current_school_id()) AND can_manage_classes())
  OR (school_id = current_school_id())
)
WITH CHECK (
  ((school_id = current_school_id()) AND can_manage_classes())
  OR ((school_id = current_school_id()) AND ((SELECT p.role FROM public.profiles p WHERE p.id = (SELECT auth.uid())) = 'mudur_yardimcisi'::text))
);

-- 3) common_exams SELECT
DROP POLICY IF EXISTS exams_manager_read_deleted ON public.common_exams;
DROP POLICY IF EXISTS exams_school_read ON public.common_exams;
CREATE POLICY exams_school_read ON public.common_exams FOR SELECT TO public
USING (
  ((school_id = current_school_id()) AND can_see_zumre_item(subject) AND (deleted_at IS NULL))
  OR ((school_id = current_school_id()) AND (deleted_at IS NOT NULL) AND can_manage_zumre_item(subject))
);

-- 4) homeworks SELECT
DROP POLICY IF EXISTS homeworks_manager_read_deleted ON public.homeworks;
DROP POLICY IF EXISTS homeworks_school_read ON public.homeworks;
CREATE POLICY homeworks_school_read ON public.homeworks FOR SELECT TO public
USING (
  ((school_id = current_school_id()) AND (deleted_at IS NULL))
  OR ((school_id = current_school_id()) AND (deleted_at IS NOT NULL) AND is_zumre_baskani_in_school())
);

-- 5) profiles UPDATE (iki politika da id = auth.uid() — eşdeğer, tek policy'e indirgenir)
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles FOR UPDATE TO authenticated
USING ( id = (SELECT auth.uid()) )
WITH CHECK ( id = (SELECT auth.uid()) );

-- 6) students SELECT
DROP POLICY IF EXISTS students_manager_read_deleted ON public.students;
DROP POLICY IF EXISTS students_school_read ON public.students;
CREATE POLICY students_school_read ON public.students FOR SELECT TO public
USING (
  ((school_id = current_school_id()) AND (deleted_at IS NULL))
  OR ((school_id = current_school_id()) AND (deleted_at IS NOT NULL) AND can_manage_classes())
);

-- 7) user_sessions SELECT
DROP POLICY IF EXISTS sessions_own_select ON public.user_sessions;
DROP POLICY IF EXISTS sessions_school_admin_read ON public.user_sessions;
CREATE POLICY sessions_school_read ON public.user_sessions FOR SELECT TO authenticated
USING (
  (user_id = (SELECT auth.uid()))
  OR ((school_id = current_school_id()) AND ((SELECT p.role FROM public.profiles p WHERE p.id = (SELECT auth.uid())) = ANY (ARRAY['mudur'::text, 'mudur_yardimcisi'::text])))
);

-- 8) zumre_meetings SELECT
DROP POLICY IF EXISTS meetings_manager_read_deleted ON public.zumre_meetings;
DROP POLICY IF EXISTS meetings_school_read ON public.zumre_meetings;
CREATE POLICY meetings_school_read ON public.zumre_meetings FOR SELECT TO public
USING (
  ((school_id = current_school_id()) AND can_see_zumre_item(branch) AND (deleted_at IS NULL))
  OR ((school_id = current_school_id()) AND (deleted_at IS NOT NULL) AND can_manage_zumre_item(branch))
);
