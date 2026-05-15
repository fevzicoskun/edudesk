-- profiles.okul_adi denormalizasyonu kaldırıldı
-- Okul adı artık schools.name JOIN ile çekiliyor (single source of truth)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS okul_adi;
