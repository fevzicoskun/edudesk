-- Eski "Haftalık Çalışma Planı" kaldırıldı (2026-10-16 kullanıcı): hiç kullanılmadı (canlıda yalnız 2 e2e artığı
-- + 1 pasif deneme kaynağı; yedek: edudesk_yedek/calisma-plani-kaldirma-oncesi-2026-10-16.json).
-- Yerini mentör haftalık takip aldı (20261016120000_mentor_haftalik_takip.sql).
drop table if exists public.study_plan_items;   -- trg_spi_touch ve policy'ler tabloyla gider
drop table if exists public.student_sources;
drop function if exists public.spi_touch_updated_at();
