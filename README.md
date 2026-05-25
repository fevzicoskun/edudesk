# EduDesk — Öğretmen Yönetim Platformu

Türk ortaöğretim öğretmenleri için Next.js + Supabase tabanlı, production-grade okul yönetim platformu.

**Canlı:** https://myedudesk.com.tr

---

## ✨ Özellikler

| Modül | Açıklama |
|-------|----------|
| **Sınıf & Öğrenci** | Toplu ekleme, sınıf bazlı liste, öğrenci notları, Excel export |
| **Ödev Takibi** | Durum board, notlar, toplu güncelleme, Excel export, mobil swipe sil |
| **Yoklama** | Günlük devam takibi, yıllık devamsızlık istatistikleri, yazdırma linki |
| **Not Defteri** | Yazılı/quiz/proje notları, inline düzenleme, sütun ortalamaları, Excel export |
| **Veli Portalı** | HMAC-imzalı link ile salt okunur öğrenci özeti (ödev + devamsızlık + notlar) |
| **Zümre Toplantıları** | Gündem oluşturma, tutanak yazdırma *(sadece Zümre Başkanı)* |
| **Ortak Sınavlar** | Sınav planlaması, öğrenci bazlı not girişi *(sadece Zümre Başkanı)* |
| **Müfredat Takibi** | TYMM import, konu bazlı ilerleme |
| **Raporlar** | Öğrenci/sınıf/öğretmen/mentor bazlı interaktif grafikler (Recharts) + Excel/PDF export |
| **Mentörlük** | Atanmış sınıf öğrencilerine rapor + kişisel öğrenci takip defteri |
| **Ders Programı** | MY PDF/resim yükler → öğretmenler dashboard'dan görür |
| **Müdür Y. Dashboard** | Devamsızlık özeti, öğretmen listesi, ajanda, mentör rapor özeti |
| **Müdür Dashboard** | Okul geneli istatistikler, ajanda, mentör rapor özeti |
| **Denetim Günlüğü** | Tüm işlemler kaydedilir; token iptali *(Başkan/Müdür)* |
| **Öğretmen Dosyası** | MEB belge kontrol listesi, PDF export |
| **Kişisel Notlar** | Not editörü, Excel export |
| **Dark Mode** | Sistem teması veya manuel geçiş |
| **Öğretmen Anasayfası** | Risk uyarıları, ödev özeti, interaktif takvim |
| **Duyuru Sistemi** | Müdür/MY'den öğretmenlere tam ekran modal duyuru; rol bazlı hedefleme |
| **Bildirim E-postası** | Inngest cron ile günlük ödev hatırlatması (Resend) |
| **Geri Bildirim** | Öğretmen feedback formu → geliştiriciye e-posta |

---

## 🎯 Kimler İçin?

- **Öğretmenler:** Günlük akademik operasyonlar (ödev, yoklama, not) tek platformda
- **Zümre Başkanları:** Koordinasyon, müfredat takibi, zümre raporları
- **Müdür Yardımcıları:** Okul operasyonları, öğretmen takibi
- **Müdürler:** Okul geneli istatistikler ve raporlar

---

## 🛠️ Teknik Yığın

| Katman | Teknoloji |
|--------|-----------|
| Framework | Next.js 16 (App Router, Server Actions) |
| UI | React 19, Tailwind CSS v4, shadcn/ui |
| Grafikler | Recharts |
| Veritabanı | Supabase (PostgreSQL 17 + RLS) |
| Auth | Supabase SSR |
| Storage | Supabase Storage |
| Cache | Redis (Upstash) |
| Queue | Inngest v4 (Background jobs) |
| E-posta | Resend |
| Excel | SheetJS (xlsx) |
| PDF | jspdf + jspdf-autotable |
| Tarih | date-fns v4 (tr locale) |
| Test | Vitest (unit + integration + permissions, v8 coverage) |
| Loglama | Pino |
| Error Tracking | Sentry |
| Deploy | Vercel |

---

## 📅 Yol Haritası

Detaylı yol haritası için: [ROADMAP.md](./ROADMAP.md)

---

## 👥 Katkıda Bulunma

Bu proje tek geliştirici tarafından (Bahçeşehir Koleji Matematik Öğretmeni) geliştiriliyor.

- Issue açabilirsiniz
- PR gönderebilirsiniz
- Geri bildirim için: GitHub Issues

---

## 📄 Lisans

MIT License — Eğitim amaçlı kullanım serbest.

---

## 🙋 İletişim

- **Proje:** [GitHub](https://github.com/fevzicoskun/zumre-takip)
- **Canlı Uygulama:** https://myedudesk.com.tr

---

## 📋 Son Değişiklikler

### Mayıs 2026
- **Not Defteri:** Öğretmen sınıf bazlı yazılı/quiz/proje notlarını tablo şeklinde girebiliyor; inline düzenleme, sütun ortalamaları ve Excel export
- **Geri bildirim sistemi:** UI'da feedback butonu → Resend ile geliştirici e-postasına iletim
- **E-posta altyapısı:** Nodemailer → Resend geçişi; Gmail SMTP engeline karşı
- **Custom domain:** `myedudesk.com.tr` alındı, Vercel'e bağlandı, DNS yapılandırıldı
- **Bildirim sistemi:** Inngest cron ile her gün 08:00'de ödev hatırlatması; öğretmene ve veliye e-posta
- **Test altyapısı:** Vitest unit + integration + permissions; 73+ test

---

*Son güncelleme: 26 Mayıs 2026*
