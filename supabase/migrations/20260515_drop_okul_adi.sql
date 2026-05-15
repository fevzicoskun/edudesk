-- profiles.okul_adi denormalizasyonu kaldırıldı (2026-05-15)
-- Okul adı artık schools.name JOIN ile çekiliyor (single source of truth)
-- Rollback: ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS okul_adi TEXT;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS okul_adi;
