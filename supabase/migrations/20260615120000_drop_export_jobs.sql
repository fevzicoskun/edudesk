-- ============================================================
-- Async export kuyruğu kaldırıldı.
--
-- Tüm dışa aktarmalar senkron POST /api/export üzerinden dosyayı
-- doğrudan döndürüyor; async kuyruk yolu (/api/internal/export +
-- Inngest exportXlsx/exportDeadLetter) hiçbir UI tarafından
-- kullanılmıyordu. Bu migration ilgili DB nesnelerini temizler:
--   1. tenant_metrics view'ini export_jobs bağımlılığı olmadan yeniden kurar
--      (baseline'daki eski join'li tanımı da düzeltir → fresh-reset güvenli)
--   2. retention_export_jobs cron job'unu kaldırır
--   3. export_jobs tablosunu (RLS policy + index dahil) düşürür
-- ============================================================

-- 1. tenant_metrics — canlı tanımla hizalı, export_jobs join'i yok
drop view if exists public.tenant_metrics;

create view public.tenant_metrics as
 SELECT s.id          AS school_id,
        s.name        AS school_name,
        s.slug,
        s.status,
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
  GROUP BY s.id, s.name, s.slug, s.status, s.created_at;

-- 2. retention cron job'unu güvenle kaldır (yoksa hata vermeden geç)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'retention_export_jobs') then
    perform cron.unschedule('retention_export_jobs');
  end if;
end $$;

-- 3. export_jobs tablosunu RLS policy ve index'iyle birlikte düşür
drop table if exists public.export_jobs cascade;
