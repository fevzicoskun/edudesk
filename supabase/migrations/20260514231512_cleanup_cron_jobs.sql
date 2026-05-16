-- pg_cron ile otomatik temizlik job'ları
-- Retention sürelerini değiştirmek için INTERVAL değerlerini güncelle

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- revoked_tokens: her gün 02:00 UTC — 30 günden eski kayıtları sil
-- (token max ömrü 7 gün, 30 gün güvenli marj)
SELECT cron.schedule(
  'cleanup-revoked-tokens',
  '0 2 * * *',
  $$
    DELETE FROM public.revoked_tokens
    WHERE revoked_at < NOW() - INTERVAL '30 days';
  $$
);

-- audit_logs: her ayın 1'i 03:00 UTC — 1 yıldan eski log'ları sil
SELECT cron.schedule(
  'cleanup-audit-logs',
  '0 3 1 * *',
  $$
    DELETE FROM public.audit_logs
    WHERE created_at < NOW() - INTERVAL '1 year';
  $$
);

-- Job durumunu kontrol etmek için:
-- SELECT jobname, schedule, active FROM cron.job;
-- Manuel tetiklemek için:
-- SELECT cron.run_job('cleanup-revoked-tokens');
