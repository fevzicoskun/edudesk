-- ============================================================
-- Migration: Phase 3 — NOT NULL constraints + token revocation + export jobs
-- Date: 2026-05-15
-- ============================================================

-- ============================================================
-- 1. school_id NOT NULL enforcement
--    (Only after Phase 1 migration backfilled all rows)
-- ============================================================
ALTER TABLE profiles       ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE classes        ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE students       ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE homeworks      ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE attendance     ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE zumre_meetings ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE common_exams   ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE curriculum_progress ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE student_notes  ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE homework_submissions ALTER COLUMN school_id SET NOT NULL;

-- ============================================================
-- 2. Token revocation table
-- ============================================================
CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti        text        PRIMARY KEY,           -- unique token ID (from payload.jti)
  token_type text        NOT NULL,              -- 'veli' | 'yoklama' | 'tutanak'
  revoked_at timestamptz NOT NULL DEFAULT now(),
  revoked_by uuid        REFERENCES auth.users(id),
  reason     text
);

ALTER TABLE revoked_tokens ENABLE ROW LEVEL SECURITY;

-- Only baskan can revoke tokens; anyone (including anon) can read for verify checks
CREATE POLICY "revoked_tokens_anon_read" ON revoked_tokens
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "revoked_tokens_baskan_insert" ON revoked_tokens
  FOR INSERT TO authenticated
  WITH CHECK (is_zumre_baskani_in_school());

CREATE POLICY "revoked_tokens_baskan_delete" ON revoked_tokens
  FOR DELETE TO authenticated
  USING (is_zumre_baskani_in_school());

-- ============================================================
-- 3. Export jobs table (background job queue)
-- ============================================================
CREATE TABLE IF NOT EXISTS export_jobs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid        NOT NULL REFERENCES schools(id),
  user_id     uuid        NOT NULL REFERENCES auth.users(id),
  job_type    text        NOT NULL CHECK (job_type IN ('excel_odevler', 'excel_yoklama', 'excel_mufredat', 'excel_notlar')),
  status      text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'error')),
  params      jsonb       NOT NULL DEFAULT '{}',
  result_url  text,
  error_msg   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own school's jobs
CREATE POLICY "export_jobs_school_read" ON export_jobs
  FOR SELECT TO authenticated
  USING (school_id = current_school_id() AND user_id = auth.uid());

CREATE POLICY "export_jobs_school_insert" ON export_jobs
  FOR INSERT TO authenticated
  WITH CHECK (school_id = current_school_id() AND user_id = auth.uid());

CREATE POLICY "export_jobs_school_update" ON export_jobs
  FOR UPDATE TO authenticated
  USING (school_id = current_school_id() AND user_id = auth.uid())
  WITH CHECK (school_id = current_school_id() AND user_id = auth.uid());

-- Index for polling
CREATE INDEX IF NOT EXISTS export_jobs_user_status ON export_jobs (user_id, status, created_at DESC);
