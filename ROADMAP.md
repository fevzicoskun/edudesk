# AkademikOS Yol Haritası

> **Güncelleme:** 24 Mayıs 2026  
> **Versiyon:** 2.1  
> **Durum:** EduDesk v1 tamamlandı — domain aktif, Faz 1 Sprint 1 başlangıç bekleniyor

---

## 🎯 Genel Bakış

| Parametre | Değer |
|-----------|-------|
| **Toplam Süre** | 24 hafta (6 ay, yarı zamanlı) |
| **Geliştirici** | Tek kişi (sen) |
| **İlk Kullanıcı** | Bahçeşehir Koleji — Matematik Zümresi |
| **Hedef** | İlk 100 okul (referans müşteriler) |

### Faz Özeti

```
🟢 FAZ 1 (Hafta 1-6):  Teacher Experience MVP
🟡 FAZ 2 (Hafta 7-12): AI Asistan + Otomasyon
🔵 FAZ 3 (Hafta 13-18): Gamification + Mobil + SaaS Olgunluğu
🟣 FAZ 4 (Hafta 19-24): Billing + Scale
```

---

## 🟢 FAZ 1: Teacher Experience MVP

**Hedef:** Öğretmen "her gün açmak isteyeceği" sistem kur. AI risk uyarıları başlat.

**Süre:** Hafta 1-6  
**Çıktı:** Öğretmen günlük kullanabilir, AI risk uyarıları aktif

### Sprint 1: Teacher Dashboard + Ödev (Hafta 1-2)

#### Backend
- [ ] TeacherDashboardService oluştur
- [ ] Risk scoring algorithm (basit heuristic, AI değil)
- [ ] `teacher_activity_log` tablosu
- [ ] `student_risk_history` tablosu

#### Frontend
- [ ] Dashboard sayfası (`/dashboard`) — Server Component
- [ ] Gün özeti kartları (bugün, bu hafta, bu ay)
- [ ] Risk uyarıları listesi
- [ ] Sınıf detay sayfası — öğrenci performans widget'ı
- [ ] Mobil responsive (kritik)

#### Database
- [ ] `school_id` migration (tüm tablolara ekle)
- [ ] `teacher_activity_log` tablosu
- [ ] `student_risk_history` tablosu

#### Test
- [ ] E2E: Öğretmen login → dashboard açılır < 2s
- [ ] E2E: Risk alert görünür

---

### Sprint 2: Kazanım Takibi (Hafta 3-4)

#### Backend
- [ ] OutcomeTrackingService
- [ ] Kazanım CRUD (TYMM kodları ile)
- [ ] Yıllık plan takibi
- [ ] Zümre üyelikleri (profiles.subject bazlı)

#### Frontend
- [ ] Kazanım takip sayfası (`/kazanımlar/[classId]`)
- [ ] TYMM dropdown (MEB müfredat kazanımları)
- [ ] Kazanım ilerleme grafiği (Recharts)
- [ ] Zümre bazlı filtreleme

#### Database
- [ ] `outcome_tracking` tablosu (MEB TYMM kodları ile)
- [ ] `yearly_plan_templates` tablosu

#### Test
- [ ] E2E: Öğretmen kazanım işaretleme → ilerleme güncellenir

---

### Sprint 3: MY + Müdür Temel Dashboard (Hafta 5-6)

#### Backend
- [ ] MYDashboardService
- [ ] MudurDashboardService
- [ ] Okul metrikleri (öğretmen sayısı, sınıf sayısı, riskli öğrenci %)
- [ ] Okul sağlık skoru algoritması (basit)

#### Frontend
- [ ] MY Dashboard (`/my/dashboard`) — öğretmen listesi, müfredat durumu
- [ ] Müdür Executive Dashboard (`/mudur/dashboard`)
- [ ] Okul sağlık skoru gauge (Recharts)
- [ ] Riskli alanlar listesi

#### Test
- [ ] MY kendi okulunun verilerini görüyor (RLS kontrol)
- [ ] Müdür okul genelini görüyor

---

### Faz 1 Çıktıları

```
✅ Öğretmen günlük kullanabilir
✅ AI risk uyarıları (basit heuristic)
✅ Kazanım takibi başlangıcı
✅ Yönetim görünümleri (MY + Müdür)
✅ school_id migration tamamlandı
```

---

## 🟡 FAZ 2: AI Asistan + Otomasyon

**Hedef:** Gerçek AI destekli öneri sistemi + sessiz otomasyon

**Süre:** Hafta 7-12  
**Çıktı:** AI asistan çalışıyor, otomatik bildirimler aktif

### Sprint 4: AI Asistan Beta (Hafta 7-8)

#### Backend
- [ ] AcademicAIService (OpenAI API entegrasyonu)
- [ ] AI risk analizi (öğrenci)
- [ ] AI sınıf analizi
- [ ] AI chat arayüzü backend

#### Frontend
- [ ] AI Asistan sayfası (`/asistan`)
- [ ] Chat arayüzü (basit, OpenAI GPT-4)
- [ ] Risk uyarıları — AI açıklaması
- [ ] "Bugün ne yapmalıyım?" prompt

#### AI Prompt Engineering
- [ ] Risk analiz prompt'u
- [ ] Sınıf analiz prompt'u
- [ ] Öneri prompt'u
- [ ] Rapor özet prompt'u

#### Test
- [ ] AI yanıt kalitesi (manuel review)
- [ ] Rate limiting + maliyet kontrolü (Redis cache)

---

### Sprint 5: Otomasyon + Bildirim (Hafta 9-10)

#### Backend
- [ ] NotificationService (e-posta — Nodemailer)
- [ ] Inngest event handlers
- [ ] Cron job: Günlük dashboard özeti (her sabah 08:00)
- [ ] Cron job: Risk bildirimi (her gece 02:00)
- [ ] Quota sistemi (Redis + DB)

#### Frontend
- [ ] Bildirim ayarları sayfası
- [ ] E-posta bildirim toggle
- [ ] Push notification (PWA — service worker)

#### Test
- [ ] Otomatik e-postalar gerçekten gidiyor
- [ ] Quota aşımında engel

---

### Sprint 6: Raporlama + MEB Entegrasyonu Hazırlığı (Hafta 11-12)

#### Backend
- [ ] ReportService (çoklu format: PDF, Excel)
- [ ] Trend analizi (haftalık, aylık)
- [ ] Karşılaştırmalı metrikler (bu dönem vs geçen dönem)
- [ ] e-Okul API endpoint'leri (mock)
- [ ] Data mapping (TYMM uyumlu)

#### Frontend
- [ ] Öğrenci raporu (detaylı — PDF export)
- [ ] Sınıf raporu (karşılaştırmalı)
- [ ] Zümre raporu
- [ ] MY raporu
- [ ] Müdür raporu

#### Database
- [ ] `e-okul_school_mapping` tablosu (okul kodu, MEB kod)
- [ ] `MEB_rapor_sablonlari` tablosu

#### Test
- [ ] Raporlar MEB formatına uygun
- [ ] PDF/Excel export çalışıyor

---

### Faz 2 Çıktıları

```
✅ AI asistan çalışıyor (OpenAI GPT-4)
✅ Otomatik bildirimler (e-posta + push)
✅ Kapsamlı raporlama (PDF + Excel)
✅ MEB entegrasyonu hazır (mock API)
✅ TYMM uyumluluğu
```

---

## 🔵 FAZ 3: Gamification + Mobil + SaaS Olgunluğu

**Hedef:** Kullanıcı bağımlılığı + mobil deneyim + performans

**Süre:** Hafta 13-18  
**Çıktı:** Gamification aktif, PWA mobil deneyim, performans optimize

### Sprint 7: Gamification + Engagement (Hafta 13-14)

#### Backend
- [ ] AchievementService (rozet sistemi)
- [ ] Streak tracking (günlük kullanım)
- [ ] Haftalık/aylık özet e-postaları (Inngest)

#### Frontend
- [ ] Rozet gösterimi (dashboard'da)
- [ ] Streak counter (🔥 7 gün gibi)
- [ ] "Bugün ne yapmalı?" smart suggestions
- [ ] Achievement unlock animasyonları

#### Test
- [ ] Rozet kazanılıyor (demo)
- [ ] Streak artıyor

---

### Sprint 8: Performans + Stabilite (Hafta 15-16)

#### Backend
- [ ] Query optimization (PostgreSQL EXPLAIN ANALYZE)
- [ ] Redis cache warming (dashboard, raporlar)
- [ ] Database indexing (critical queries)
- [ ] Load testing (kurgusal 1000 öğrenci)

#### Frontend
- [ ] Loading states (skeleton components)
- [ ] Error boundaries (React error boundary)
- [ ] Performance monitoring (Sentry + custom metrics)

#### Test
- [ ] 50 öğretmen, 1000 öğrenci performans testi
- [ ] Dashboard < 2s yükleniyor

---

### Sprint 9: PWA + Mobil Optimizasyon (Hafta 17-18)

#### Frontend
- [ ] PWA kurulumu (manifest.json, service worker)
- [ ] Offline mode (localStorage + sync)
- [ ] Push notifications (web push)
- [ ] Mobil dashboard optimization (touch targets, font size)
- [ ] Install prompt ("Uygulama olarak ekle")

#### Backend
- [ ] Offline data sync API
- [ ] Conflict resolution (son yazılan wins)

#### Test
- [ ] iOS Safari PWA install
- [ ] Android Chrome PWA install
- [ ] Offline mode çalışıyor

---

### Faz 3 Çıktıları

```
✅ Gamification aktif (streak + rozetler)
✅ PWA mobil deneyim (offline + push)
✅ Performans optimize (< 2s dashboard)
✅ SaaS olgunluğu
✅ 50 öğretmen + 1000 öğrenci scale testi geçti
```

---

## 🟣 FAZ 4: Billing + Scale

**Hedef:** Revenue ready + gelişmiş AI + production-ready

**Süre:** Hafta 19-24  
**Çıktı:** Billing aktif, AI gelişmiş, scale hazır

### Sprint 10: Stripe Entegrasyonu (Hafta 19-20)

#### Backend
- [ ] Stripe customer + subscription management
- [ ] Plan upgrade/downgrade flow
- [ ] Webhook handler (stripe events)
- [ ] Usage metering (API call count, storage)

#### Frontend
- [ ] Pricing page (`/pricing`)
- [ ] Plan comparison table
- [ ] Upgrade flow (Stripe checkout)
- [ ] Billing portal link

#### Database
- [ ] `stripe_customers` tablosu
- [ ] `subscriptions` tablosu

#### Test
- [ ] Stripe test mode çalışıyor
- [ ] Plan değişimi quota'yı güncelliyor

---

### Sprint 11: Gelişmiş AI (Hafta 21-22)

#### Backend
- [ ] Prediction engine (öğrenci performans tahmini)
- [ ] Anomaly detection (beklenmedik düşüşler)
- [ ] Advanced recommendation system
- [ ] Model fine-tuning (kullanıcı feedback ile)

#### Frontend
- [ ] AI destekli öğrenci profili
- [ ] Sınıf sağlık detaylı analizi
- [ ] Stratejik öneriler (Müdür'e)

#### Test
- [ ] Tahmin doğruluğu (geçmiş veri ile validate)
- [ ] Anomaly detection çalışıyor

---

### Sprint 12: Scale + Stabilize (Hafta 23-24)

#### Backend
- [ ] Multi-region deployment (Vercel edge)
- [ ] Database connection pooling
- [ ] CDN caching (static assets)
- [ ] Security audit

#### Frontend
- [ ] Accessibility audit (WCAG 2.1)
- [ ] SEO optimization
- [ ] Analytics (page views, user behavior)

#### Test
- [ ] Load test: 100 eşzamanlı kullanıcı
- [ ] Security: OWASP Top 10 check

---

### Faz 4 Çıktıları

```
✅ Billing aktif (Stripe)
✅ AI gelişmiş (prediction + anomaly detection)
✅ Scale hazır (multi-region)
✅ SaaS production-ready
✅ Security audit geçti
```

---

## 📅 Detaylı Zaman Çizelgesi

```
Hafta 1-2:   Sprint 1 — Teacher Dashboard + Ödev + Mobil
Hafta 3-4:   Sprint 2 — Kazanım Takibi + Risk Uyarıları
Hafta 5-6:   Sprint 3 — MY + Müdür Dashboard (temel)

Hafta 7-8:   Sprint 4 — AI Asistan Beta
Hafta 9-10:  Sprint 5 — Otomasyon + Bildirim
Hafta 11-12: Sprint 6 — Raporlama + MEB Hazırlık

Hafta 13-14: Sprint 7 — Gamification + Engagement
Hafta 15-16: Sprint 8 — Performans + Stabilite
Hafta 17-18: Sprint 9 — PWA + Mobil

Hafta 19-20: Sprint 10 — Stripe Billing
Hafta 21-22: Sprint 11 — Gelişmiş AI
Hafta 23-24: Sprint 12 — Scale + Stabilize

Toplam: 24 hafta (6 ay) — Yarı zamanlı çalışma
```

**Gerçekçi Beklenti:**
- Yarı zamanlı (hafta 10-15 saat) = 6 ay
- Tam zamanlı = 3 ay
- İlk pilot okul (Bahçeşehir) için: Hafta 6'da MVP hazır

---

## 🎯 İlk 100 Okul Stratejisi

### Faz A: Pilot (1 Okul — Bahçeşehir, Ay 1-3)
- [ ] Kendi zümren (matematik) ile başla
- [ ] Bedelsiz veya çok düşük fiyat
- [ ] Haftalık feedback toplama
- [ ] Matematik zümresi case study oluştur

### Faz B: Beta (5-10 Okul — Ay 4-6)
- [ ] Bahçeşehir içinde yaygınlaştır (diğer zümreler)
- [ ] Yakın okullar (İstanbul Avrupa)
- [ ] Fiyat: Pro plan %50 indirim
- [ ] Self-serve onboarding

### Faz C: Launch (25-50 Okul — Ay 7-12)
- [ ] Full pricing
- [ ] Self-serve onboarding
- [ ] Case study oluşturma (3-5 reference)
- [ ] Word-of-mouth (sen = tanıdık, güvenilir)

### Hedef Metrikleri

| Metrik | Hedef |
|--------|-------|
| D99 Retention | > 80% (6 ay sonra) |
| NPS | > 40 |
| Daily Active Usage | > 60% öğretmenler her gün açıyor |
| Feature Adoption | AI asistan > 40% kullanım |

---

## ⚠️ Riskler

### Teknik Riskler

| Risk | Seviye | Çözüm |
|------|--------|-------|
| AI Kalitesi | 🔴 Yüksek | Beta'da sınırlı, human-in-the-loop |
| Performans (Scale) | 🔴 Yüksek | Redis cache, database optimization |
| Veri Kalitesi | 🔴 Yüksek | Input validation, AI "bilmiyorum" |
| MEB Entegrasyonu | 🟡 Orta | Webhook + manual import |
| AI Maliyet | 🟡 Orta | Caching, batch processing, free tier limit |
| Tek Geliştirici | 🟢 Düşük | Küçük deliverable'lar, haftalık review |

### Ürün Riskleri

| Risk | Seviye | Çözüm |
|------|--------|-------|
| "WhatsApp daha kolay" | 🔴 Yüksek | İlk 5 dakikada değer, < WhatsApp click |
| Yönetici "kontrol" algısı | 🔴 Yüksek | "Takip" değil "destek" vurgusu |
| Rekabet (MEB sistemleri) | 🟡 Orta | AI + öngörü = MEB'de yok |
| Fiyatlandırma | 🟡 Orta | Free tier, değer-fiyat dönüşümü |

---

## 🏆 Başarı Kriterleri

### MVP Başarı (Hafta 6)
```
✅ En az 1 öğretmen her gün açıyor (> 7 gün streak)
✅ Risk uyarısı en az 1 kez çalıştı
✅ MY dashboard kullanıldı
✅ Öğretmen: "WhatsApp'tan kolay" dedi
```

### Product-Market Fit (Ay 6)
```
✅ 10 okul aktif (> 3 ay)
✅ D99 Retention > 70%
✅ NPS > 30
✅ AI asistan > 20% kullanım
```

### Growth (Ay 12)
```
✅ 100 okul (referans müşteriler)
✅ D99 Retention > 80%
✅ NPS > 40
✅ Revenue > $5K/ay
```

---

## 📞 Sonraki Adımlar

### Tamamlanan Altyapı (Mayıs 2026)

- [x] Vitest test altyapısı (unit / integration / permissions, 70 test)
- [x] RLS güvenlik fix: öğretmen kendi veli tokenını devre dışı bırakabiliyor
- [x] Öğretmen anasayfası takvim iyileştirmesi (ödev tarihleri, dark mode)
- [x] Duyuru sistemi (müdür/MY → öğretmen)
- [x] Bildirim sistemi: Inngest cron, öğretmen + veli e-posta hatırlatması
- [x] Custom domain: `myedudesk.com.tr` canlıda

### Hemen Yapılacaklar (Bu Hafta)
1. [x] Planı onayla
2. [ ] Sprint 1 başlangıç
3. [ ] İlk 5 öğretmeni davet et (Bahçeşehir matematik)
4. [ ] Onboarding sürecini test et

### Yakın Gelecek (Ay 1-3)
- [ ] İlk 10 öğretmen feedback topla
- [ ] Case study oluştur
- [ ] Bahçeşehir içinde yaygınlaştır
- [ ] Diğer zümrelere geçiş

### Orta Vade (Ay 4-12)
- [ ] Yeni okullara onboarding
- [ ] Fiyatlandırma testleri
- [ ] AI kalitesini iyileştir
- [ ] MEB entegrasyonu başlat

---

## 📚 Kaynaklar

- **Mimari Dokümanı:** `docs/saas-architecture.md`
- **DDD Analizi:** `docs/ddd-analysis.md`
- **Domain Models:** `src/domains/`
- **Detaylı Plan:** `TODO.md`
- **Agent Instructions:** `CLAUDE.md`, `AGENTS.md`

---

*Son güncelleme: 24 Mayıs 2026 — EduDesk v1 tamamlandı, myedudesk.com.tr canlıda* 🚀