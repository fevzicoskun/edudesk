# EduDesk

Türk ilk/ortaöğretim okulları için öğretmen yönetim uygulaması. Ödev takibi ve yoklama odaklı, veli iletişimi entegre.

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
| Test | Vitest (unit + integration) |
| Deploy | Vercel (her push'ta otomatik) |

---

## Mimari

```
app/actions/          ← server actions (validate → service → revalidatePath)
app/(dashboard)/      ← sayfalar (server component ağırlıklı)
src/
  domains/            ← iş mantığı (homework, classes, users, notifications…)
    */repositories/   ← ham Supabase sorguları
    */services/       ← RBAC kontrolü + orchestration
    */actions/        ← re-export
  shared/             ← auth, permissions, types, validation, date
  infrastructure/     ← supabase client, inngest, security
components/
  ui/                 ← badge, button, card, …
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

### Ödev Takibi (çekirdek)
- Oluşturma: çoklu sınıfa tek seferde ödev atama, şablonlar, kopyalama
- Durum girişi: yapıldı / eksik / yapılmadı / geç / mazeretli (per-öğrenci, anlık güncelleme)
- Toplu güncelleme, öğrenci notu, Excel export
- Urgency badge: "Bugün!" / "Yarın" / "X gün" / "Aktif" / "Geçmiş"
- Bekleyen kontroller: son tarihi geçmiş, henüz giriş yapılmamış ödevler
- **Sınıf matrisi** — `/odevler/sinif/[classId]`: tüm öğrenciler × tüm ödevler matris görünümü, tamamlanma % satır ve sütun bazlı
- Öğrenci ödev sicili modali: dönem geçmişi, istatistikler, veli WhatsApp

### Yoklama
- Sınıf bazlı devamsızlık takibi
- Yıl içi devamsızlık sayacı (öğrenci badge)

### Yönetim & RBAC
- Müdür genel bakış: yoklama, ödev girişi, öğretmen aktivitesi
- Risk uyarıları: devamsızlık + ödev kayıp eşiği
- Enterprise RBAC, okul bazlı izolasyon (RLS)

### Destek
- Veli bildirimi: WhatsApp (manuel + Inngest otomatik), Resend e-posta
- Kaynak/kitap takibi (ayarlar)
- Profil, kullanıcı yönetimi

---

## Geliştirme

```bash
npm run dev           # localhost:3000
npm run test:unit     # hızlı unit testler
npm run test          # tüm testler (325)
npx tsc --noEmit      # tip kontrolü
```

`.env.local` gerekli — Supabase, Inngest, Resend değişkenleri.

**Not:** `middleware.ts` değil `proxy.ts` — bu projeye özgü Next.js 16 farkı.
