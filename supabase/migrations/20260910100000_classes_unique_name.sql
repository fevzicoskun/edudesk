-- Aynı okul + eğitim yılında aynı adla ikinci sınıf açılamaz (2026-09-10: canlıda
-- çift "9-A" oluştu — form iki kez gönderildi, uygulama tarafında kontrol yoktu).
-- Kısıt DB'de: uygulama kodu ne yaparsa yapsın ikinci kayıt 23505 ile reddedilir.
-- Kısmi index: soft-delete edilmiş sınıflar sayılmaz (silip aynı adla yeniden açmak serbest).
-- Büyük/küçük harf duyarsız: "9-a" ile "9-A" aynı sınıftır.
create unique index if not exists classes_school_year_name_uniq
  on public.classes (school_id, academic_year, lower(name))
  where deleted_at is null;

-- ROLLBACK: drop index if exists public.classes_school_year_name_uniq;
