-- Müdür tarafında kullanılmayanlar kaldırıldı (2026-10-17 kullanıcı onayı; kod: 3e8cd4e..3946e4d).
-- Duyurular (kodu önceden kalkmıştı), okul toplantıları (giriş ekranı yoktu), takvim okul etkinlikleri (hiç girilmedi).
-- Yedek: edudesk_yedek/mudur-temizligi-oncesi-2026-10-17.json
--   (announcements 5 + reads 12 eski deneme; school_meetings 5 Nisan–Haziran deneme; school_events 68 e2e artığı, hepsi silinmiş).
drop function if exists public.get_first_unread_announcement(uuid, text, uuid);
drop type if exists public.unread_announcement_row;
drop table if exists public.announcement_reads;     -- announcements'a FK → önce bu
drop table if exists public.announcements;
drop table if exists public.school_meetings;
drop table if exists public.school_events;
