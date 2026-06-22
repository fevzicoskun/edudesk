-- Over-fetch temizliği: iki sıcak nokta agregatı DB'ye taşındı (cap + ham satır gider).

-- 1) Aylık bülten (cron, service_role): ay boyu yoklamayı sınıf başına present/total'a
--    indirger. Eski hali .limit(50000) ile ham (class_id,status) çekip JS'te grupluyordu.
--    service_role grant'i ZORUNLU — aylikBulten createServiceClient() ile çağırır.
create or replace function get_class_attendance_rates(p_school_id uuid, p_start date, p_end date)
returns table(class_id uuid, present bigint, total bigint)
language sql
security invoker
set search_path = public
as $$
  select class_id,
         count(*) filter (where status = 'present') as present,
         count(*) as total
  from attendance
  where school_id = p_school_id and date >= p_start and date <= p_end
  group by class_id
$$;

-- 2) Ödev durum panosu: sınıfın diğer (şablon-olmayan, silinmemiş, mevcut hariç)
--    ödevlerindeki submission'ları öğrenci başına "kaçırılan" sayısına + toplam
--    distinct ödev sayısına indirger. Eski hali ödev id listesi + .limit(12000) ham
--    submission çekip JS'te grupluyordu. total_homeworks her satırda tekrarlanır
--    (denormalize; tüketici ilk satırdan okur, 0 satır = 0).
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
  )
  select student_id,
         count(*) filter (where status in ('yapilmadi', 'eksik')) as missed,
         (select count(distinct homework_id) from subs) as total_homeworks
  from subs
  group by student_id
$$;

grant execute on function get_class_attendance_rates(uuid, date, date) to authenticated, service_role;
grant execute on function get_class_cumulative_load(uuid, uuid, uuid) to authenticated;
