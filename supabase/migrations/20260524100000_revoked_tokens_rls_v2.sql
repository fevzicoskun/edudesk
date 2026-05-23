-- revoked_tokens RLS v2
-- Değişiklikler:
--   1. SELECT: anon erişimi kaldırıldı (yalnızca authenticated)
--   2. INSERT/DELETE: is_zumre_baskani_in_school() → can_revoke_tokens() (mudur + MY + baskan)
--   3. DELETE: WORM güvencesi korunuyor — sadece can_revoke_tokens() silebilir
-- Not: token doğrulama artık service role client ile yapılır (anon'a gerek yok)

-- Eski politikaları kaldır
DROP POLICY IF EXISTS "revoked_tokens_anon_read"     ON revoked_tokens;
DROP POLICY IF EXISTS "revoked_tokens_baskan_insert" ON revoked_tokens;
DROP POLICY IF EXISTS "revoked_tokens_baskan_delete" ON revoked_tokens;
DROP POLICY IF EXISTS "revoked_tokens_server_read"   ON revoked_tokens;
DROP POLICY IF EXISTS "revoked_tokens_manager_insert" ON revoked_tokens;
DROP POLICY IF EXISTS "revoked_tokens_manager_delete" ON revoked_tokens;

-- Yeni politikalar
CREATE POLICY "revoked_tokens_server_read" ON revoked_tokens
  FOR SELECT TO public
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "revoked_tokens_manager_insert" ON revoked_tokens
  FOR INSERT TO authenticated
  WITH CHECK (can_revoke_tokens());

-- DELETE sadece can_revoke_tokens() — WORM güvencesi korunuyor
CREATE POLICY "revoked_tokens_manager_delete" ON revoked_tokens
  FOR DELETE TO authenticated
  USING (can_revoke_tokens());

-- can_revoke_tokens() fonksiyonu (idempotent)
CREATE OR REPLACE FUNCTION public.can_revoke_tokens()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('mudur', 'mudur_yardimcisi', 'zumre_baskani')
      AND school_id = current_school_id()
  )
$$;
