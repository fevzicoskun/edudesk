-- RPC'ye sender_name JOIN ekle

DROP FUNCTION IF EXISTS get_first_unread_announcement(UUID, TEXT, UUID);

CREATE TYPE unread_announcement_row AS (
  id           UUID,
  school_id    UUID,
  message      TEXT,
  created_by   UUID,
  sender_name  TEXT,
  target_roles TEXT[],
  created_at   TIMESTAMPTZ
);

CREATE OR REPLACE FUNCTION get_first_unread_announcement(
  p_user_id   UUID,
  p_user_role TEXT,
  p_school_id UUID
)
RETURNS SETOF unread_announcement_row
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.school_id, a.message, a.created_by,
         p.full_name AS sender_name,
         a.target_roles, a.created_at
  FROM announcements a
  JOIN profiles p ON p.id = a.created_by
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
