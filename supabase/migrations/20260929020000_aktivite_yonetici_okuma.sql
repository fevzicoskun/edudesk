-- 2026-09-29: "Öğretmen Aktivitesi" raporu (/rapor/ogretmen-aktivite) MY/müdürde herkesi 0 ve "Pasif"
-- gösteriyordu. teacher_activity_log'da baseline'dan beri yalnız "kendi kaydını oku" politikası vardı;
-- raporu yalnız müdür/MY açabildiği halde onların okuma izni yoktu. (Ana sayfa kartı DEFINER RPC
-- school_teacher_activity ile okuduğu için doğru görünüyordu — iki ekran ayrışıyordu.)
-- Yönetici yalnız KENDİ okulunun kayıtlarını okur; öğretmenin kuralı değişmez.
create policy teacher_activity_log_yonetici_read on public.teacher_activity_log
  for select to authenticated
  using (school_id = public.current_school_id() and public.is_mudur_or_my());
