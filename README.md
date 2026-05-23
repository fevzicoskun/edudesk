# AkademikOS — Okulun Akademik İşletim Sistemi

> **Eski Adı:** EduDesk  
> **Vizyon:** "Sessiz otomasyon" — Öğretmene ekstra iş değil, değer. AI destekli öngörü. Tek veri girişi → Çoklu otomatik çıktı.

Türk ortaöğretim öğretmenleri için Next.js + Supabase tabanlı, production-grade okul yönetim platformu. AI destekli akademik analiz, risk tahminleme ve akıllı öneri sistemi ile okulun akademik işletim sistemi.

**Canlı:** https://zumre-takip.vercel.app

---

## 🆕 AkademikOS Nedir?

EduDesk'i bir adım öteye taşıyoruz. Artık sadece "zümre takip" değil, **okulun akademik işletim sistemi**:

### Fark Yaratan Özellikler

| Özellik | EduDesk (v1) | AkademikOS (v2) |
|---------|:------------:|:---------------:|
| Öğretmen Dashboard | ❌ Basit | ✅ AI destekli "Günün Özeti" |
| Risk Uyarıları | ❌ Yok | ✅ "Öğrenci X 3 haftadır düşüşte" |
| Kazanım Takibi | ⚠️ Temel | ✅ TYMM uyumlu, ilerleme grafikleri |
| AI Asistan | ❌ Yok | ✅ "Bugün ne yapmalıyım?" |
| Gamification | ❌ Yok | ✅ 🔥 Streak counter, rozet sistemi |
| Tahminleme | ❌ Yok | ✅ "Öğrenci X gelecek ay düşecek" |

### Sessiz Otomasyon Felsefesi

```
Öğretmen sadece:
✓ Sınıf defterine bakar → Otomatik dolmuş görür
✓ Yoklamayı işaretler → Sistem devamsızlık raporu oluşturur
✓ Notu girer → AI öğrenciyi değerlendirir
✓ Toplantı yapar → Tutanak otomatik hazır
```

---

## ✨ Özellikler

### Mevcut Özellikler (EduDesk v1)

| Modül | Açıklama |
|-------|----------|
| **Sınıf & Öğrenci** | Toplu ekleme, sınıf bazlı liste, öğrenci notları, Excel export |
| **Ödev Takibi** | Durum board, notlar, toplu güncelleme, Excel export, mobil swipe sil |
| **Yoklama** | Günlük devam takibi, yıllık devamsızlık istatistikleri, yazdırma linki |
| **Veli Portalı** | HMAC-imzalı link ile salt okunur öğrenci özeti (ödev + devamsızlık + notlar) |
| **Zümre Toplantıları** | Gündem oluşturma, tutanak yazdırma *(sadece Zümre Başkanı)* |
| **Ortak Sınavlar** | Sınav planlaması, öğrenci bazlı not girişi *(sadece Zümre Başkanı)* |
| **Müfredat Takibi** | TYMM import, konu bazlı ilerleme |
| **Raporlar** | Öğrenci/sınıf/öğretmen/mentor bazlı interaktif grafikler (Recharts) + Excel/PDF export |
| **Mentörlük** | Atanmış sınıf öğrencilerine rapor + kişisel öğrenci takip defteri (veli bilgileri dahil) |
| **Ders Programı** | MY PDF/resim yükler → öğretmenler dashboard'dan görür |
| **Müdür Y. Dashboard** | Devamsızlık özeti, öğretmen listesi, ajanda, mentör rapor özeti |
| **Müdür Dashboard** | Okul geneli istatistikler, ajanda, mentör rapor özeti |
| **Denetim Günlüğü** | Tüm işlemler kaydedilir; token iptali *(Başkan/Müdür)* |
| **Öğretmen Dosyası** | MEB belge kontrol listesi, PDF export |
| **Kişisel Notlar** | Not editörü, Excel export |
| **Dark Mode** | Sistem teması veya manuel geçiş |
| **Öğretmen Anasayfası** | Risk uyarıları, ödev özeti, interaktif takvim (ödev teslim tarihleri + resmi tatiller, dark mode) |
| **Duyuru Sistemi** | Müdür/MY'den öğretmenlere tam ekran modal duyuru; rol bazlı hedefleme |

### Geliştirilmekte Olan Özellikler (AkademikOS v2)

| Modül | Durum | Açıklama |
|-------|-------|----------|
| **Öğretmen Dashboard** | 🚧 Geliştiriliyor | AI destekli "Günün Özeti", risk uyarıları, hızlı işlemler |
| **Kazanım Takibi** | 🚧 Geliştiriliyor | TYMM uyumlu, öğrenci/sınıf bazlı tamamlanma oranları |
| **AI Asistan** | 📋 Planlandı | "Bugün ne yapmalıyım?" — OpenAI destekli akıllı öneri |
| **Risk Tahminleme** | 📋 Planlandı | ML destekli öğrenci düşüş tahmini |
| **Gamification** | 📋 Planlandı | 🔥 Streak counter, rozet sistemi, achievement'lar |
| **Otomasyon** | 📋 Planlandı | Sessiz arka plan işlemleri, otomatik raporlar |
| **PWA Mobil** | 📋 Planlandı | Offline mod, push notifications |
| **MEB Entegrasyonu** | 📋 Planlandı | e-Okul API, TYMM uyumluluğu |
| **Billing** | 📋 Planlandı | Stripe entegrasyonu, plan bazlı özellikler |

---

## 🎯 Kimler İçin?

- **Öğretmenler:** Günlük akademik operasyonlar (ödev, yoklama, not) tek platformda
- **Zümre Başkanları:** Koordinasyon, müfredat takibi, zümre raporları
- **Müdür Yardımcıları:** Okul operasyonları, öğretmen takibi
- **Müdürler:** Executive dashboard, stratejik kararlar için AI destekli analizler

### Kullanıcı Hikayeleri

```
👨‍🏫 Öğretmen Ahmet:
"Her sabah dashboard'u açıyorum → 'Bugün 3 öğrenci riskli, 2 ödev verilecek'
Sistem beni uyarıyor, ben sadece tıklıyorum. Artık WhatsApp grubu açmıyorum."

👩‍💼 MY Fatma:
"Öğretmen X müfredatı %40 tamamlamış, uyarı geldi.
Hemen toplantı ayarlıyorum. Sistem beni yönlendiriyor."

📊 Müdür Hasan:
"'Okulum nasıl gidiyor?' sorusuna artık dashboard'um cevap veriyor.
AI diyor ki: 'Matematik zümresi ilçe ortalamasının %5 altında.'
Stratejik karar: Destek planı."
```

---

## 🔥 Neden AkademikOS?

### Rakiplerden Farkımız

| Rakip | Eksik | AkademikOS Çözümü |
|-------|-------|-------------------|
| KazanımCepte | AI yok, izole veri | AI destekli analiz + öngörü |
| EBA | Öğretmen odaklı değil | "Sessiz otomasyon" felsefesi |
| WhatsApp | Kaotik, aranamaz | Düzenli, aranabilir, raporlu |
| Excel | Elle hesaplama | Otomatik, canlı veri |

### Değer Önermemiz

```
💰 Zamandan Tasarruf:
- Haftada 2-3 saat Excel/WhatsApp zamanı → 30 dakika

📊 Veri Görünürlüğü:
- "Sınıfım nasıl gidiyor?" → Bir bakışta cevap

🤖 AI Destekli:
- "Öğrenci X düşüşte" → Sistem uyarır, öğretmen önlem alır

🔗 Koordinasyon:
- Zümre + MY + Müdür aynı sistemde, aynı veriye bakıyor
```

---

## 🛠️ Teknik Yığın

| Katman | Teknoloji |
|--------|-----------|
| Framework | Next.js 16 (App Router, Server Actions) |
| UI | React 19, Tailwind CSS v4 |
| Grafikler | Recharts |
| Veritabanı | Supabase (PostgreSQL 17 + RLS) |
| Auth | Supabase SSR |
| Storage | Supabase Storage |
| Cache | Redis (Upstash) |
| Queue | Inngest v4 (Background jobs) |
| Excel | SheetJS (xlsx) |
| PDF | jspdf + jspdf-autotable |
| AI | OpenAI GPT-4 (planlı) |
| Mobil UX | PWA (planlı) |
| Tarih | date-fns v4 (tr locale) |
| Test | Vitest (unit + integration + permissions, v8 coverage) |
| Loglama | Pino |
| Error Tracking | Sentry |
| Deploy | Vercel |

---

## 📅 Yol Haritası

Detaylı yol haritası için: [ROADMAP.md](./ROADMAP.md)

### Kısa Özet

```
🟢 Faz 1 (Hafta 1-6):   Teacher Dashboard + Kazanım Takibi + MY/Müdür Panelleri
🟡 Faz 2 (Hafta 7-12):  AI Asistan + Otomasyon + Raporlama + MEB Hazırlık
🔵 Faz 3 (Hafta 13-18): Gamification + PWA + Performans
🟣 Faz 4 (Hafta 19-24): Billing + Gelişmiş AI + Scale
```

---

## 👥 Katkıda Bulunma

Bu proje tek geliştirici tarafından (Bahçeşehir Koleji Matematik Öğretmeni) geliştiriliyor.

### Açık Sorular ve Geri Bildirim

- [x] Issue açabilirsiniz
- [x] PR gönderebilirsiniz
- [x] Geri bildirim için: GitHub Issues veya LinkedIn

---

## 📄 Lisans

MIT License — Eğitim amaçlı kullanım serbest.

---

## 🙋 İletişim

- **Geliştirici:** Bahçeşehir Koleji Matematik Öğretmeni
- **Proje:** [GitHub](https://github.com/fevzicoskun/zumre-takip)
- **Canlı Uygulama:** https://zumre-takip.vercel.app

---

---

## 📋 Son Değişiklikler

### Mayıs 2026
- **Test altyapısı:** Vitest unit + integration + permissions projeleri kuruldu; HomeworkService, UserService, AnnouncementService, TokenService, ClassService için 99 unit test yazıldı
- **RLS bug fix:** Öğretmen artık kendi oluşturduğu veli tokenını devre dışı bırakabiliyor (`revoked_tokens` INSERT policy güncellendi — `issued_by = auth.uid()` koşulu eklendi)
- **Takvim iyileştirmesi:** Öğretmen anasayfasındaki CalendarWidget artık ödev teslim tarihlerini gösteriyor; güne tıklanınca ödev/tatil detayı açılıyor; dark mode ve kompakt tasarım eklendi
- **Duyuru sistemi:** Müdür ve MY'den öğretmenlere rol bazlı tam ekran modal duyuru gönderimi

---

*Son güncelleme: 23 Mayıs 2026 — Test coverage ve dashboard iyileştirmeleri* 🚀