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
- [x] 409 unit test + 8 Playwright E2E spec
- [x] Structured logging (Pino, 5 domain)
- [x] Web Push bildirimleri
- [x] Platform admin paneli (okul/tenant yönetimi)
- [x] Güvenlik: XSS, cross-tenant, RBAC düzeltmeleri (17 bulgu)
- [x] Performans: N+1 giderildi, pagination, lazy charts

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

## Teknik Borç

- [ ] Playwright E2E kapsamını genişlet (modal, status update, matrix)
- [x] 9 `as unknown as` Supabase join cast → 0'a indirildi (kalite sprinti)
- [x] 7 dosya 300+ satır → bölündü (kalite sprinti)
- [ ] `app/platform/actions.ts` N+1 pattern → batched query
