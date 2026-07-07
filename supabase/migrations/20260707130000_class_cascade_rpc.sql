-- Sınıf silme/geri yükleme cascade'i tek transaction'a alındı (Codex 2026-07-07
-- ince nokta): önceki 3-adımlı istemci akışında ilk adım başarılı + ikinci adım
-- hatalıysa kısmi durum kalıyordu. Postgres fonksiyonu = tek transaction; herhangi
-- bir adım hata verirse tamamı geri alınır. security invoker → RLS aynen uygulanır
-- (yetkisiz update tüm işlemi iptal eder), deleted_by = auth.uid().

create or replace function public.soft_delete_class_cascade(p_class_id uuid, p_school_id uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  update homeworks set deleted_at = now(), deleted_by = auth.uid()
    where class_id = p_class_id and school_id = p_school_id and deleted_at is null;
  update students set deleted_at = now(), deleted_by = auth.uid()
    where class_id = p_class_id and school_id = p_school_id and deleted_at is null;
  update classes set deleted_at = now(), deleted_by = auth.uid()
    where id = p_class_id and school_id = p_school_id;
$$;

create or replace function public.restore_class_cascade(p_class_id uuid, p_school_id uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  update classes set deleted_at = null, deleted_by = null
    where id = p_class_id and school_id = p_school_id;
  update students set deleted_at = null, deleted_by = null
    where class_id = p_class_id and school_id = p_school_id and deleted_at is not null;
  update homeworks set deleted_at = null, deleted_by = null
    where class_id = p_class_id and school_id = p_school_id and deleted_at is not null;
$$;

grant execute on function public.soft_delete_class_cascade(uuid, uuid) to authenticated;
grant execute on function public.restore_class_cascade(uuid, uuid) to authenticated;
