-- 2026-10-18: Öğretmen Aktivitesi raporu teacher_activity_log'un son 30 gününü ham satır satır çekip
-- JS'de sayıyordu (her anasayfa açılışı bir satır → sayfa her gün yavaşlıyordu). Bu fonksiyon satırları
-- (öğretmen, işlem, Türkiye günü) grubuna indirir; her grup için adet + en yeni kaydın zamanı/id/meta'sı.
-- activityReport.ts'deki hesaplar (öğretmen sayıları, özet, akış) bu gruplardan birebir aynı sonucu çıkarır.
-- SECURITY INVOKER: mevcut RLS (kendi kaydı / yönetici kendi okulu) aynen geçerli.
-- Sorgu idx_teacher_activity_log_school_created (school_id, created_at desc) indeksini kullanır.
create or replace function public.ogretmen_aktivite_gunluk(p_since timestamptz)
returns table (
  teacher_id uuid,
  action     text,
  gun        date,
  adet       integer,
  son_at     timestamptz,
  son_id     uuid,
  son_meta   jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
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
  -- en yeni kayıt grubun temsilcisi; eşit zamanda id artan (eski sıralamayla aynı: created_at desc, id)
  order by l.teacher_id, l.action, (l.created_at at time zone 'Europe/Istanbul')::date, l.created_at desc, l.id
$$;

revoke execute on function public.ogretmen_aktivite_gunluk(timestamptz) from public, anon;
grant execute on function public.ogretmen_aktivite_gunluk(timestamptz) to authenticated;
