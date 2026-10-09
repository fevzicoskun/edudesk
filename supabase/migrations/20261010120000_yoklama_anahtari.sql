-- Yoklama anahtarı (2026-10-10): okul yoklamayı EduDesk'te almıyorsa tüm yoklama/devamsızlık parçaları gizlenir,
-- bildirimler gitmez. Spec: docs/superpowers/specs/2026-10-10-yoklama-anahtari-design.md
alter table public.schools
  add column if not exists yoklama_aktif boolean not null default true;

-- Bahçeşehir Koleji Denizli bu yıl yoklamayı EduDesk'te almıyor (son kayıt 2026-05-30) → kapalı başlar
update public.schools set yoklama_aktif = false where id = '00000000-0000-0000-0000-000000000001';

-- Yalnız müdür / müdür yardımcısı kendi okulu için değiştirir (schools UPDATE policy'si yalnız zümre başkanına açık;
-- bu RPC dar kapsamlı: tek alan, rol + okul içeride doğrulanır)
create or replace function public.set_yoklama_aktif(p_aktif boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_mudur_or_my() then
    raise exception 'Yoklama ayarını yalnız müdür veya müdür yardımcısı değiştirebilir' using errcode = '42501';
  end if;
  update public.schools set yoklama_aktif = p_aktif where id = current_school_id();
end;
$$;

revoke execute on function public.set_yoklama_aktif(boolean) from anon, public;
grant execute on function public.set_yoklama_aktif(boolean) to authenticated;
