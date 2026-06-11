# E2E Test Suite — Design Spec

**Tarih:** 2026-06-09  
**Kapsam:** Auth akışı, ödev CRUD, sınıf yönetimi

## Bağlam

Mevcut altyapı hazır: `playwright.config.ts`, `global-setup.ts`, `auth.fixture.ts`, 3 spec dosyası.
Sorunlar: `ogretmen.json` eksik/bozuk, `mudur.json` hiç yok.

## Değişiklikler

### 1. `tests/playwright/setup/global-setup.ts` — Düzeltme

- Dead code (profiles ID sorgusu) kaldırıldı
- Login timeout 10s → 15s
- `mudur.json` garantili yazılıyor

### 2. `tests/playwright/e2e/auth-flow.spec.ts` — YENİ

Fresh context (storageState yok). Testler:
1. Login formu görünür
2. Doğru bilgilerle giriş → /anasayfa
3. Yanlış şifre → hata mesajı
4. Giriş → /profil → Çıkış → /login

### 3. `tests/playwright/e2e/homework.spec.ts` — YENİ

ogretmen storageState. Testler:
1. /odevler yüklenir
2. Yeni ödev formu açılır, alanlar görünür
3. Sınıf seçilmeden submit disabled
4. Sınıf varsa: ödev oluştur → listede görünür → sil (conditional)

### 4. `tests/playwright/e2e/classes.spec.ts` — YENİ

ogretmen storageState. Testler:
1. /siniflar başlık + eğitim yılı
2. Sınıf varsa detay açılır

## Seçici Kararları

- `#email`, `#password` → LoginForm'da `id` attribute mevcut
- `button[type="submit"]` → submit buton
- `h1:has-text("Sınıflar")` → başlık
- Çıkış: `/profil` → `button:has-text("Çıkış Yap")`

## Kapsam Dışı

- Yoklama E2E (veri bağımlı, sonraki sprint)
- Müdür CRUD testleri (storageState henüz üretilmedi)
- Visual regression testleri
