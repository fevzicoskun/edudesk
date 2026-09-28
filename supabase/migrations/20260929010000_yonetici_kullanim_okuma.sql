-- 2026-09-29: MY/müdür ana sayfası öğretmen aktifliğini usage_daily'den okur.
-- user_sessions'a yazan kod 2026-06-02 temizliğinde silinmişti; okuyan ekranlar kalmıştı → herkes "Pasif".
-- usage_daily (2026-07-05'ten beri canlı) öğretmen bazında gün gün kullanımı zaten tutuyor.

-- Yönetici (müdür/MY) yalnız KENDİ okulunun kullanım satırlarını okur. Öğretmen okuyamaz (policy yok = 0 satır).
create policy usage_daily_yonetici_read on public.usage_daily
  for select to authenticated
  using (school_id = public.current_school_id() and public.is_mudur_or_my());

-- Kişi başı özet Postgres'te (PostgREST max_rows=1000 sessiz kesilmesine karşı; satır sayısı kişi×ekran×gün).
-- SECURITY INVOKER: RLS'e tabidir — yetkisiz çağıranın sonucu boş.
create or replace function public.okul_son_kullanim(p_since date)
returns table (user_id uuid, son_gun date, gun_sayisi integer)
language sql
stable
security invoker
set search_path = public
as $$
  select ud.user_id, max(ud.day) as son_gun, count(distinct ud.day)::integer as gun_sayisi
  from public.usage_daily ud
  where ud.school_id = public.current_school_id()
    and ud.day >= p_since
  group by ud.user_id
$$;

revoke execute on function public.okul_son_kullanim(date) from anon;
grant execute on function public.okul_son_kullanim(date) to authenticated;
