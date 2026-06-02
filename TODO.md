# TODO — Teknik Borç & Bilinen Sorunlar

Bu dosya aktif geliştirme borcunu takip eder. Tamamlananlar silinir.

---

## Kritik

_(şu an yok)_

---

## Önemli

- [ ] **Playwright testleri React hidrasyonu test etmiyor** — mevcut E2E testler sadece SSR içeriğini kontrol ediyor; modal açma, durum güncelleme gibi interaktif akışlar test dışı
- [ ] **`HomeworkRecord.due_date` null güvenliği** — DB'de `null` olabilir ama tip `string` tanımlı; şablon ödevlerde `formatDate(null)` "null" yazısı render eder
- [ ] **Öğrenci yönetim sayfası yalnızca müdür/müdür yardımcısına açık** — öğretmen kendi sınıfındaki öğrenci ödev sicilini `/yonetim/ogrenciler` üzerinden göremez; sadece StatusBoard üzerinden erişebilir

---

## Minor

- [ ] **`HomeworkService.getStudentHomeworkProfile` dönüş tipi verbose** — union discriminated return type; bir `Result<T>` helper ile basitleştirilebilir
- [ ] **OgrencilerClient `classId ?? ''` fallback** — modal kapandığında `''` geçiliyor; UUID validasyonundan geçemez ama zaten `studentId === null` olduğunda action çağrılmaz; latent footgun
- [ ] **`revalidate = 30` tutarsızlığı** — bazı sayfalarda 30s, bazılarında 60s; standart belirlenmeli
- [ ] **Dev CSP'de `unsafe-eval`** — `proxy.ts`'e eklendi; production'a asla geçmemeli (kontrol mekanizması yok)

---

## Test Eksikleri

- [ ] `StudentHomeworkProfileModal` için component test — loading/error/data state'leri
- [ ] `OgrencilerClient` "Ödev Sicili" butonu E2E testi
- [ ] StatusBoard öğrenci adı tıklama E2E testi

---

## Sprint Özeti (2026-06-02)

### Tamamlanan
- `computeStudentHomeworkStats` pure function + 6 unit test
- `HomeworkRepository.findStudentHomeworkProfile` (paralel sorgu, hata yönetimi, school_id izolasyonu)
- `HomeworkService.getStudentHomeworkProfile` + 6 unit test (RBAC, join, stats)
- `getStudentHomeworkProfile` server action (UUID validasyonu)
- `StudentHomeworkProfileModal` — öğrenci adı, veli/WhatsApp, 4 stat kartı, tamamlanma barı, dönem ödev listesi
- StatusBoard entegrasyonu — öğrenci adı `<button>`, modal classId prop
- OgrencilerClient entegrasyonu — "Ödev Sicili" butonu
- Dev CSP fix (`unsafe-eval` dev mode'a eklendi)

### Sayılar
- 10 dosya değişti, 495+ satır eklendi
- 180/180 unit test geçiyor
- 9 commit, main'e push edildi, Vercel deploy edildi
