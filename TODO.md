# TODO — AkademikOS (EduDesk v2)

> **AkademikOS** = Okulun Akademik İşletim Sistemi  
> **Vizyon:** "Sessiz otomasyon" — Öğretmene ekstra iş değil, değer. AI destekli öngörü. Tek veri girişi → Çoklu otomatik çıktı.

---

## 📊 PROJE ÖZETİ

| Durum | Değer |
|---|---|
| **Geliştirici** | Tek kişi (sen) |
| **Mevcut Durum** | EduDesk v1 — Zümre takip sistemi (çalışıyor) |
| **Hedef** | AkademikOS — Okulun akademik işletim sistemi |
| **Toplam Süre** | ~24 hafta (tek kişi, yarı zamanlı) |
| **İlk Kullanıcı** | Bahçeşehir Koleji — Matematik Zümresi |

---

## ✅ Tamamlananlar (EduDesk v1)

### Altyapı & Güvenlik
- [x] Next.js 16 App Router + Supabase SSR kurulumu
- [x] Multi-tenant izolasyon (`school_id` + RLS her tabloda)
- [x] 4 rol sistemi: `ogretmen`, `zumre_baskani`, `mudur_yardimcisi`, `mudur`
- [x] Enterprise RBAC — 48 izin, `withPermission` middleware
- [x] Supabase JWT + secure httpOnly cookies
- [x] HMAC-SHA256 imzalı public tokenlar (veli + yoklama yazdırma)
- [x] Token revocation tablosu + Redis fail-closed cache
- [x] Upstash Redis rate limiting (sliding window)
- [x] Per-request CSP nonce
- [x] Zod validasyon tüm server action'larda
- [x] Soft delete (5 tablo) + 30 gün restore UI
- [x] Audit log sistemi — WORM korumalı
- [x] Pino structured logging + Sentry error tracking
- [x] Defense-in-depth (explicit school_id filtreleri)
- [x] Tüm bug fix'ler (BUG-001 ... BUG-017)
- [x] Vitest test altyapısı — unit / integration / permissions projeleri, v8 coverage provider
- [x] RLS bug fix: öğretmen kendi oluşturduğu veli tokenını revoke edebilir (migration 20260524110000)
- [x] RLS policy dokümantasyonu: `revoked_tokens` policy drift migration (20260524100000)

### Özellikler (EduDesk v1)
- [x] Sınıf & öğrenci yönetimi (toplu ekleme, liste, notlar, Excel export)
- [x] Ödev takibi (durum board, notlar, toplu güncelleme)
- [x] Mobil swipe-to-delete — ödev kartları
- [x] Yoklama (günlük devam, yıllık istatistik, yazdırma linki)
- [x] Veli portalı (HMAC-korumalı salt okunur özet)
- [x] Zümre toplantıları (gündem, tutanak yazdırma, branch filtresi)
- [x] Ortak sınavlar (planlama + öğrenci bazlı not girişi)
- [x] Müfredat takibi (TYMM import, konu bazlı ilerleme)
- [x] Öğretmen dosyası (MEB belge kontrol listesi + PDF export)
- [x] Kişisel notlar (editör + Excel export)
- [x] Dark mode (sistem teması + manuel)
- [x] Raporlar modülü — öğrenci, sınıf, öğretmen raporları + Excel/PDF export
- [x] Mentor sistemi — raporlar, manuel öğrenci ekleme
- [x] Ders Programı modülü — PDF/resim yükleme, öğretmen/sınıf atama
- [x] Müdür Yardımcısı dashboard
- [x] Müdür dashboard
- [x] Öğretmen anasayfası: risk uyarıları, ödev özeti, interaktif takvim (ödev teslim tarihleri + tatiller, dark mode, gün tıklama detayı)
- [x] Duyuru sistemi: müdür/MY → öğretmen tam ekran modal duyuru, rol bazlı hedefleme
- [x] Unit testler: HomeworkService, UserService, AnnouncementService, TokenService, ClassService (70 test, tümü geçiyor)
- [x] Integration testler: HomeworkService RBAC, UserService RBAC, token RLS senaryoları
- [x] Bildirim sistemi: Inngest cron (her gün 08:00), ödev hatırlatması → öğretmen + veli e-posta
- [x] Custom domain: `myedudesk.com.tr` alındı, Vercel'e bağlandı, env var ayarlandı

---

## 🎯 FAZ PLANI — TEK GELİŞTİRİCİ OPTİMİZASYONU

> **Not:** Tek geliştirici olarak Fazları birleştir, küçük deliverable'lar ver. Haftada 10-15 saat ayırabilirsin.

---

### 🟢 FAZ 1: Teacher Experience MVP (Hafta 1-6)

> **Hedef:** Öğretmen "her gün açmak isteyeceği" sistem kur. AI risk uyarıları başlat.

#### Sprint 1-2: Teacher Dashboard + Ödev (Hafta 1-2)
```
Backend:
- [ ] TeacherDashboardService oluştur
- [ ] Risk scoring algorithm (basit heuristic, AI değil)
- [ ] teacher_activity_log tablosu
- [ ] student_risk_history tablosu

Frontend:
- [ ] Dashboard sayfası (/dashboard) — Server Component
- [ ] Gün özeti kartları (bugün, bu hafta, bu ay)
- [ ] Risk uyarıları listesi
- [ ] Sınıf detay sayfası — öğrenci performans widget'ı
- [ ] Mobil responsive (kritik)

Database:
- [ ] school_id migration (tüm tablolara ekle — mevcut veri korunacak)
- [ ] teacher_activity_log tablosu
- [ ] student_risk_history tablosu

Test:
- [ ] E2E: Öğretmen login → dashboard açılır < 2s
- [ ] E2E: Risk alert görünür
```

#### Sprint 3-4: Kazanım Takibi (Hafta 3-4)
```
Backend:
- [ ] OutcomeTrackingService
- [ ] Kazanım CRUD (TYMM kodları ile)
- [ ] Yıllık plan takibi
- [ ] Zümre üyelikleri (profiles.subject bazlı)

Frontend:
- [ ] Kazanım takip sayfası (/kazanımlar/[classId])
- [ ] TYMM dropdown (MEB müfredat kazanımları)
- [ ] Kazanım ilerleme grafiği (Recharts)
- [ ] Zümre bazlı filtreleme

Database:
- [ ] outcome_tracking tablosu (MEB TYMM kodları ile)
- [ ] yearly_plan_templates tablosu

Test:
- [ ] E2E: Öğretmen kazanım işaretleme → ilerleme güncellenir
```

#### Sprint 5-6: MY + Müdür Temel Dashboard (Hafta 5-6)
```
Backend:
- [ ] MYDashboardService
- [ ] MudurDashboardService
- [ ] Okul metrikleri (öğretmen sayısı, sınıf sayısı, riskli öğrenci %)
- [ ] Okul sağlık skoru algoritması (basit)

Frontend:
- [ ] MY Dashboard (/my/dashboard) — öğretmen listesi, müfredat durumu
- [ ] Müdür Executive Dashboard (/mudur/dashboard)
- [ ] Okul sağlık skoru gauge (Recharts)
- [ ] Riskli alanlar listesi

Test:
- [ ] MY kendi okulunun verilerini görüyor (RLS kontrol)
- [ ] Müdür okul genelini görüyor
```

**Faz 1 Çıktısı:**
- ✅ Öğretmen günlük kullanabilir
- ✅ AI risk uyarıları (basit)
- ✅ Kazanım takibi başlangıcı
- ✅ Yönetim görünümleri

---

### 🟡 FAZ 2: AI Asistan + Otomasyon (Hafta 7-12)

#### Sprint 7-8: AI Asistan Beta (Hafta 7-8)
```
Backend:
- [ ] AcademicAIService (OpenAI API entegrasyonu)
- [ ] AI risk analizi (öğrenci)
- [ ] AI sınıf analizi
- [ ] AI chat arayüzü backend

Frontend:
- [ ] AI Asistan sayfası (/asistan)
- [ ] Chat arayüzü (basit, OpenAI GPT-4)
- [ ] Risk uyarıları — AI açıklaması
- [ ] "Bugün ne yapmalıyım?" prompt

AI Prompt Engineering:
- [ ] Risk analiz prompt'u
- [ ] Sınıf analiz prompt'u
- [ ] Öneri prompt'u
- [ ] Rapor özet prompt'u

Test:
- [ ] AI yanıt kalitesi (manuel review)
- [ ] Rate limiting + maliyet kontrolü (Redis cache)
```

#### Sprint 9-10: Otomasyon + Bildirim (Hafta 9-10)
```
Backend:
- [ ] NotificationService (e-posta — Nodemailer)
- [ ] Inngest event handlers
- [ ] Cron job: Günlük dashboard özeti (her sabah 08:00)
- [ ] Cron job: Risk bildirimi (her gece 02:00)
- [ ] Quota sistemi (Redis + DB)

Frontend:
- [ ] Bildirim ayarları sayfası
- [ ] E-posta bildirim toggle
- [ ] Push notification (PWA — service worker)

Test:
- [ ] Otomatik e-postalar gerçekten gidiyor
- [ ] Quota aşımında engel
```

#### Sprint 11-12: Raporlama + MEB Entegrasyonu Hazırlığı (Hafta 11-12)
```
Backend:
- [ ] ReportService (çoklu format: PDF, Excel)
- [ ] Trend analizi (haftalık, aylık)
- [ ] Karşılaştırmalı metrikler (bu dönem vs geçen dönem)
- [ ] e-Okul API endpoint'leri (mock)
- [ ] Data mapping (TYMM uyumlu)

Frontend:
- [ ] Öğrenci raporu (detaylı — PDF export)
- [ ] Sınıf raporu (karşılaştırmalı)
- [ ] Zümre raporu
- [ ] MY raporu
- [ ] Müdür raporu

Database:
- [ ] e-okul_school_mapping tablosu (okul kodu, MEB kod)
- [ ] MEB_rapor_sablonlari tablosu

Test:
- [ ] Raporlar MEB formatına uygun
- [ ] PDF/Excel export çalışıyor
```

**Faz 2 Çıktısı:**
- ✅ AI asistan çalışıyor
- ✅ Otomatik bildirimler
- ✅ Kapsamlı raporlama
- ✅ MEB entegrasyonu hazır

---

### 🔵 FAZ 3: Gamification + Mobil + SaaS Olgunluğu (Hafta 13-18)

#### Sprint 13-14: Gamification + Engagement (Hafta 13-14)
```
Backend:
- [ ] AchievementService (rozet sistemi)
- [ ] Streak tracking (günlük kullanım)
- [ ] Haftalık/aylık özet e-postaları (Inngest)

Frontend:
- [ ] Rozet gösterimi (dashboard'da)
- [ ] Streak counter (🔥 7 gün gibi)
- [ ] "Bugün ne yapmalı?" smart suggestions
- [ ] Achievement unlock animasyonları

Test:
- [ ] Rozet kazanılıyor (demo)
- [ ] Streak artıyor
```

#### Sprint 15-16: Performans + Stabilite (Hafta 15-16)
```
Backend:
- [ ] Query optimization (PostgreSQL EXPLAIN ANALYZE)
- [ ] Redis cache warming (dashboard, raporlar)
- [ ] Database indexing (critical queries)
- [ ] Load testing (kurgusal 1000 öğrenci)

Frontend:
- [ ] Loading states (skeleton components)
- [ ] Error boundaries (React error boundary)
- [ ] Performance monitoring (Sentry + custom metrics)

Test:
- [ ] 50 öğretmen, 1000 öğrenci performans testi
- [ ] Dashboard < 2s yükleniyor
```

#### Sprint 17-18: PWA + Mobil Optimizasyon (Hafta 17-18)
```
Frontend:
- [ ] PWA kurulumu (manifest.json, service worker)
- [ ] Offline mode (localStorage + sync)
- [ ] Push notifications (web push)
- [ ] Mobil dashboard optimization (touch targets, font size)
- [ ] Install prompt ("Uygulama olarak ekle")

Backend:
- [ ] Offline data sync API
- [ ] Conflict resolution (son yazıлан wins)

Test:
- [ ] iOS Safari PWA install
- [ ] Android Chrome PWA install
- [ ] Offline mode çalışıyor
```

**Faz 3 Çıktısı:**
- ✅ Gamification aktif
- ✅ PWA mobil deneyim
- ✅ Performans optimize
- ✅ SaaS olgunluğu

---

### 🟣 FAZ 4: Billing + Scale (Hafta 19-24)

#### Sprint 19-20: Stripe Entegrasyonu (Hafta 19-20)
```
Backend:
- [ ] Stripe customer + subscription management
- [ ] Plan upgrade/downgrade flow
- [ ] Webhook handler (stripe events)
- [ ] Usage metering (API call count, storage)

Frontend:
- [ ] Pricing page (/pricing)
- [ ] Plan comparison table
- [ ] Upgrade flow (Stripe checkout)
- [ ] Billing portal link

Database:
- [ ] stripe_customers tablosu
- [ ] subscriptions tablosu

Test:
- [ ] Stripe test mode çalışıyor
- [ ] Plan değişimi quota'yı güncelliyor
```

#### Sprint 21-22: Gelişmiş AI (Hafta 21-22)
```
Backend:
- [ ] Prediction engine (öğrenci performans tahmini)
- [ ] Anomaly detection (beklenmedik düşüşler)
- [ ] Advanced recommendation system
- [ ] Model fine-tuning (kullanıcı feedback ile)

Frontend:
- [ ] AI destekli öğrenci profili
- [ ] Sınıf sağlık detaylı analizi
- [ ] Stratejik öneriler (Müdür'e)

Test:
- [ ] Tahmin doğruluğu (geçmiş veri ile validate)
- [ ] Anomaly detection çalışıyor
```

#### Sprint 23-24: Scale + Stabilize (Hafta 23-24)
```
Backend:
- [ ] Multi-region deployment (Vercel edge)
- [ ] Database connection pooling
- [ ] CDN caching (static assets)
- [ ] Security audit

Frontend:
- [ ] Accessibility audit (WCAG 2.1)
- [ ] SEO optimization
- [ ] Analytics (page views, user behavior)

Test:
- [ ] Load test: 100 eşzamanlı kullanıcı
- [ ] Security: OWASP Top 10 check
```

**Faz 4 Çıktısı:**
- ✅ Billing aktif
- ✅ AI gelişmiş
- ✅ Scale hazır
- ✅ SaaS production-ready

---

## 📋 MODÜL DETAYLARI

### Modül 1: Öğretmen Deneyimi Modülü
```
Amaç: Öğretmenin günlük akademik hayatını yönetebileceği merkezi kontrol paneli
Kullanıcılar: Tüm öğretmenler, Zümre Başkanları, MY, Müdür

Kritik Ekranlar:
- /dashboard — Ana dashboard (Gün özeti, risk uyarıları, hızlı işlemler)
- /siniflar/[id] — Sınıf detay (öğrenci listesi, performans grafikleri)
- /asistan — AI Asistan (sohbet arayüzü)

Otomasyon Fırsatları:
- Her ödev eklemede → ödev sayısı güncellenir
- Her not girişinde → öğrenci ortalaması hesaplanır
- Risk skoru > 70 → otomatik bildirim

AI Entegrasyonu:
- Risk tahminleme (öğrenci)
- Sınıf performans analizi
- "Bugün ne yapmalıyım?" önerisi

Kullanıcı Alışkanlığı:
- Her sabah "Günün özeti" → İlk açılış ekranı
- 🔥 Streak counter → Günlük kullanım motivasyonu
- AI öneri → "Bu sistem akıllı" algısı
```

### Modül 2: Kazanım Takip Sistemi
```
Amaç: MEB müfredatı kazanımlarının takibi, sınıf/öğrenci bazlı tamamlanma oranları
Kullanıcılar: Öğretmenler (kendi dersi), Zümre Başkanları (zümre raporu), MY, Müdür

Kritik Ekranlar:
- /kazanımlar/[classId] — Sınıf kazanım takibi
- /kazanımlar/rapor — Zümre raporu (TYMM uyumlu)

Database:
- outcome_tracking (kazanım kodları, durum, tarihler)
- yearly_plan_templates (MEB yıllık plan şablonları)

AI Entegrasyonu:
- Müfredat telafi önerisi ("2 hafta geridesin, şu kazanımlara öncelik ver")
- Sınıf bazlı zorluk analizi ("Çarpanlar konusu bu sınıfta zor anlaşılıyor")

MEB Uyumluluğu:
- TYMM kazanım kodları (K-9.1.3 formatı)
- Yıllık plan formatı
- Dönem sonu rapor çıktısı
```

### Modül 3: Zümre Yönetim Sistemi
```
Amaç: Zümre toplantıları, kararları, raporlarının merkezi yönetimi
Kullanıcılar: Zümre Başkanları, MY, Müdür

Kritik Ekranlar:
- /zumre — Zümre dashboard (üyeler, toplantılar, raporlar)
- /zumre/toplanti/[id] — Toplantı detay (gündem, tutanak)
- /zumre/rapor — Zümre performans raporu

Database:
- Zümre üyelikleri (profiles.subject bazlı otomatik)
- Toplantı kayıtları (mevcut zumre_meetings genişletilecek)

Otomasyon:
- Toplantı gündemi → AI tarafından oluşturulur (opsiyonel)
- Kararlar → Otomatik takvim hatırlatması
```

### Modül 4: Ortak Sınav Yönetimi
```
Amaç: Okul geneli ortak sınavların planlanması ve analizi
Kullanıcılar: Zümre Başkanları (planlama), MY (koordinasyon), Öğretmenler (not girişi)

Kritik Ekranlar:
- /sinavlar — Sınav listesi
- /sinavlar/[id] — Sınav detay (not girişi, analiz)
- /sinavlar/analiz — Karşılaştırmalı analiz (sınıflar arası)

Database:
- Mevcut common_exams tablosu genişletilecek
- Sınav analiz tabloları (ortalama, standart sapma, zor soru tespiti)

AI Entegrasyonu:
- En zor soruların tespiti
- Sınıf bazlı performans karşılaştırması
- "Öğrenci X bu konuda zorlanıyor" önerisi
```

### Modül 5: Ölçme-Değerlendirme Sistemi
```
Amaç: Tüm değerlendirmelerin (sınav, ödev, performans, davranış) merkezi takibi
Kullanıcılar: Öğretmenler (not girişi), MY, Müdür

Kritik Ekranlar:
- /notlar — Not girişi (sınav, ödev, performans)
- /ogrenciler/[id] — Öğrenci profili (tüm notlar, AI analizi)

Database:
- Tüm notlar mevcut tablolarda (homework_submissions, exam_entries)
- Öğrenci not ortalaması (calculated, cached)

AI Entegrasyonu:
- Performans tahminlemesi ("Öğrenci X finalde 65 alacak")
- Öneri ("Matematik 3 haftadır düşüyor, ek çalışma öner")
```

### Modül 6: Müdür Yardımcısı Operasyon Paneli
```
Amaç: MY'nin günlük okul operasyonlarını yönetmesi
Kullanıcılar: Müdür Yardımcıları

Kritik Ekranlar:
- /my/dashboard — MY ana dashboard (okul özeti, öğretmen performansı)
- /my/ogretmenler — Öğretmen listesi (müfredat, risk)
- /my/mufredat — Okul müfredat durumu (zümre bazlı)

Metrikler:
- Okul sağlık skoru (0-100)
- Öğretmen performansı (müfredat %, ödev verme sıklığı)
- Riskli öğrenci sayısı
- Yaklaşan toplantılar, sınavlar

AI Entegrasyonu:
- "Öğretmen X geri kaldı" uyarısı
- "Zümre Y müfredatı %20 geride" uyarısı
```

### Modül 7: Müdür Executive Dashboard
```
Amaç: Müdürün "okulu bir bakışta görmesi"
Kullanıcılar: Müdürler

Kritik Ekranlar:
- /mudur/dashboard — Executive dashboard (okul sağlık skoru, AI öneriler)
- /mudur/analizler — Detaylı analizler (karşılaştırmalı)
- /mudur/raporlar — Stratejik raporlar

Metrikler:
- Okul sağlık skoru (akademik performans %40, müfredat %30, katılım %20, memnuniyet %10)
- Karşılaştırmalı analiz (bu okul vs ilçe ortalaması, bu dönem vs geçen dönem)
- Riskli alanlar (zümre, sınıf, öğrenci)
- AI stratejik öneriler

AI Entegrasyonu:
- "Okulunuz matematikte %5 ilçe ortalamasının altında"
- "Bu ay veli toplantısı planlayın"
```

### Modül 8: AI Akademik Öneri Sistemi
```
Amaç: Tüm modüllere entegre edilmiş merkezi AI engine
Kullanıcılar: Tüm kullanıcılar (arka planda çalışır + sohbet arayüzü)

Pipeline:
1. Veri toplama (yoklama, ödev, not, müfredat)
2. AI analiz (risk scoring, pattern detection, anomaly detection)
3. Öneri üretimi (actionable, specific)
4. Çıktı (dashboard widget, bildirim, chat)

API Mimarisi:
- AcademicAIService (soyutlanmış — OpenAI/Anthropic/local LLM)
- Cache: Redis (1 saat TTL)
- Rate limiting: Upstash

Maliyet Kontrolü:
- Cache: Sık sorulan sorular cached
- Batch: Risk hesaplama batch (gece), real-time değil
- Free tier limit: 100 AI call/ay
```

### Modül 9: Otomasyon ve Bildirim Sistemi
```
Amaç: Sessiz arka plan işlemleri + bildirimler
Kullanıcılar: Tüm kullanıcılar

Otomasyonlar:
- 08:00 Her gün → "Günün özeti" e-postası
- 17:00 Her gün → Tamamlanmayan ödevler veli bildirimi
- Cuma 16:00 → Haftalık rapor e-postaları
- Pazartesi 08:00 → Yeni hafta hatırlatması
- Her gece 02:00 → Risk hesaplama batch job

Kural Motoru:
- Risk skoru > 70 → Öğretmene bildirim
- Müfredat < %80 → Zümre başkanına uyarı
- Devamsızlık > 3 gün → Veli bildirimi

Teknoloji:
- Inngest (event-driven jobs)
- Nodemailer (e-posta)
- PWA Push API (web push)
- Twilio API (SMS — gelecek)
```

### Modül 10: SaaS / Multi-Tenant Altyapısı
```
Amaç: Çoklu okul desteği, plan bazlı özellik kısıtlama, billing-ready

Mevcut Altyapı:
- school_id bazlı RLS (tamam)
- Plan sistemi (free, starter, pro, enterprise) — tablo hazır
- Quota sistemi (öğretmen, öğrenci, depolama limitleri) — tablo hazır

Plan Bazlı Özellikler:
- Free: Temel özellikler, sınırlı AI
- Starter: +Raporlar, +Otomasyon
- Pro: +AI asistan, +MEB entegrasyonu
- Enterprise: +Custom domain, +Priority support

Billing (Faz 4):
- Stripe entegrasyonu
- Plan upgrade/downgrade
- Usage-based (depolama, API call)
```

### Modül 11: Yetkilendirme ve Rol Sistemi
```
Amaç: Mevcut RBAC'ın geliştirilmesi

Mevcut:
- 4 rol: ogretmen, zumre_baskani, mudur_yardimcisi, mudur
- 48 permission sistemi

Genişletme:
- Dinamik rol atama (okul bazlı özelleştirme)
-Permission flag'leri (plan bazlı özellik açma/kapama)
- Audit log (tüm yetki değişiklikleri)

Kritik Kararlar:
- Zümre başkanı → Zümre içinde tam yetki, dışarıda okuma
- MY → Kendi okulu içinde tam yetki, başka okula yok
- Müdür → Kendi okulu içinde tam yetki
```

### Modül 12: Akademik Analitik ve Risk Motoru
```
Amaç: Real-time + batch analytics

Real-time Metrikler:
- Dashboard metrikleri (Redis cache, 5 dakika TTL)
- Risk skorları (her gece batch, 02:00)
- Müfredat ilerlemesi (her ödev/kazanım girişinde güncellenir)

Batch Analytics:
- Haftalık raporlar (Pazar gece)
- Aylık raporlar (her ayın son günü)
- Dönem raporları (dönem sonunda)

Data Warehouse (uzun vadeli):
- historical_metrics tablosu
- Trend analysis
- Predictive modeling

Açıklama: "Öğrenci X 3 haftadır düşüşte" — AI değil, basit heuristic başlangıçta
```

### Modül 13: Evrak ve Rapor Otomasyonu
```
Amaç: MEB uyumlu raporların otomatik oluşturulması

Rapor Tipleri:
- Dönem sonu karne metni
- Zümre raporu (TYMM formatı)
- MY raporu (okul geneli)
- Müdür raporu (stratejik)
- Veli bilgilendirme yazısı

Formatlar:
- PDF (jsPDF + autotable)
- Excel (xlsx)
- Word (.docx — gelecek)

Otomasyon:
- Dönem sonu → Otomatik karne metni oluşturma
- Toplantı → Otomatik tutanak (AI destekli — opsiyonel)

MEB Uyumluluğu:
- TYMM kazanım kodları
- e-Okul format çıktıları
- İmzalı rapor (gelecek — dijital imza)
```

### Modül 14: Mobil Kullanım Deneyimi
```
Amaç: Mobil-first PWA deneyimi

PWA Kurulumu:
- manifest.json (name, icons, theme_color)
- Service worker (workbox — caching strategy)
- Install prompt (beforeinstallprompt event)

Offline Mode:
- localStorage (kullanıcı ayarları, önbellek)
- IndexedDB (offline data)
- Sync on reconnect

Push Notifications:
- Service worker (push event listener)
- Web Push API (VAPID keys)
- Bildirim tıklama → İlgili sayfaya yönlendirme

Mobil Optimizasyon:
- Touch targets (min 44px)
- Font size (min 16px)
- Responsive grid (breakpoints: 640, 768, 1024, 1280)
```

### Modül 15: e-Okul / MEB Entegrasyonu
```
Amaç: MEB sistemleri ile veri senkronizasyonu (uzun vadeli)

API Endpoint'leri:
- /api/webhooks/eokul — e-Okul webhook handler
- /api/sync/attendance — Yoklama senkronizasyonu
- /api/sync/grades — Not senkronizasyonu

Data Mapping:
- TYMM kazanım kodları (K-9.1.3 ↔ MEB code)
- Okul kodu (school.code ↔ e-Okul okul no)
- Öğrenci TC → öğrenci ID mapping

Güvenlik:
- MEB API key (environment variable)
- HMAC signature doğrulama (webhook)
- Rate limiting (MEB API'ye aşırı istek engelleme)

Not: Faz 2'de hazırlık (mock API), Faz 3+ gerçek entegrasyon
```

---

## 📊 ÖNCEKLİK SIRASI (Tek Geliştirici İçin)

### 🔥 KRİTİK (MVP için şart)

```
1. Teacher Dashboard (Sprint 1)
   → "Öğretmen neden her gün açsın?" sorusunun cevabı
   → Haftalık kullanıcı retention için kritik

2. Ödev + Yoklama + Not (Sprint 1-2) [MEVCUT — güçlendir]
   → Mevcut EduDesk özelliklerini AI ile zenginleştir
   → Öğrenci risk uyarıları ekle

3. Risk Uyarıları (Sprint 2)
   → "Sessiz otomasyon" başlangıcı
   → Öğretmen "beni uyarıyor" hissini alsın

4. MY/Müdür Dashboard (Sprint 3)
   → Yönetim bağımlılığı başlangıcı
   → MY "bu raporu al" diyebilsin

5. Kazanım Takibi (Sprint 3-4)
   → MEB uyumluluğu
   → Zümre başkanı kullanabilsin
```

### 🦄 FARKI OLAN (Rakiplerden ayrışma)

```
6. AI Asistan (Sprint 7-8)
   → "Gerçekten akıllı sistem" hissi
   → KazanımCepte'de yok
   → EBA'da yok

7. Prediction Engine (Sprint 21-22)
   → "Öğrenci X gelecek ay düşecek"
   → Bu güçlü — CEO/müdür etkiler
   → Pazarlama için "AI öngörü" vurgusu

8. Gamification (Sprint 13-14)
   → Alışkanlık oluşturma
   → "Ben 7 gündür açıyorum" = Bağımlılık
   → Streak counter, rozet sistemi
```

### 📈 BÜYÜME (Faz 2-3)

```
9. Raporlama (Sprint 11-12)
   → MY ve Müdür için kapsamlı raporlar
   → MEB formatına uygun çıktılar

10. Bildirim otomasyonu (Sprint 9-10)
    → Sessiz otomasyon aktif
    → E-posta, push notification

11. MEB entegrasyonu (Sprint 11-14)
    → e-Okul API hazırlığı
    → TYMM uyumluluğu

12. Mobil PWA (Sprint 17-18)
    → Mobil deneyim
    → Push notifications

13. Billing (Sprint 19-20)
    → Satışa hazır
    → Stripe entegrasyonu
```

---

## ⚠️ TEKNİK RİSKLER

```
🔴 YÜKSEK RİSK:

1. AI Kalitesi
   Risk: AI yanlış öneri verir → Kullanıcı güveni kaybolur
   Çözüm: Beta'da sınırlı kullanım, "Bu öneri şu verilere dayanıyor" açıklaması
   Mitigation: Human-in-the-loop (öğretmen onaylar, feedback toplama)

2. Performans (Scale)
   Risk: 1000 öğrenci, 50 öğretmen → Dashboard yavaş
   Çözüm: Redis cache (5 dakika TTL), database optimization
   Mitigation: Sprint 15'te load testing

3. Veri Kalitesi
   Risk: Okullar eksik/yanlış veri girer → AI yanlış çalışır
   Çözüm: Input validation, AI "bilmiyorum" dediğinde sessiz kalma
   Mitigation: Data migration planı

🟡 ORTA RİSK:

4. MEB Entegrasyonu
   Risk: e-Okul API dokümantasyonu eksik, değişken
   Çözüm: Webhook + manual import seçeneği
   Mitigation: Faz 2'de ele al, MVP'de yok

5. AI Maliyet
   Risk: Her API çağrısı para → maliyet patlar
   Çözüm: Caching, batch processing, free tier limit
   Mitigation: Rate limiting + Redis cache

🟢 DÜŞÜK RİSK:

6. Tek Geliştirici
   Risk: İşi yetiştirememek, tükenmişlik
   Çözüm: Küçük deliverable'lar, haftalık review, mümkünse yarı zamanlı yardım
   Mitigation: Öncelik sıralaması net, MVP odaklı
```

---

## ⚠️ ÜRÜN RİSKLERİ

```
🔴 KULLANICI ADAPTASYON RİSKİ:

1. "WhatsApp daha kolay" Algısı
   Risk: Öğretmenler sisteme geçmez
   Çözüm:
   • İlk 5 dakikada değer göstermeli (dashboard açılır açılmaz fayda)
   • WhatsApp'tan daha az click gerekmeli
   • AI öneri = "bana bakıyor" hissi

2. Yönetici "kontrol" algısı
   Risk: MY "öğretmen takip sistemi" algısı → direnç
   Çözüm:
   • "Takip" değil "destek" vurgusu
   • AI öneri = "sana yardımcı oluyorum"
   • Öğretmen görünümü = öğrenci değil, öğretmen

🟡 PAZAR RİSKİ:

3. Rekabet (KazanımCepte, EBA, vb.)
   Risk: MEB kendi sistem yaparsa
   Çözüm:
   • AI + öngörü = MEB sistemlerinde yok
   • Okul özelleştirme = kurumsal çözüm
   • Veri taşınabilirliği (export) = güven

4. Fiyatlandırma
   Risk: Okul bütçesi düşük
   Çözüm:
   • Free tier (küçük okullar için, kendi zümren için kullan)
   • Değer → fiyat dönüşümü net gösterilmeli
   • "1 öğretmen maaşı / yıllık = X saat kazanım"
```

---

## 📅 ZAMAN ÇİZELGESİ

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

## 🎯 KULLANICI ADAPTASYON STRATEJİSİ

```
📱 ALIŞKANLIK OLUŞTURMA DÖNGÜSÜ:

HAFTA 1-2: KEŞİF
- Onboarding: 5 dakikada ilk ödev
- "İlk ödev ekleme" kutlaması 🎉
- Streak başlangıcı (1 gün 🔥)

HAFTA 3-4: ALIŞKANLIK
- Her gün dashboard açma hatırlatması (push)
- İlk 7 gün streak = rozet
- "Bugün ne yapmalı?" prompt'u aktif

HAFTA 5-8: BAĞIMLILIK
- AI önerileri görünür hale gelir
- Haftalık rapor e-postası 📧
- "Sınıfım nasıl gidiyor?" → Dashboard cevap veriyor

AY 3+: DEĞİŞTİRİLEMEZ
- Tüm veriler sistemde
- Excel'e dönmek = veri kaybı 💾
- "Zümre başkanı raporu istiyor" → Sistem açılıyor
```

---

## 🎯 İLK 100 OKUL STRATEJİSİ (Güncellenmiş)

```
🎯 HEDEF: İlk 100 okul = Referans müşteriler + Case study

Senin avantajın: Bahçeşehir Koleji öğretmeni = Doğrudan erişim

FAZ A: Pilot (1 Okul — Bahçeşehir, Ay 1-3)
- Kendi zümren (matematik) ile başla
- Bedelsiz veya çok düşük fiyat
- Haftalık feedback toplama
- Matematik zümresi case study oluştur

FAZ B: Beta (5-10 Okul — Ay 4-6)
- Bahçeşehir içinde yaygınlaştır (diğer zümreler)
- Yakın okullar (İstanbul Avrupa)
- Fiyat: Pro plan %50 indirim
- Self-serve onboarding

FAZ C: Launch (25-50 Okul — Ay 7-12)
- Full pricing
- Self-serve onboarding
- Case study oluşturma (3-5 reference)
- Word-of-mouth (sen = tanıdık, güvenilir)

📊 HEDEF METRİKLER:
- D99 Retention: 6 ay sonra > 80%
- NPS: > 40
- Daily Active Usage: > 60% öğretmenler her gün açıyor
- Feature Adoption: AI asistan > 40% kullanım
```

---

## 📞 SONRAKİ ADIMLAR

```
1. ✅ Bu TODO.md'yi review et
   → Fazları onayla/reddet
   → Öncelik sıralamasını kontrol et

2. 🎯 Sprint 1 başlangıç
   → Toggle to Act mode
   → "Teacher Dashboard" implementasyonu başla

3. 📅 Haftalık review
   → Her hafta sonu: Ne tamamlandı? Ne yapılacak?
   → Slack/dışarıda: Discord veya WhatsApp grubu

4. 👥 Beta kullanıcı topla
   → Bahçeşehir matematik zümresi = İlk 10 kişi
   → Onboarding sürecini test et
```

---

## 📚 KAYNAKLAR

- **Mimari Dokümanı:** `docs/saas-architecture.md` (güncellenecek)
- **DDD Analizi:** `docs/ddd-analysis.md` (güncellenecek)
- **Domain Models:** `src/domains/` (genişletilecek)
- **Agent Instructions:** `CLAUDE.md`, `AGENTS.md`

---

## ❓ AÇIK SORULAR (Karar Bekleyen)

```
❓ AI Sağlayıcı: OpenAI GPT-4 (pahalı ama kaliteli) vs Anthropic Claude (daha ucuz)
   → Öneri: OpenAI GPT-4 (kalite önce, maliyet sonra kontrol)

❓ Cloud: Vercel (hızlı başlangıç, kolay) vs AWS (güçlü ama karmaşık)
   → Öneri: Vercel (tek geliştirici için en kolay, Supabase ile uyumlu)

❓ İlk AI özellik: Basit heuristic mi, gerçek AI mı?
   → Öneri: Basit heuristic ile başla, 2. Faz'da gerçek AI ekle

❓ Veri Migrasyonu: Mevcut EduDesk verileri korunacak mı?
   → Evet: school_id migration ile mevcut veri korunacak
```

---

**Son Güncelleme:** 24 Mayıs 2026  
**Versiyon:** 2.2  
**Durum:** EduDesk v1 tamamlandı, custom domain aktif — Faz 1 Sprint 1 başlangıç bekleniyor