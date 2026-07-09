-- Abonelik v1: tek karar kolonu + manuel ödeme kayıtları.
-- Spec: docs/superpowers/specs/2026-07-09-abonelik-design.md

-- access_until: DAHİL son erişim günü. NULL = süresiz (mevcut okullar etkilenmez).
alter table public.schools add column if not exists access_until date;

create table if not exists public.school_payments (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id),
  amount_kurus  integer not null check (amount_kurus > 0),
  paid_at       date not null,
  period_start  date not null,
  period_end    date not null,
  note          text,
  created_by    uuid not null,
  created_at    timestamptz not null default now(),
  constraint school_payments_period check (period_end >= period_start)
);

create index if not exists school_payments_school_idx on public.school_payments (school_id, period_end desc);

-- Policy YOK (usage_daily deseni): tüm erişim /platform service-client action'ından,
-- platform_admins guard'lı. Advisor 0008 INFO bilinçli kabul.
alter table public.school_payments enable row level security;

-- PostgREST üzerinden anon/authenticated dokunamasın (RLS zaten kilitli ama default grant'leri da sık).
revoke all on public.school_payments from anon, authenticated;

-- tenant_metrics view'ına access_until ekle (mevcut tanım: 20260615123000_drop_export_jobs.sql).
-- security_invoker KORUNMALI: canlıdaki view böyle tanımlı (recreate kaybederse RLS-bypass gerilemesi olur).
drop view if exists public.tenant_metrics;
create view public.tenant_metrics with (security_invoker = on) as
 SELECT s.id          AS school_id,
        s.name        AS school_name,
        s.slug,
        s.status,
        s.access_until,
        s.created_at,
        count(DISTINCT CASE
            WHEN p.role = ANY (ARRAY['ogretmen'::text, 'zumre_baskani'::text, 'mudur_yardimcisi'::text]) THEN p.id
            ELSE NULL::uuid
        END)          AS teacher_count,
        count(DISTINCT CASE
            WHEN p.role = 'mudur'::text THEN p.id
            ELSE NULL::uuid
        END)          AS mudur_count,
        count(DISTINCT st.id) AS student_count,
        count(DISTINCT c.id)  AS class_count,
        count(DISTINCT h.id)  AS homework_count
   FROM schools s
     LEFT JOIN profiles  p  ON p.school_id  = s.id
     LEFT JOIN students  st ON st.school_id = s.id AND st.deleted_at IS NULL
     LEFT JOIN classes   c  ON c.school_id  = s.id AND c.deleted_at IS NULL
     LEFT JOIN homeworks h  ON h.school_id  = s.id AND h.deleted_at IS NULL
  GROUP BY s.id, s.name, s.slug, s.status, s.access_until, s.created_at;
