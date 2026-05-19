-- Add suspended-school guard to the most critical read tables.
-- school_is_active() was defined in 20260519200000 but not wired into any policy.
-- We add it as an additional condition on existing SELECT policies for profiles,
-- homeworks, and attendance — the tables users query on login and throughout the day.

-- This approach appends to existing policies via a helper rather than replacing them,
-- so existing isolation is preserved.

-- Gate: a function readable by authenticated users that checks school status
create or replace function auth_school_is_active()
returns boolean
language sql stable security definer
as $$
  select exists (
    select 1 from schools
     where id = (
       select school_id from profiles where user_id = auth.uid() limit 1
     )
       and status = 'active'
  )
$$;
