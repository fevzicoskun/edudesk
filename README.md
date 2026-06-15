# EduDesk

Türk ilk/ortaöğretim okulları için öğretmen yönetim platformu. Ödev takibi, yoklama ve veli iletişimi entegre; MEB yönetmeliğine uygun.

**Canlı:** [myedudesk.com.tr](https://myedudesk.com.tr) — Vercel, her push'ta otomatik deploy

---

## Stack

| Katman | Teknoloji |
|--------|-----------|
| Framework | Next.js 16 App Router (webpack) |
| UI | React 19, Tailwind v4 |
| Veritabanı | Supabase (PostgreSQL + RLS) |
| Auth | Supabase SSR + PKCE |
| E-posta | Resend |
| Arka plan işler | Inngest |
| Test | Vitest (610 unit) + Playwright (8 E2E spec) |
| Deploy | Vercel |

---

## Mimari

```
app/actions/          ← server actions (validate → service → revalidatePath)
app/(dashboard)/      ← sayfalar (server component ağırlıklı)
src/
  domains/            ← iş mantığı (homework, classes, attendance, users, notifications…)
    */repositories/   ← ham Supabase sorguları
    */services/       ← RBAC kontrolü + orchestration
  shared/             ← auth, permissions, types, validation, date
  infrastructure/     ← supabase client, inngest, security, observability
components/
  ui/                 ← badge, button, card, tooltip…
  layout/             ← Sidebar, MobileNavDrawer
```

Veri akışı: `Server Component → Supabase (read)` ve `Form/Button → Server Action → Service → Repository → revalidatePath`.

Multi-tenant: her tablo `school_id` taşır, Supabase RLS tüm sorguları okul kapsamına kilitler.

---

## Roller

`ogretmen` → `zumre_baskani` → `mudur_yardimcisi` → `mudur` → `admin`

Her rol üstündeki rolün tüm izinlerini miras alır. İzinler `P.RESOURCE.ACTION` sabitleriyle tanımlanır.

---

## Özellikler

### Ödev Takibi
- Oluşturma: çoklu sınıfa tek seferde ödev atama, şablonlar, kopyalama
- Durum girişi: yapıldı / eksik / yapılmadı / geç / mazeretli (per-öğrenci, anlık güncelleme)
- Toplu güncelleme, öğrenci notu, Excel export
- Urgency badge: "Bugün!" / "Yarın" / "X gün" / "Aktif" / "Geçmiş"
- Bekleyen kontroller: son tarihi geçmiş, henüz giriş yapılmamış ödevler
- **Sınıf matrisi** — `/odevler/sinif/[classId]`: tüm öğrenciler × tüm ödevler matris görünümü, tamamlanma % satır ve sütun bazlı
- Öğrenci ödev sicili modali: dönem geçmişi, istatistikler, veli WhatsApp

### Yoklama
- Günlük yoklama girişi: mevcut / devamsız / geç / özürlü (4 durum toggle)
- Toplu işlemler: "Hepsini Mevcut / Devamsız / Özürlü" butonları
- Yıl içi devamsızlık sayacı: öğrenci başlığında badge (özürsüz/özürlü ayrı)
- MEB uyarı sistemi: 15 günde amber, 20 günde kırmızı vurgu
- Hafta sonu ve geçmiş tarih uyarı banner'ları
- Kaydedilmemiş değişiklik koruması (beforeunload)
- **Aylık çizelge** — `/yoklama/cizelge`: grid tablo, gün adları (Pzt/Sal…), bugün vurgusu
- Çizelgede yıllık eşik renklendirme + sınıf özet bar (kaç öğrenci risk bölgesinde)
- Öğrenciye tıklayınca devamsızlık geçmişi modali
- Excel export: detay + özet iki sayfa
- Inngest cron: eksik yoklama hatırlatıcısı (10:00 Istanbul, Pzt–Cum)
- Otomatik veli bildirimi: devamsız/geç öğrenci velisine e-posta (Inngest, 45 dk gecikme)

### Yönetim & RBAC
- Müdür genel bakış: bugün yoklama durumu, ödev girişi, öğretmen aktivitesi
- Risk uyarıları: devamsızlık + ödev kayıp eşiği, en iyi/kötü sınıf
- Enterprise RBAC, okul bazlı izolasyon (Supabase RLS)
- **Platform admin paneli** — `/platform`: yeni okul ekleme, müdür atama, okul durumu toggle (active/suspended/trial), tenant metrikleri

### Veli İletişimi
- Otomatik yoklama e-postası: devamsız/geç günler (Inngest)
- Ödev hatırlatıcısı: veliye + öğretmene e-posta (teslim tarihinden N gün önce, Inngest)
- Aylık bülten: müdüre devamsızlık + ödev özeti (Inngest)
- Manuel WhatsApp linki (öğrenci profili)
- Veli abonelik yönetimi (opt-out URL)

### Altyapı
- Structured logging (Pino)
- Export jobs: Excel export kuyruklu, progress takip
- Web Push bildirimleri (Inngest, SW)
- Audit log
- Zod env validation

---

## Geliştirme

```bash
npm run dev           # localhost:3000
npm run test:unit     # hızlı unit testler (610 test)
npm run test          # tüm testler
npx vitest run tests/vitest/unit/path/to/file.test.ts  # tek dosya
npx tsc --noEmit      # tip kontrolü
```

`.env.local` gerekli — Supabase, Inngest, Resend anahtarları.

**Not:** `middleware.ts` değil `proxy.ts` — bu projeye özgü Next.js 16 farkı.

---

## Kalite (2026-06-10)

| TypeScript | Mimari | Hata Yönetimi | Test | Performans | Güvenlik | **Ortalama** |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 9.0 | 8.5 | 9.5 | 9.0 | 9.0 | 9.5 | **9.1 / 10** |

Detaylar: `docs/quality-rubric.md`
