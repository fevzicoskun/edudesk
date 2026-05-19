-- Tenant Management: SaaS multi-school lifecycle control
-- Adds platform_admins table, school status/plan columns, quotas, and metrics views.

-- ─── 1. Platform Admins ────────────────────────────────────────────────────────
-- Super-admins who can manage any school tenant.
-- Separate from school RBAC — these users have cross-tenant visibility.

create table if not exists platform_admins (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);

-- Only service_role can read/write platform_admins
alter table platform_admins enable row level security;

create policy "platform_admins: service_role only"
  on platform_admins
  using (false)
  with check (false);

-- ─── 2. School Tenant Status & Plan ───────────────────────────────────────────

alter table schools
  add column if not exists status       text not null default 'active'
    check (status in ('active', 'suspended', 'trial', 'cancelled')),
  add column if not exists plan         text not null default 'free'
    check (plan in ('free', 'starter', 'pro', 'enterprise')),
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_by uuid references auth.users(id),
  add column if not exists trial_ends_at timestamptz;

-- ─── 3. School Quotas ─────────────────────────────────────────────────────────

create table if not exists school_quotas (
  school_id           uuid primary key references schools(id) on delete cascade,
  max_teachers        int  not null default 20,
  max_students        int  not null default 500,
  max_storage_mb      int  not null default 1024,
  used_storage_mb     int  not null default 0,
  updated_at          timestamptz not null default now()
);

-- Seed default quotas for existing schools
insert into school_quotas (school_id)
select id from schools
on conflict (school_id) do nothing;

-- Only service_role and school-scoped reads via function
alter table school_quotas enable row level security;

create policy "school_quotas: school members read own"
  on school_quotas for select
  using (
    exists (
      select 1 from profiles
       where profiles.user_id = auth.uid()
         and profiles.school_id = school_quotas.school_id
    )
  );

-- ─── 4. Blocked access for suspended schools ──────────────────────────────────
-- RLS helper function: returns false for suspended schools.
-- Import into existing policies where needed.

create or replace function school_is_active(sid uuid)
returns boolean
language sql stable security definer
as $$
  select exists (
    select 1 from schools
     where id = sid
       and status = 'active'
  )
$$;

-- ─── 5. Tenant Metrics View ───────────────────────────────────────────────────
-- Used by super-admin dashboard — cross-school aggregate.
-- Not exposed via RLS; read by service_role only.

create or replace view tenant_metrics as
select
  s.id                                          as school_id,
  s.name                                        as school_name,
  s.status,
  s.plan,
  s.created_at,
  s.trial_ends_at,
  count(distinct p.user_id) filter (
    where p.role not in ('veli', 'ogrenci')
  )                                             as teacher_count,
  count(distinct st.id)                         as student_count,
  coalesce(q.max_teachers,  20)                 as max_teachers,
  coalesce(q.max_students,  500)                as max_students,
  coalesce(q.used_storage_mb, 0)                as used_storage_mb,
  coalesce(q.max_storage_mb, 1024)              as max_storage_mb,
  count(distinct ej.id) filter (
    where ej.status = 'failed'
    and   ej.created_at > now() - interval '7 days'
  )                                             as failed_exports_7d
from schools s
left join profiles       p  on p.school_id = s.id
left join students       st on st.school_id = s.id
left join school_quotas  q  on q.school_id  = s.id
left join export_jobs    ej on ej.school_id = s.id
group by s.id, s.name, s.status, s.plan, s.created_at, s.trial_ends_at,
         q.max_teachers, q.max_students, q.used_storage_mb, q.max_storage_mb;

-- ─── 6. Updated-at trigger for quotas ─────────────────────────────────────────

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end
$$;

drop trigger if exists school_quotas_updated_at on school_quotas;
create trigger school_quotas_updated_at
  before update on school_quotas
  for each row execute function set_updated_at();
