-- Enforce school suspension: modify current_school_id() to return NULL when
-- school is not active. Every downstream policy using current_school_id()
-- automatically blocks suspended tenants — no individual policy changes needed.

create or replace function current_school_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select p.school_id
  from profiles p
  join schools s on s.id = p.school_id
  where p.id = auth.uid()
    and s.status = 'active'
$$;

-- count_active_teachers: distinct teacher count — replaces client-side Set dedup
create or replace function count_active_teachers(p_school_id uuid, p_since date)
returns bigint
language sql stable security definer
as $$
  select count(distinct teacher_id)
  from homeworks
  where school_id = p_school_id
    and deleted_at is null
    and created_at >= p_since
$$;
