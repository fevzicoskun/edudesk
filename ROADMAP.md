# EduDesk Roadmap

**Vizyon:** Türk MEB okullarına özel, öğretmen odaklı yönetim platformu. Ödev takibi ve yoklama derinleştirilmiş; veli iletişimi otomatik.

---

## Faz 1 — Çekirdek (tamamlandı)

- [x] Ödev durum girişi (5 durum, per-öğrenci anlık güncelleme, toplu güncelleme)
- [x] Tamamlanma özet barı + segmentli görsel
- [x] Per-öğrenci pending state
- [x] Ödev şablonları ve kopyalama
- [x] Çoklu sınıfa tek seferde ödev atama
- [x] Urgency badge: "Bugün!" / "Yarın" / "X gün" / "Aktif"
- [x] "✓ Tümü girildi" tamamlanma badge
- [x] **Sınıf Ödev Matrisi** — öğrenci × ödev görünümü, satır/sütun tamamlanma %
- [x] Öğrenci ödev sicili modali
- [x] Veli WhatsApp bildirimi (manuel + Inngest otomatik)
- [x] Excel export

---

## Faz 2 — Derinleştirme (tamamlandı)

### Yoklama Sistemi
- [x] 4 durum: mevcut / devamsız / geç / özürlü
- [x] Toplu işlemler: Hepsini Mevcut / Devamsız / Özürlü
- [x] Yıllık devamsızlık badge (öğrenci başlığı)
- [x] MEB uyarı sistemi: 15 gün amber, 20 gün kırmızı
- [x] Hafta sonu + geçmiş tarih uyarı banner'ları
- [x] Toast otomatik kapanma + zengin kayıt özeti
- [x] Aylık çizelge: gün adları, bugün vurgusu, yıllık eşik renklendirme
- [x] Sınıf özet bar (kaç öğrenci uyarı/tehlike bölgesinde)
- [x] Öğrenci devamsızlık geçmişi modali
- [x] Excel export: detay + özet sayfası
- [x] Inngest yoklama hatırlatıcısı (10:00 Istanbul, Pzt–Cum)
- [x] Otomatik veli bildirimi (devamsız/geç → e-posta, 45 dk gecikme)

### Altyapı & Kalite
- [x] Supabase typed client (`database.types.ts`)
- [x] 600 unit test + 8 Playwright E2E spec
- [x] Structured logging (Pino, 5 domain)
- [x] Web Push bildirimleri
- [x] Platform admin paneli (okul/tenant yönetimi)
- [x] Güvenlik: XSS, cross-tenant, RBAC düzeltmeleri (17 bulgu)
- [x] Performans: N+1 giderildi, pagination, lazy charts, RLS konsolidasyonu (advisor 242→63)

### Sertleştirme & Temizlik (2026-06-15)
- [x] Export tek standarda indirildi — kullanılmayan async kuyruk (`export_jobs`, Inngest exportXlsx) silindi, tek senkron `/api/export`
- [x] `schools` abonelik kolonları eklendi (plan/trial_ends_at/suspended_*) → /ayarlar kartı düzeldi
- [x] **Kritik güvenlik:** `active_*` + `tenant_metrics` view'lerinde `security_invoker=on` — anon kiracı izolasyonu açığı kapatıldı
- [x] 10 fonksiyona sabit `search_path`, notifications INSERT policy service_role'e kısıt, schedule-files geniş listeleme kaldırıldı
- [x] Güvenlik advisor: ERROR 4→0

---

## Faz 3 — Genişleme (sıradaki)

### Ödev Derinleştirme
- [ ] **Ödev puanlama** — yapılan ödevlere puan/not girişi, sınıf ortalaması
- [ ] **Tekrarlayan ödevler** — haftalık/aylık otomatik oluşturma
- [ ] **Ödev geçmişi raporu** — dönem sonu PDF/Excel çıktısı
- [ ] **Sınıf matrisi: filtre + sıralama** — öğrenci adı, tamamlanma oranı

### Yoklama Derinleştirme
- [ ] **Devamsızlık raporu sayfası** — MEB sınırına yaklaşanların müdüre özet raporu
- [ ] **Özür belgesi yükleme** — özürlü günlere dosya ekleme (Supabase Storage)
- [ ] **Yoklama SMS** — devamsızlık günü SMS bildirimi (Netgsm)

### Veli & İletişim
- [ ] **Veli portalı** — velinin çocuğunun ödev + yoklama sicilini görmesi
- [ ] **Toplu WhatsApp** — belirli statüdeki tüm velilere tek tıkla mesaj
- [ ] **SMS bildirimi** — Netgsm entegrasyonu (`veli_telefon` hazır)

---

## Faz 4 — Abonelik & Faturalama (sıradaki büyük hamle)

EdTech'in en büyük açığı; DB temeli hazır (`schools.plan` / `trial_ends_at` / `suspended_*`).

- [ ] **Stripe entegrasyonu** — okul abonelik planları (free/starter/pro/enterprise)
- [ ] Plan bazlı kota/özellik kapısı (öğretmen/öğrenci limiti)
- [ ] Deneme süresi (`trial_ends_at`) ve süre dolunca askıya alma akışı
- [ ] Faturalama webhook'ları (Inngest) + ödeme başarısız → `status=suspended`
- [ ] Pro plana geçişte: Supabase "Leaked password protection" toggle'ını aç (Free'de kilitli)

---

## Teknik Borç

- [ ] Playwright E2E kapsamını genişlet (modal, status update, matrix)
- [x] 9 `as unknown as` Supabase join cast → 0'a indirildi (kalite sprinti)
- [x] 7 dosya 300+ satır → bölündü (kalite sprinti)
- [ ] `app/platform/actions.ts` N+1 pattern → batched query
- [ ] `active_*` view'leri migration geçmişinde yok (drift) — özellik gerekince CREATE VIEW migration'a eklenmeli
- [ ] Güvenlik advisor kalan 52 WARN: SECURITY DEFINER RLS yardımcı fonksiyonları (bilerek bırakıldı — revoke RLS'i kırar)
