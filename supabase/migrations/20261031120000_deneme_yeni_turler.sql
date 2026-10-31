-- Deneme türlerine Neler Hatırlıyorum (NH: TÜR, T.C, MAT, FEN) ve 8 dersli genel deneme (GENEL) eklenir (2026-10-31)
alter table public.deneme_sinavlari drop constraint if exists deneme_sinavlari_tur_check;
alter table public.deneme_sinavlari add constraint deneme_sinavlari_tur_check check (tur in ('TM', 'FKB', 'TCD', 'NH', 'GENEL'));
