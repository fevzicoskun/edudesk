# TODO — EduDesk

---

## Tamamlananlar ✅

### Altyapı & Güvenlik
- [x] Next.js 16 App Router + Supabase SSR kurulumu
- [x] Multi-tenant izolasyon (`school_id` + RLS her tabloda)
- [x] 4 rol sistemi: `ogretmen`, `zumre_baskani`, `mudur_yardimcisi`, `mudur`
- [x] Enterprise RBAC — 48 izin, `withPermission` middleware
- [x] Supabase JWT + secure httpOnly cookies
- [x] HMAC-SHA256 imzalı public tokenlar (veli + yoklama yazdırma)
- [x] Token revocation tablosu + Redis fail-closed cache
- [x] Upstash Redis rate limiting (sliding window)
- [x] Per-request CSP nonce (`unsafe-inline` yok)
- [x] Zod validasyon tüm server action'larda
- [x] Soft delete (5 tablo: deleted_at / deleted_by) + 30 gün restore UI
- [x] Audit log sistemi — WORM korumalı
- [x] Pino structured logging
- [x] Sentry error tracking
- [x] Uygulama katmanında defense-in-depth (explicit school_id filtreleri)
- [x] deleteMentorReport auth check (mentor_id doğrulama)
- [x] addMentorReport content max 2000 karakter limiti

### Özellikler
- [x] Sınıf & öğrenci yönetimi (toplu ekleme, liste, notlar, Excel export)
- [x] Ödev takibi (durum board, notlar, toplu güncelleme, Excel export)
- [x] Mobil swipe-to-delete — ödev kartları (react-swipeable)
- [x] Yoklama (günlük devam, yıllık istatistik, yazdırma linki)
- [x] Veli portalı (HMAC-korumalı salt okunur özet)
- [x] Zümre toplantıları (gündem, tutanak yazdırma, branch filtresi)
- [x] Ortak sınavlar (planlama + öğrenci bazlı not girişi)
- [x] Müfredat takibi (TYMM import, konu bazlı ilerleme)
- [x] Öğretmen dosyası (MEB belge kontrol listesi + PDF export)
- [x] Kişisel notlar (editör + Excel export)
- [x] Dark mode (sistem teması + manuel)
- [x] Denetim günlüğü görüntüleme + token iptali
- [x] Excel export — server-side async (Inngest + Supabase Storage)
- [x] Excel export — sınıf öğrenci listesi
- [x] **Raporlar modülü** — `/raporlar/ogrenci`, `/raporlar/sinif`, `/raporlar/ogretmen`
  - Öğrenci: Pie (ödev tamamlama), Bar (devamsızlık), Line (trend), not ortalaması
  - Sınıf: Top 5 aktif/pasif öğrenci, sınıf karşılaştırma Bar
  - Öğretmen: Aylık ödev Bar, devamsızlık frekansı, müfredat %, kontrol hızı
  - Her rapor için Excel + PDF export
- [x] **Raporlar → Mentör sekmesi** (Başkan/MY/Müdür)
- [x] **Mentor sistemi**
  - `classes.mentor_teacher_id` + mentor atama UI (MY)
  - `mentor_reports` tablosu + RLS (3 politika)
  - Mentor tarihli rapor yazma, yöneticiler okuma
  - Sidebar'da mentör sekmesi rol bazlı görünür
- [x] **Mentörlük dashboard** — `/mentorluk`
  - Atanmış sınıf öğrencilerine rapor ekle/sil
  - Manuel öğrenci ekleme: ad, anne/baba adı, telefon
  - Manuel öğrencilere not ekle/sil
  - `mentor_students` + `mentor_student_notes` tabloları + RLS
- [x] **Ders Programı modülü** — `/ders-programi`
  - PDF/resim drag-and-drop yükleme (MY)
  - Resmi / Okul tipi (Okul tipi ismi özelleştirilebilir)
  - Öğretmen bazlı / sınıf bazlı atama
  - Öğretmen dashboard'u: DersProgramiWidget (iframe/img)
  - `lesson_schedules` tablosu + `schedule-files` storage bucket
- [x] **Müdür Yardımcısı dashboard** — devamsızlık, öğretmenler, ajanda, mentör özeti
- [x] **Müdür dashboard** — okul istatistikleri, ajanda, mentör rapor özeti
- [x] Kullanıcılar sayfası: müdür yardımcısı, müdürü listede görmez
- [x] Loading skeleton'lar (raporlar, ders programı)
- [x] Tablo mobil uyumu (overflow-x-auto: kullanicilar, SinavCard)
- [x] Dark mode eksiklikleri (odevler/[id] sayfası)
- [x] updateNote sonrası revalidatePath eksikliği giderildi
- [x] Veli linkinde çalışmayan "Erişimi Kapat" butonu kaldırıldı

---

## Yapılacaklar 🔲

### Öncelikli
- [ ] Öğrenci arama / filtre — sınıf listesi sayfasında isim bazlı arama
- [ ] Bildirim sistemi — yaklaşan ödev teslim tarihi push/email bildirimi
- [ ] Veli linki erişim kapatma — öğretmen arayüzüne düzgün çalışan "Devre Dışı Bırak" ekle

### Orta Vadeli
- [ ] Takvim entegrasyonu — ödev + sınav tarihlerini takvimde gösterme
- [ ] Ödev şablonları — tekrarlayan ödev türleri için şablon kaydetme
- [ ] Veli davet sistemi — e-posta ile veli portalı linki gönderme
- [ ] Toplu SMS/e-posta — devamsızlık bildirimi velilere
- [ ] Raporlar server-side PDF (Puppeteer veya PDFKit)
- [ ] Öğrenci profil fotoğrafı — Supabase Storage avatar upload
- [ ] Custom domain — `edudesk.com.tr` veya benzeri

### Uzun Vadeli
- [ ] Öğretmen davet sistemi (e-posta ile davet + otomatik okul ataması)
- [ ] Çoklu okul yönetimi — tek müdür, birden fazla okul
- [ ] Mobil uygulama (React Native / Expo)
- [ ] Offline mod — PWA + service worker
- [ ] API dokümantasyonu (OpenAPI / Swagger)
- [ ] Öğrenci performans tahminleme (ML tabanlı uyarı sistemi)
