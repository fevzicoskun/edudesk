-- Öğretmen aktivite akışı: tüm ödevleri silinmiş log kayıtları (deneme/yanlış girilen ödevler) gösterilmez.
-- Yeni kayıtlarda meta.homework_ids action'da yazılır; eski kayıtlarda yalnız silinmiş ödeve
-- birebir eşleşenler geriye dönük doldurulur (aynı öğretmen + aynı başlık + <5 sn; canlıda 6 satır).
-- homework_ids'i olmayan eski kayıtlar eskisi gibi görünür. Ödev geri yüklenirse kayıt geri gelir.

create or replace function public.ogretmen_aktivite_gunluk(p_since timestamp with time zone)
 returns table(teacher_id uuid, action text, gun date, adet integer, son_at timestamp with time zone, son_id uuid, son_meta jsonb)
 language sql
 stable
 set search_path to 'public'
as $function$
  select distinct on (l.teacher_id, l.action, (l.created_at at time zone 'Europe/Istanbul')::date)
    l.teacher_id,
    l.action,
    (l.created_at at time zone 'Europe/Istanbul')::date as gun,
    (count(*) over (partition by l.teacher_id, l.action, (l.created_at at time zone 'Europe/Istanbul')::date))::integer as adet,
    l.created_at as son_at,
    l.id as son_id,
    l.meta as son_meta
  from teacher_activity_log l
  where l.school_id = (select current_school_id())
    and l.created_at >= p_since
    and not (
      coalesce(jsonb_typeof(l.meta -> 'homework_ids') = 'array', false)  -- NULL kalırsa WHERE satırı eler: eski kayıtlar kaybolurdu
      and not exists (
        select 1 from homeworks h
        where h.id in (select (jsonb_array_elements_text(l.meta -> 'homework_ids'))::uuid)
          and h.deleted_at is null
      )
    )
  -- en yeni kayıt grubun temsilcisi; eşit zamanda id artan (eski sıralamayla aynı: created_at desc, id)
  order by l.teacher_id, l.action, (l.created_at at time zone 'Europe/Istanbul')::date, l.created_at desc, l.id
$function$;

update teacher_activity_log l
set meta = l.meta || jsonb_build_object('homework_ids', (
  select jsonb_agg(h.id) from homeworks h
  where h.teacher_id = l.teacher_id
    and lower(h.title) = lower(l.meta ->> 'title')
    and abs(extract(epoch from h.created_at - l.created_at)) < 5
))
where l.action = 'odev_eklendi'
  and not (l.meta ? 'homework_ids')
  and exists (
    select 1 from homeworks h
    where h.deleted_at is not null
      and h.teacher_id = l.teacher_id
      and lower(h.title) = lower(l.meta ->> 'title')
      and abs(extract(epoch from h.created_at - l.created_at)) < 5
  );
