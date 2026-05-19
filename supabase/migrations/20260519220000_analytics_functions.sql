-- at_risk_student_count: counts students with >= min_days recorded and attendance_rate < threshold
-- Replaces the client-side Map aggregation in the analytics route.
create or replace function at_risk_student_count(
  p_school_id  uuid,
  p_since      date,
  p_min_days   int     default 5,
  p_threshold  numeric default 0.7
)
returns bigint
language sql stable security definer
as $$
  select count(*)
  from (
    select student_id
    from attendance
    where school_id = p_school_id
      and date >= p_since
    group by student_id
    having count(*) >= p_min_days
       and count(*) filter (where status = 'present')::numeric / count(*) < p_threshold
  ) sub
$$;

-- Atomic storage increment — avoids read-modify-write race condition
create or replace function increment_school_storage(p_school_id uuid, p_delta_mb int)
returns void
language sql
as $$
  update school_quotas
  set used_storage_mb = greatest(0, used_storage_mb + p_delta_mb),
      updated_at = now()
  where school_id = p_school_id
$$;
