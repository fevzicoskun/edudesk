-- Retention cron jobs (pg_cron already installed)
-- Run once; idempotent via job names

-- user_sessions: 90 gün
SELECT cron.schedule(
  'retention_user_sessions',
  '0 3 * * *',
  $$DELETE FROM user_sessions WHERE created_at < now() - interval '90 days'$$
) ON CONFLICT DO NOTHING;

-- export_jobs: terminal durumlar 30 gün
SELECT cron.schedule(
  'retention_export_jobs',
  '15 3 * * *',
  $$DELETE FROM export_jobs
    WHERE status IN ('done','error','cancelled','dead_letter')
      AND updated_at < now() - interval '30 days'$$
) ON CONFLICT DO NOTHING;

-- audit_logs: 2 yıl (haftalık pazar sabahı)
SELECT cron.schedule(
  'retention_audit_logs',
  '30 3 * * 0',
  $$DELETE FROM audit_logs WHERE created_at < now() - interval '2 years'$$
) ON CONFLICT DO NOTHING;
