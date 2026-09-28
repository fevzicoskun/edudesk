-- 2026-09-29: tarih varsayılanları İstanbul günü.
-- CURRENT_DATE sunucu saatine (UTC) göredir: İstanbul'da 00:00–03:00 arası bir önceki günü verir.
-- Hızlı ödev ekleme verildiği günü göndermiyordu → gece verilen ödev dünün tarihine yazılıyordu
-- (uygulamada da düzeltildi; bu varsayılan, tarih göndermeyen her yolu korur).
alter table public.homeworks
  alter column assigned_date set default ((now() at time zone 'Europe/Istanbul')::date);

alter table public.mentor_reports
  alter column report_date set default ((now() at time zone 'Europe/Istanbul')::date);
