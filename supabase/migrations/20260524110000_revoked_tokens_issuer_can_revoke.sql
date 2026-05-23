-- revoked_tokens INSERT policy v2
-- Sorun: ogretmen kendi oluşturduğu veli tokenını revoke edemiyordu.
-- Servis katmanı izin veriyordu ama RLS engelliyordu.
--
-- Çözüm: INSERT policy'ye ikinci koşul eklendi:
--   can_revoke_tokens() → yöneticiler her tokenı revoke edebilir
--   OR issued_by = auth.uid() → token sahibi kendi oluşturduğu tokenı revoke edebilir

DROP POLICY IF EXISTS "revoked_tokens_manager_insert" ON revoked_tokens;

CREATE POLICY "revoked_tokens_manager_insert" ON revoked_tokens
  FOR INSERT TO authenticated
  WITH CHECK (
    can_revoke_tokens()
    OR EXISTS (
      SELECT 1 FROM veli_tokens
      WHERE veli_tokens.jti = revoked_tokens.jti
        AND veli_tokens.issued_by = auth.uid()
    )
  );
