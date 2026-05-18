# TODO — Zümre Takip

Bu dosya commit'lerle güncellenir.

---

## Tamamlananlar ✅

### Altyapı & Güvenlik
- [x] Next.js 16 App Router + Supabase SSR kurulumu
- [x] Multi-tenant izolasyon (`school_id` + RLS her tabloda)
- [x] 4 rol sistemi: `ogretmen`, `zumre_baskani`, `mudur_yardimcisi`, `mudur`
- [x] Enterprise RBAC — 48 izin, `withPermission` middleware
- [x] Supabase JWT + secure httpOnly cookies
- [x] HMAC-SHA256 imzalı public tokenlar (veli + yoklama yazdırma)
- [x] Token revocation tablosu (`revoked_tokens`)
- [x] Upstash Redis rate limiting (sliding window)
- [x] Per-request CSP nonce (`unsafe-inline` yok)
- [x] Zod validasyon tüm server action'larda
- [x] Soft delete (5 tablo: deleted_at / deleted_by)
- [x] Audit log sistemi (`audit_logs` — fire-and-forget)
- [x] Pino structured logging
- [x] Sentry error tracking

### Özellikler
- [x] Sınıf & öğrenci yönetimi (toplu ekleme, liste, notlar)
- [x] Ödev takibi (durum board, notlar, toplu güncelleme)
- [x] Yoklama (günlük devam, yıllık istatistik, yazdırma linki)
- [x] Veli portalı (HMAC-korumalı salt okunur özet)
- [x] Zümre toplantıları (gündem, tutanak yazdırma)
- [x] Ortak sınavlar (planlama + not girişi)
- [x] Müfredat takibi (TYMM import, konu bazlı ilerleme)
- [x] Öğretmen dosyası (MEB belge kontrol listesi)
- [x] Kişisel notlar (zengin metin editörü)
- [x] Dark mode (sistem teması + manuel)
- [x] Denetim günlüğü görüntüleme + token iptali
- [x] Excel export (server-side XLSX → Supabase Storage, 1 saatlik link)
- [x] Sınıf öğrenci listesi Excel export (`excel_sinif_ogrencileri`)
- [x] Notlar Excel export
- [x] Öğretmen dosyası PDF export (jspdf)
- [x] Mobil swipe-to-delete — ödev kartları (react-swipeable)
- [x] **Raporlar modülü** — `/raporlar/ogrenci`, `/raporlar/sinif`, `/raporlar/ogretmen`
  - Öğrenci: Pie (ödev tamamlama), Bar (devamsızlık), Line (haftalık trend), not ortalaması
  - Sınıf: Top 5 aktif/pasif öğrenci, sınıf karşılaştırma Bar
  - Öğretmen: Aylık ödev Bar, devamsızlık frekansı, müfredat %, kontrol hızı
  - Her rapor için Excel + PDF export
- [x] **Mentor sistemi**
  - `classes.mentor_teacher_id` kolonu + RLS (`mudur_yardimcisi_mentor_atama`)
  - Müdür yardımcısı sınıfa mentör öğretmen atar
  - `mentor_reports` tablosu + 3 RLS politikası
  - Mentör öğrenciye tarihli rapor girer, müdür/müdürY okuyabilir
- [x] **Müdür yardımcısı dashboard** — 14 günlük takvim-ajanda widget (`MYAjandaWidget`)
- [x] Kullanıcılar sayfası: müdür yardımcısı, müdürü listede görmez
- [x] Loading skeleton'lar (tüm rapor sayfaları)

---

## Yapılacaklar 🔲

### Öncelikli
- [ ] Öğrenci arama / filtre — sınıf listesi sayfasında global arama
- [ ] Bildirim sistemi — yaklaşan ödev teslim tarihi push/email
- [ ] Takvim entegrasyonu — Google Calendar sync (ödev + sınav tarihleri)
- [ ] Ödev şablonları — tekrarlayan ödev türleri için şablon kaydetme

### Orta vadeli
- [ ] Veli davet sistemi — e-posta ile veli portalı linki gönderme
- [ ] Toplu SMS/e-posta — devamsızlık bildirimi velilere
- [ ] Raporlar PDF'i — server-side PDF generation (Puppeteer veya PDFKit)
- [ ] Öğrenci profil fotoğrafı — Supabase Storage avatar upload
- [ ] Ders programı (time-table) modülü

### Uzun vadeli
- [ ] Öğretmen davet sistemi (e-posta ile davet + otomatik okul ataması)
- [ ] Çoklu okul yönetimi — tek müdür, birden fazla okul
- [ ] Mobil uygulama (React Native / Expo)
- [ ] Offline mod — PWA + service worker
- [ ] API dokümantasyonu (OpenAPI / Swagger)
