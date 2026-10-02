-- 2026-10-03: audit_logs.user_id FK'si ON DELETE SET NULL, ama WORM trigger'ı her UPDATE'i reddediyordu.
-- Bu yüzden audit kaydı olan kullanıcı silinemiyordu ("Database error deleting user").
-- Tek istisna: kullanıcı silinirken FK'nin user_id'yi boşaltması. Koşullar:
--   * pg_trigger_depth() > 1 → güncelleme FK eyleminden geliyor; elle UPDATE derinlik 1'dir
--   * yalnız user_id dolu → NULL; başka hiçbir kolon değişmemiş
-- Kaydın içeriği değişmez; silme hâlâ tamamen yasak.
create or replace function public.protect_audit_logs_worm()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and pg_trigger_depth() > 1
     and old.user_id is not null and new.user_id is null
     and (to_jsonb(new) - 'user_id') = (to_jsonb(old) - 'user_id') then
    return new;
  end if;
  raise exception 'audit_logs kaydı değiştirilemez veya silinemez (WORM koruması)';
end;
$$;