-- get_class_cumulative_load: yalnız öğretmenin İŞARETLEDİĞİ satırlar sayılır.
-- Trigger her öğrenciye varsayılan 'yapilmadi' satır açıyor; marked_at süzgeci yokken
-- kontrol edilmemiş ödevler "kaçırıldı" sayılıyordu (canlıda bir sınıfta 56'ya karşı gerçek 1).
-- Payda da yalnız kontrol edilmiş (en az bir işaretli satırı olan) ödevler.
create or replace function get_class_cumulative_load(p_class_id uuid, p_school_id uuid, p_exclude_homework uuid)
returns table(student_id uuid, missed bigint, total_homeworks bigint)
language sql
security invoker
set search_path = public
as $$
  with subs as (
    select hs.student_id, hs.status, hs.homework_id
    from homework_submissions hs
    join homeworks h on h.id = hs.homework_id
    where h.class_id = p_class_id
      and h.school_id = p_school_id
      and h.deleted_at is null
      and h.is_template = false
      and h.id <> p_exclude_homework
      and hs.marked_at is not null
  )
  select student_id,
         count(*) filter (where status in ('yapilmadi', 'eksik')) as missed,
         (select count(distinct homework_id) from subs) as total_homeworks
  from subs
  group by student_id
$$;
