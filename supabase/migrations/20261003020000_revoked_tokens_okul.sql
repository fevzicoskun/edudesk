-- 2026-10-03: revoked_tokens'ta okul yoktu; SELECT her girişli kullanıcıya açıktı → bir okulun yöneticisi
-- (listRevokedTokens) TÜM okulların iptal kayıtlarını, serbest metin gerekçe dahil görebiliyordu.
-- İptal kontrolü (isTokenRevoked: veli sayfası + veli olay API'si) servis anahtarıyla okur → bu kısıttan etkilenmez.
-- Canlıda tablo boştu (0 satır) → NOT NULL doğrudan eklenebilir.
alter table public.revoked_tokens
  add column school_id uuid not null references public.schools(id) on delete cascade;

drop policy if exists revoked_tokens_server_read on public.revoked_tokens;
create policy revoked_tokens_okul_read on public.revoked_tokens
  for select to authenticated
  using (school_id = (select public.current_school_id()));

drop policy if exists revoked_tokens_manager_insert on public.revoked_tokens;
create policy revoked_tokens_manager_insert on public.revoked_tokens
  for insert to authenticated
  with check (
    school_id = (select public.current_school_id())
    and (
      public.can_revoke_tokens()
      or exists (
        select 1 from public.veli_tokens
        where veli_tokens.jti = revoked_tokens.jti
          and veli_tokens.issued_by = (select auth.uid())
      )
    )
  );

drop policy if exists revoked_tokens_manager_delete on public.revoked_tokens;
create policy revoked_tokens_manager_delete on public.revoked_tokens
  for delete to authenticated
  using (school_id = (select public.current_school_id()) and public.can_revoke_tokens());
