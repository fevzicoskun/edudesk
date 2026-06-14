-- Perf raporu #3: yıl boyu attendance satırlarını çekmek yerine sunucu-taraflı aggregation.
-- countAbsences ile birebir aynı semantik: hafta sonu hariç (DOW 0/6), absent=1, late=0.5, excused=1.
-- SECURITY INVOKER → RLS (attendance_school_read) korunur; SET search_path='' → hijack koruması.
CREATE OR REPLACE FUNCTION public.count_absences_by_student(p_school_id uuid, p_since date)
RETURNS TABLE(student_id uuid, unexcused numeric, excused integer)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT a.student_id,
         SUM(CASE a.status WHEN 'absent' THEN 1 WHEN 'late' THEN 0.5 ELSE 0 END)::numeric,
         SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END)::integer
  FROM public.attendance a
  WHERE a.school_id = p_school_id
    AND a.date >= p_since
    AND a.status IN ('absent', 'late', 'excused')
    AND EXTRACT(DOW FROM a.date) NOT IN (0, 6)
  GROUP BY a.student_id;
$$;

GRANT EXECUTE ON FUNCTION public.count_absences_by_student(uuid, date) TO authenticated;
