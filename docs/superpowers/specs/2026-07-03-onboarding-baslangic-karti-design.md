# Başlangıç Kartı — Rol-Bazlı Kurulum Yönlendirmesi

**Tarih:** 2026-07-03
**Durum:** Tasarım onaylandı

## Problem

Hesap açma katmanı çalışıyor (`/onboarding`: müdür okul kurar + davet kodu
üretilir; öğretmen kodla katılır) ama **dashboard'a ilk düşüş boş**: yeni müdür
"şimdi ne yapacağım?" sorusuyla baş başa kalıyor, davet kodunun `/ayarlar`'da
olduğunu keşfetmek zorunda. Yeni öğretmen için de kurulum yüzeyi dağınık:
sınıf seçimi `/siniflar`'da, program `/ders-programi`'nde, günlük iş
`/yoklama`'da. Rol-bazlı boş-durum mesajları var ama sayfa-yerel; uçtan uca
"sırada ne var" anlatısı yok.

## Çözüm

Anasayfaya **veriden-türetilen, rol-bazlı Başlangıç kartı**. Kart yapılmamış
kurulum adımlarını ✓/○ listesi olarak gösterir, her adım ilgili sayfaya
`Link`'tir. Durum %100 DB'deki gerçek veriden türetilir — **yeni tablo yok,
migration yok, localStorage yok**. Adımlar bittiğinde kart kendiliğinden
kaybolur.

Bu, **A seçeneği** (kurulum kartı). B (zorunlu sihirbaz) ve C (tooltip turu)
bilinçli olarak reddedildi: sihirbaz kullanıcıyı hapseder ve durum tablosu
gerektirir; tur gösterir ama iş bitirtmez.

## Görünürlük kuralı (iki kapı)

1. **Profil ilk 30 gün içinde** (`profiles.created_at`) — eski kullanıcıya
   sonsuz dırdır yok; kapı kapalıysa durum sorguları hiç koşmaz (created_at
   zaten yüklü profilde).
2. **En az bir adım eksik** — tümü ✓ ise kart render edilmez.

30 gün kuralı `school`'a değil `profile`'a bağlıdır: okul yılı ortasında
katılan öğretmen de karttan faydalanır.

## Adımlar ve ✓ koşulları

### Müdür (tek adım, zengin kart)

- Başlık: "Okulunuz hazır — şimdi ekibinizi davet edin"
- İçerik: okul kodu (`schools.slug`) büyük puntoyla + **Kopyala** butonu +
  **WhatsApp ile paylaş** (`wa.me/?text=...` hazır mesaj: kod + kayıt URL'i)
- ✓ koşulu: okulda müdür dışında ≥1 üye (`profiles` count,
  `school_id` eq + `role neq 'mudur'`) → kart kaybolur

### Öğretmen / öğretmen-benzeri roller (4 adım)

| Adım | ✓ koşulu (count > 0) | Link |
|---|---|---|
| Sınıfların atandı | `teacher_classes.teacher_id = user` | `/siniflar` |
| Ders programını gir | `lesson_schedules.teacher_id = user` | `/ders-programi` |
| İlk yoklamanı al | `attendance.teacher_id = user` | `/yoklama` |
| İlk ödevini ver | `homeworks.teacher_id = user` | `/odevler/yeni` |

Adımlar sıralı **görünür** ama zorlamasız — kullanıcı istediğine tıklar.

**Plan-aşaması düzeltmesi:** öğretmen self-servis sınıf seçemez
(`teacher_classes` insert'i yalnız yönetici atama matrisinde). 0 sınıflı
öğretmen zaten `BeklemeWidget` görür (dashboard render edilmez) → 1. adım
kart göründüğünde daima ✓; ilerleme hissi için listede tutulur.

### Rol eşlemesi

- `mudur` → müdür kartı (mevcut `KurulumWidget`'ın yerine; davet ✓ olduysa
  ama okul 0-sınıfsa `KurulumWidget` fallback olarak kalır)
- `ogretmen`, `zumre_baskani` → öğretmen kartı
- `mudur_yardimcisi` → kart yok (**plan-aşaması düzeltmesi:** MY,
  `OgretmenDashboard`'a değil `MYWidgets`'a düşer ve orada mevcut
  `KurulumWidget` çalışır; dokunulmaz)
- `admin` → kart yok

## Mimari

Mevcut domain katman düzeni (`repositories → services → UI`):

```
src/domains/onboarding/
  setupMath.ts                    # saf: adım tanımları + görünürlük kuralları
  repositories/SetupRepository.ts # hafif count sorguları (head:true, Promise.all)
  services/SetupService.ts        # getSetupStatus(): rol → adım listesi + ✓ durumları
app/(dashboard)/anasayfa/
  BaslangicKarti.tsx              # sunum; BugunYapilacaklarWidget görsel dili
```

- `anasayfa/page.tsx` (server component) `SetupService.getSetupStatus()` çağırır,
  sonuç `null` değilse `BaslangicKarti`'yı sayfanın en üstüne basar.
- Kopyala butonu için kart client component (`navigator.clipboard`); geri kalanı
  statik render.
- Sorgular RLS altında `createClient()` ile koşar; count'lar `head: true` +
  `Promise.all` (öğretmen: 4 paralel count; müdür: 1 count).
- Mutasyon yok → server action yok, `revalidatePath` yok. Adım tamamlanınca
  ✓ bir sonraki anasayfa ziyaretinde görünür (yeterli; canlı takip gerekmez).

## Hata durumu

Count sorgusu hata verirse ilgili adım **tamamlanmış sayılır** (fail-quiet):
kurulum kartı kritik yol değil, hata durumunda kullanıcıyı yanlış yönlendirmek
yerine kartı küçültmek/gizlemek tercih edilir. Hata `logger.error` ile loglanır.

## Test

- **Birim (`setupMath`):** 30-gün penceresi (sınır: tam 30. gün + bozuk
  tarih); adım listesi inşası; "tümü ✓ → kart yok"; tek eksik adım → kart var.
- **Servis:** ayrı test yok — projede repo-mock service test kalıbı
  bulunmuyor (TaskService/MeetingService de yalnız math katmanını test
  ediyor); mantık `setupMath`'te yoğunlaştırıldı, servis ince orkestrasyon.
- **E2e:** mevcut seed'ler veri içerdiğinden kart görünmez → mevcut 67 e2e
  kırılmaz. Yeni e2e eklenmez (taze-hesap seed'i maliyetli; birim+servis
  kapsaması yeterli). Karar implementasyon planında yeniden değerlendirilebilir.

## Kapsam dışı (YAGNI)

- "Kapat/bir daha gösterme" butonu (30-gün kapısı aynı işi görüyor)
- Adım durumu tablosu / kalıcı onboarding state
- Öğrenci ekleme, öğretmen-sınıf atama matrisi, nöbet gibi müdür adımları
  (kullanıcı kararı: müdür için tek kritik adım davet)
- Tooltip/spotlight turu
- E-posta/push hatırlatması
