# EduDesk

Türk ilk/ortaöğretim okulları için öğretmen yönetim uygulaması. Ödev takibi, yoklama, not defteri ve veli iletişimini tek ekranda toplar.

**Canlı:** [myedudesk.com.tr](https://myedudesk.com.tr)

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
| Test | Vitest (unit + integration), Playwright (E2E) |
| Deploy | Vercel (her push'ta otomatik) |

---

## Mimari

```
app/actions/          ← server actions (validate → service → revalidatePath)
app/(dashboard)/      ← sayfalar (server component ağırlıklı)
src/
  domains/            ← iş mantığı (homework, classes, grades, users, …)
    */repositories/   ← ham Supabase sorguları
    */services/       ← RBAC kontrolü + orchestration
    */actions/        ← re-export
  shared/             ← auth, permissions, types, validation, date
  infrastructure/     ← supabase client, inngest, security
components/
  ui/                 ← badge, button, card, tooltip, …
  layout/             ← Sidebar, MobileNavDrawer
```

Veri akışı: `Server Component → Supabase (read)` ve `Form/Button → Server Action → Service → Repository → revalidatePath`.

Multi-tenant: her tablo `school_id` taşır, Supabase RLS tüm sorguları okul kapsamına kilitler.

---

## Roller

`ogretmen` → `zumre_baskani` → `mudur_yardimcisi` → `mudur` → `admin`

Her rol üstündeki rolün tüm izinlerini miras alır. İzinler `P.RESOURCE.ACTION` sabitleriyle tanımlanır.

---

## Tamamlanan Özellikler

### Çekirdek
- **Ödev takibi** — oluşturma/düzenleme/silme, durum girişi (yapıldı/eksik/yapılmadı/geç/mazeretli), toplu güncelleme, not, Excel export, şablonlar, kopyalama
- **Öğrenci ödev sicili** — modal: dönem ödev geçmişi, istatistikler, veli WhatsApp linki
- **Yoklama** — sınıf bazlı devamsızlık takibi, yıl içi sayaç badge
- **Not defteri** — yazılı/quiz/proje sütunları, Kanaat sekmesi (otomatik hesap + düzenlenebilir metin)
- **Veli bildirimi** — WhatsApp, e-posta (Resend), Inngest otomatik cron (son tarih sonrası)

### Yönetim
- **Müdür okul genel bakış** — yoklama, ödev girişi, öğretmen aktivitesi
- **Risk uyarıları** — devamsızlık + ödev kayıp eşiğine göre öğrenci uyarıları
- **RBAC** — enterprise rol/izin sistemi, okul bazlı izolasyon

### Destek özellikleri (aktif ama çekirdeğe dahil değil)
- Zümre toplantıları, ortak sınavlar, müfredat takibi (TYMM), öğretmen dosyası
- Kaynak/kitap takibi
- Analitik widget'lar (yoklama trendi, ödev tamamlanma, sınav ortalaması)

---

## Geliştirme

```bash
npm run dev           # localhost:3000
npm run test:unit     # hızlı unit testler
npm run test          # tüm testler
npx tsc --noEmit      # tip kontrolü
```

`.env.local` gerekli — Supabase, Inngest, Resend, Upstash Redis değişkenleri.

**Not:** `middleware.ts` değil `proxy.ts` — bu projeye özgü Next.js 16 farkı.
