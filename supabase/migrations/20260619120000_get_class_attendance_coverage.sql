-- Sınıf yoklama kapsaması: son p_since tarihinden bu yana sınıf başına
-- yoklama girilen ayrı gün sayısı. SECURITY INVOKER → attendance RLS okul
-- izolasyonunu zorlar (DEFINER değil; güvenlik turuyla uyumlu).
create or replace function get_class_attendance_coverage(p_school_id uuid, p_since date)
returns table(class_id uuid, covered_days bigint)
language sql
security invoker
set search_path = public
as $$
  select class_id, count(distinct date)
  from attendance
  where school_id = p_school_id and date >= p_since
  group by class_id
$$;

grant execute on function get_class_attendance_coverage(uuid, date) to authenticated;
