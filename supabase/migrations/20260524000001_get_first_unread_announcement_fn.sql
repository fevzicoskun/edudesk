CREATE OR REPLACE FUNCTION get_first_unread_announcement(
  p_user_id   UUID,
  p_user_role TEXT,
  p_school_id UUID
)
RETURNS SETOF announcements
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.*
  FROM announcements a
  WHERE a.school_id = p_school_id
    AND a.created_by != p_user_id
    AND p_user_role = ANY(a.target_roles)
    AND NOT EXISTS (
      SELECT 1 FROM announcement_reads ar
      WHERE ar.announcement_id = a.id
        AND ar.user_id = p_user_id
    )
  ORDER BY a.created_at ASC
  LIMIT 1;
$$;
