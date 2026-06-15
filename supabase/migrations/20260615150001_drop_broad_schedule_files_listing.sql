-- ============================================================
-- GÜVENLİK: schedule-files public bucket'ında geniş listeleme kapatıldı.
--
-- `schedule_files_select` policy'si TÜM authenticated kullanıcıların
-- bucket'taki BÜTÜN dosyaları listelemesine izin veriyordu (okul filtresi
-- yok). Bucket public olduğu için doğrudan obje URL erişimi bu policy'ye
-- ihtiyaç duymaz; geniş listeleme yalnızca dosya enumerasyonu riski getirir.
--
-- lesson_schedules / schedule-files özelliği henüz uygulama koduna bağlı
-- değil (sadece generated tiplerde). Özellik geliştirildiğinde okul-kapsamlı
-- (school_id) bir SELECT policy eklenmelidir.
-- ============================================================

drop policy if exists "schedule_files_select" on storage.objects;
