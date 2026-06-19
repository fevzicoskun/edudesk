# Handoff

## State
2026-06-19 oturumu (Opus 4.8): kalite denetimi + e2e onarım/genişletme tamamlandı.
- **623 unit test ✓, 66 e2e test ✓ (8 spec), tsc temiz.** Branch `main`, tüm commit'ler push'landı.
- Güvenlik advisor denetimi: `assign_user_role` (auth.uid() guard'lı) + `homework_veli_notifications` (service_role-only, deny-all) doğrulandı → güvenli. 36 WARN hepsi bilinçli RLS helper'ları. Tek gerçek kalem `leaked_password_protection` (Pro-gated, ertelendi).
- E2E regresyon onarıldı: "ilk-kullanım & boş ekranlar" işi (commit 40e56f5) dashboard/çizelge/yoklama'yı öğretmenin sınıfı yoksa boş-durum gösterecek şekilde değiştirmişti → test öğretmeninin sınıfı yoktu → 4 test patlıyordu. `global-setup.ts`'e idempotent seed eklendi (sınıf + teacher_classes + 2 öğrenci).
- Eskimiş `cizelge.spec.ts` toggle testi gerçek 4-butonlu segmented control'e göre yeniden yazıldı (aktif durum `ring-2` ile doğrulanır).
- Yeni `yoklama-analitik.spec.ts` (8 test, 4 rol). global-setup TEST_USERS'a `zumre_baskani`+`mudur_yardimcisi` eklendi.

## Next
1. **Ödeme/abonelik altyapısı** — bir sonraki büyük hamle. Stripe DEĞİL (TR şirketine açmıyor) → başlangıçta manuel fatura+havale, ileride iyzico. `schools` tablosunda plan/trial_ends_at/suspended_* hazır.
2. (Opsiyonel) `zumre_baskani`/`mudur_yardimcisi` için daha geniş e2e (şu an yalnız analitik kapsamı test ediliyor).

## Context
- **E2E auth state'leri artık 4 rol:** ogretmen / mudur / zumre_baskani / mudur_yardimcisi. global-setup hepsini login edip `.auth/*.json` yazıyor. Öğretmene `__PW_TEST__ 9-A` sınıfı + 2 öğrenci seed'li.
- **Empty-state kapısı:** dashboard/çizelge/yoklama, öğretmenin `teacher_classes` kaydı yoksa bekleme ekranı gösterir (OgretmenDashboard.tsx firstRunState). Manager roller (zumre_baskani+) tüm okul sınıflarını görür.
- **Analitik RBAC iki eksen:** `isManager` (veri kapsamı) ↔ `canSeeCoverage = isMudurOrAbove` (kapsama bölümü görünürlüğü). Zümre başkanı = manager ama kapsama YOK (ara durum).
- `leaked_password_protection` Supabase Free plan'de kilitli; Pro'ya geçince Auth→Providers→Email'den 1 tık.
