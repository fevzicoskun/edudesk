-- Görüşmeler okulda Metodbox'a giriliyor; EduDesk'te hep "Görüşme yok" görünüp mentörü haksız
-- gösterecekti (kullanıcı kararı 2026-10-11). Kullanılmayan fonksiyon kaldırılır.
drop function if exists public.mentor_gorusme_ozeti();
