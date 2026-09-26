-- Sınıf cascade'i düzeltmesi (2026-09-26).
-- 1) Invoker'dı: homeworks_owner_update yalnız sahibine izin verdiği için müdür sınıfı silince
--    başka öğretmenlerin ödevleri SESSİZCE atlanıyordu → definer + açık yetki/okul kontrolü.
-- 2) Geri yükleme sınıftaki tüm silinmiş satırları diriltiyordu (önceden tek tek silinmiş
--    ödev/öğrenci dahil). Cascade tek transaction'da now() yazar → aynı damga = cascade'in sildiği.
--    Yalnız sınıfın deleted_at'ine eşit satırlar geri gelir.

create or replace function public.soft_delete_class_cascade(p_class_id uuid, p_school_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_simdi timestamptz := now();
begin
  if p_school_id is distinct from current_school_id() or not can_manage_classes() then
    raise exception 'Sınıf silme yetkiniz yok' using errcode = '42501';
  end if;
  update classes set deleted_at = v_simdi, deleted_by = auth.uid()
    where id = p_class_id and school_id = p_school_id and deleted_at is null;
  if not found then
    raise exception 'Sınıf bulunamadı' using errcode = 'P0002';
  end if;
  update homeworks set deleted_at = v_simdi, deleted_by = auth.uid()
    where class_id = p_class_id and school_id = p_school_id and deleted_at is null;
  update students set deleted_at = v_simdi, deleted_by = auth.uid()
    where class_id = p_class_id and school_id = p_school_id and deleted_at is null;
end;
$$;

create or replace function public.restore_class_cascade(p_class_id uuid, p_school_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_damga timestamptz;
begin
  if p_school_id is distinct from current_school_id() or not can_manage_classes() then
    raise exception 'Sınıf geri yükleme yetkiniz yok' using errcode = '42501';
  end if;
  select deleted_at into v_damga from classes
    where id = p_class_id and school_id = p_school_id and deleted_at is not null;
  if v_damga is null then
    raise exception 'Silinmiş sınıf bulunamadı' using errcode = 'P0002';
  end if;
  update classes set deleted_at = null, deleted_by = null where id = p_class_id;
  update students set deleted_at = null, deleted_by = null
    where class_id = p_class_id and school_id = p_school_id and deleted_at = v_damga;
  update homeworks set deleted_at = null, deleted_by = null
    where class_id = p_class_id and school_id = p_school_id and deleted_at = v_damga;
end;
$$;

revoke execute on function public.soft_delete_class_cascade(uuid, uuid) from public, anon;
revoke execute on function public.restore_class_cascade(uuid, uuid) from public, anon;
grant execute on function public.soft_delete_class_cascade(uuid, uuid) to authenticated;
grant execute on function public.restore_class_cascade(uuid, uuid) to authenticated;
