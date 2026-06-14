-- Perf raporu #3 (MudurOgretmenAktivite): ham teacher_id satırlarını çekip JS'te Set kurmak yerine
-- sunucu-taraflı distinct aggregation. Sadece aktivitesi olan öğretmenleri döner.
CREATE OR REPLACE FUNCTION public.school_teacher_activity(p_school_id uuid, p_since date)
RETURNS TABLE(teacher_id uuid, has_homework boolean, has_attendance boolean)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT t.teacher_id,
         bool_or(t.src = 'hw')  AS has_homework,
         bool_or(t.src = 'att') AS has_attendance
  FROM (
    SELECT h.teacher_id, 'hw'::text AS src
    FROM public.homeworks h
    WHERE h.school_id = p_school_id AND h.assigned_date >= p_since
      AND h.deleted_at IS NULL AND h.teacher_id IS NOT NULL
    UNION ALL
    SELECT a.teacher_id, 'att'::text AS src
    FROM public.attendance a
    WHERE a.school_id = p_school_id AND a.date >= p_since AND a.teacher_id IS NOT NULL
  ) t
  GROUP BY t.teacher_id;
$$;

GRANT EXECUTE ON FUNCTION public.school_teacher_activity(uuid, date) TO authenticated;
