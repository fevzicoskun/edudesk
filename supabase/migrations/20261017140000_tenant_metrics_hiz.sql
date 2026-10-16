-- tenant_metrics 32 sn sürüp zaman aşımına düşüyordu (2026-10-17 tarama: /rest/v1/tenant_metrics 26× 500).
-- Kök neden: profiles × students × classes × homeworks LEFT JOIN çarpımı (okul başına milyonlarca ara satır,
-- 481 MB diske sıralama) sonra count(DISTINCT). Okul başına bağımsız alt sorgu sayımı: aynı sütunlar, aynı sonuç.
create or replace view public.tenant_metrics with (security_invoker = on) as
select
  s.id as school_id,
  s.name as school_name,
  s.slug,
  s.status,
  s.access_until,
  s.created_at,
  (select count(*) from profiles p where p.school_id = s.id
     and p.role = any (array['ogretmen', 'zumre_baskani', 'mudur_yardimcisi'])) as teacher_count,
  (select count(*) from profiles p where p.school_id = s.id and p.role = 'mudur') as mudur_count,
  (select count(*) from students st where st.school_id = s.id and st.deleted_at is null) as student_count,
  (select count(*) from classes c where c.school_id = s.id and c.deleted_at is null) as class_count,
  (select count(*) from homeworks h where h.school_id = s.id and h.deleted_at is null) as homework_count
from schools s;
