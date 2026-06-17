-- ============================================================
-- GÜVENLİK (defense-in-depth): homework_veli_notifications
--
-- Tablo YALNIZCA service_role (Inngest odevSonrasiVeliNotifier) ile
-- okunup yazılıyor; UI'dan hiç erişilmiyor. RLS açık + 0 policy
-- olduğundan anon/authenticated zaten erişemiyor (policy yok = deny).
--
-- Ancak Supabase default'u anon/authenticated'a tam tablo GRANT'i
-- bırakmış (INSERT/UPDATE/DELETE/TRUNCATE...). Bunları tutan tek şey
-- RLS — tek savunma hattı. Ölü grant'leri kaldırıp service_role'ü
-- yegane erişim yapıyoruz.
-- ============================================================

revoke all on table public.homework_veli_notifications from anon, authenticated;
