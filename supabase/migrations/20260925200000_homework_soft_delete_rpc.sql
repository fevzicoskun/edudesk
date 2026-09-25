-- Ödev soft-delete / geri alma RPC'leri (2026-09-25).
--
-- Sorun: homeworks_school_read silinmiş satırı yalnız zümre başkanına gösteriyor.
-- `update ... set deleted_at = now() ... returning id` yeni satır SELECT policy'sinden
-- geçemediği için öğretmen / müdür yrd. / müdür kendi ödevini SİLEMİYORDU (42501),
-- geri alma da WHERE silinmiş satırı göremediği için hiç çalışmıyordu (0 satır).
-- SELECT policy'si bilinçli olarak gevşetilmedi (silinmiş ödev diğer sorgulara sızardı);
-- yetki kuralı UPDATE policy'siyle birebir aynı: kendi ödevin + kendi okulun.

create or replace function public.soft_delete_homeworks(p_ids uuid[])
returns setof uuid
language sql
security definer
set search_path = public
as $$
  update public.homeworks
     set deleted_at = now(), deleted_by = auth.uid()
   where id = any(p_ids)
     and teacher_id = auth.uid()
     and school_id = current_school_id()
     and deleted_at is null
  returning id
$$;

create or replace function public.restore_homeworks(p_ids uuid[])
returns setof uuid
language sql
security definer
set search_path = public
as $$
  update public.homeworks
     set deleted_at = null, deleted_by = null
   where id = any(p_ids)
     and teacher_id = auth.uid()
     and school_id = current_school_id()
     and deleted_at is not null
  returning id
$$;

revoke execute on function public.soft_delete_homeworks(uuid[]) from public, anon;
revoke execute on function public.restore_homeworks(uuid[])     from public, anon;
grant  execute on function public.soft_delete_homeworks(uuid[]) to authenticated;
grant  execute on function public.restore_homeworks(uuid[])     to authenticated;
