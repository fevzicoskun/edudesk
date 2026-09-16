-- Ödev yazma yetkisi yalnızca sahibine
--
-- Sorun: zümre başkanı / müdür / müdür yardımcısı UI'da başkasının ödevini
-- silebiliyor gibi görünüyordu; uygulama katmanı "school" kapsamı görüp izin
-- veriyor, RLS ise reddediyordu. UPDATE hiçbir satıra denk gelmediği için
-- hata da dönmüyordu → ödev silinmemesine rağmen silindi sanılıyordu.
--
-- Karar: her öğretmen yalnızca kendi ödevini değiştirir/siler. Okul geneli
-- görüntüleme (SELECT) aynen korunur.

-- 1) Rol-izin matrisi: homework update/delete için okul kapsamlı bağları kaldır
delete from role_permissions rp
using permissions p
where rp.permission_id = p.id
  and p.resource = 'homework'
  and p.action in ('update', 'delete')
  and p.scope in ('school', 'any');

-- 2) RLS: zümre başkanı istisnasını yazma politikalarından çıkar
drop policy if exists homeworks_owner_update on homeworks;
create policy homeworks_owner_update on homeworks
  for update
  using (
    school_id = current_school_id()
    and teacher_id = (select auth.uid())
  );

drop policy if exists homeworks_owner_delete on homeworks;
create policy homeworks_owner_delete on homeworks
  for delete
  using (
    school_id = current_school_id()
    and teacher_id = (select auth.uid())
  );
