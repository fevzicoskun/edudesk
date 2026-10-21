-- Mentör takip haftası Cuma → Perşembe (2026-10-22, kullanıcı: kâğıt Cuma verilir, haftanın ödevleri o güne kadar verilmiş olur).
-- Eski kayıtlar Pazartesi başlangıçlı kalır (geçmiş okunur); yeni haftalar Cuma. Görev `gun`u haftanın günü (Pzt=0) — veri değişmez.
alter table public.mentor_haftalari drop constraint if exists mentor_haftalari_hafta_basi_check;
alter table public.mentor_haftalari add constraint mentor_haftalari_hafta_basi_check
  check (extract(isodow from hafta_basi) in (1, 5));
