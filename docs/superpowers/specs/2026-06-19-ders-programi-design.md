# Ders Programım — Tasarım (2026-06-19)

## Amaç ve kapsam

Her öğretmen kendi haftalık ders programını uygulamada **girip görüntüleyebilsin**, ve
her sabah **bugünün dersleri** özetini bildirim olarak alsın.

**Kapsam dışı (şimdilik):** yoklama entegrasyonu, müdür/MY gözetim ekranı, dersten-önce
anlık hatırlatma. Bunlar ileride eklenebilir; veri modeli engel olmayacak.

**Faz 2 (ayrı spec):** ASC TimeTables fotoğrafından OCR ile ızgarayı ön-doldurma.
Bu tasarım ızgarayı tek doğruluk kaynağı + düzeltme/fallback arayüzü yaptığı için
OCR şema değişikliği gerektirmeyecek (OCR yalnız `slots` üretip ızgarayı doldurur).

## Veri modeli

Mevcut **`lesson_schedules`** tablosu kullanılır (DB'de var, uygulamada henüz bağlı değil).
Öğretmen başına **tek satır**: `teacher_id = auth.uid()`, `school_id = current_school_id()`.

Kolonlar:
- `slots JSONB` — yalnızca **dolu hücreler**: `[{ "day": 1-5, "period": <no>, "class_id": "<uuid>" }]`.
  Branş hücrede tutulmaz; `profiles.subject`'ten gelir.
- `periods JSONB` — **YENİ kolon** (migration). Zil çizelgesi, yalnız **ders periyotları**:
  `[{ "no": 1, "start": "08:30", "end": "09:05" }, ...]`. Teneffüs/öğle ayrı satır değil —
  bir periyodun bitişi ile sonrakinin başlangıcı arasındaki **boşluk** teneffüstür; öğle arası
  sadece daha büyük bir boşluktur (örn. 13:00 bitiş → 13:40 başlangıç).
- Mevcut `period_count`, `title`, `schedule_type`, `file_url/file_name` kolonlarına dokunulmaz
  (kullanılmaz; faz 2 için durur).

`day`: 1=Pazartesi … 5=Cuma (hafta sonu yok).

### Varsayılan zil çizelgesi (`DEFAULT_PERIODS`)

Bilinen kısıtlar: dersler 35 dk; ilk teneffüs 10 dk, sonraki teneffüsler 5 dk; öğle arası
13:00–13:40; öğleden sonra 13:40'ta başlar, son ders 15:35'te biter.

Bir öğretmenin ilk açılışında bu varsayılan gömülü gelir ve **düzenlenebilir** (okul ekranı yok,
öğretmen self-servis). Gün başlangıç saati ve toplam periyot sayısı kesin verilmediğinden,
varsayılan **08:30 başlangıç + 8 periyot** alınır ve öğretmen gerekirse düzeltir:

| No | Başlangıç | Bitiş | Sonraki boşluk |
|----|-----------|-------|----------------|
| 1 | 08:30 | 09:05 | 10 dk (ilk teneffüs) |
| 2 | 09:15 | 09:50 | 5 dk |
| 3 | 09:55 | 10:30 | 5 dk |
| 4 | 10:35 | 11:10 | 5 dk |
| 5 | 11:15 | 11:50 | öğle (→13:40) |
| 6 | 13:40 | 14:15 | 5 dk |
| 7 | 14:20 | 14:55 | 5 dk |
| 8 | 15:00 | 15:35 | — |

> Not: 08:30 başlangıç bir **varsayımdır**; öğretmen UI'dan saatleri kendi okuluna göre
> ayarlar. Mekanizma doğru çalıştığı sürece varsayılanın dakikası kritik değildir.

## Güvenlik (RLS)

`lesson_schedules` şu an yalnız `mudur`/`mudur_yardimcisi`'ye yazma izni veriyor. Eklenecek
**öğretmen-self** politikaları (mevcut müdür politikaları korunur, ileride gözetim için):

- SELECT: zaten okul geneli (`school_id = current_school_id()`) — değişmez.
- INSERT/UPDATE/DELETE: `school_id = current_school_id() AND teacher_id = auth.uid()`.
  `WITH CHECK` ile öğretmen başkası adına satır oluşturamaz/değiştiremez.

Migration: `periods` kolonu (`ADD COLUMN IF NOT EXISTS periods JSONB NOT NULL DEFAULT '[]'`)
+ üç yeni policy. Tek dosya.

## Katmanlar (CLAUDE.md desenine uygun)

```
app/(dashboard)/ders-programi/page.tsx        server: kendi programı + okul aktif sınıfları yükler
  └─ DersProgramiClient.tsx                    client: düzenlenebilir ızgara + kaydet
app/actions/schedule.ts                         saveSchedule action (Zod validate → service → revalidate)
src/domains/schedule/
  repositories/ScheduleRepository.ts            getByTeacher(teacherId), upsert(row)
  services/ScheduleService.ts                   getMySchedule(), saveMySchedule() — getAbility, doğrulama
  scheduleMath.ts                               SAF + test edilebilir mantık (DB yok)
src/domains/notifications/functions/dersProgramiOzeti.ts   sabah cron
src/shared/validation/ (veya domains/schedule/validators)  Zod şemaları
```

### `scheduleMath.ts` (saf fonksiyonlar — birim test edilir)

- `DEFAULT_PERIODS: Period[]` — yukarıdaki varsayılan.
- `validatePeriods(periods)` — her `start < end`, artan sıra, çakışma yok, 1..12 adet.
- `validateSlots(slots, periods, validClassIds)` — `day ∈ 1..5`; `period` mevcut bir periyot no'su;
  `class_id ∈ validClassIds`; aynı `(day, period)` tek kez (bir slotta tek sınıf).
- `todaysLessons(schedule, weekday)` — verilen gün için `{ period, start, end, classId }`
  listesini saate göre sıralı döndürür. Cron ve görüntüleme ortak kullanır.

## UI akışı

`/ders-programi` (öğretmen rolleri). Server component öğretmenin satırını (`slots`+`periods`)
ve okulun aktif sınıflarını (`classes`, `deleted_at IS NULL`) yükler; satır yoksa `DEFAULT_PERIODS`
ile boş ızgara gösterir.

`DersProgramiClient` — satırlar = `periods` (saatleriyle), sütunlar = Pzt–Cuma. Her hücre:
sınıf seçimi (dropdown: okul sınıfları + "—/boş"). Hücre dolunca `profiles.subject` etiketi gösterilir.
"Zil saatlerini düzenle" ile `periods` saatleri ayarlanır. "Kaydet" → `saveSchedule` action.

**Dropdown kaynağı:** okulun tüm aktif sınıfları (öğretmen o periyotta hangisini okutuyorsa onu seçer;
`teacher_classes`'a bağlanmaz — branş öğretmeni atanmamış sınıfı da okutabilir).

Sidebar `navItems`'a yeni kayıt: `{ href: '/ders-programi', label: 'Ders Programım',
mobile: false, roles: ['ogretmen','zumre_baskani','mudur_yardimcisi'] }`.

## Hatırlatma (sabah özeti)

`dersProgramiOzeti` Inngest fonksiyonu — `yoklamaHatirlatici` desenini izler:
- Cron: `TZ=Europe/Istanbul 30 7 * * 1-5` (hafta içi 07:30).
- `createServiceClient()` ile o günün haftagününe (1–5) sahip, `slots` dolu programları çek.
- Her öğretmen için `todaysLessons` hesapla; ders varsa **`notifications` insert**
  (`{ user_id, school_id, title: 'Bugünün dersleri', body: '1.ders 9-A · 3.ders 10-B …' }`)
  ve `sendPushToUser` (best-effort, `Promise.allSettled` + hata logu).
- Dersi olmayan / programı olmayan öğretmene bildirim yok.
- `app/api/inngest/route.ts`'e kaydedilir. Mail kullanılmaz (mevcut desen çan + push).

## Hata yönetimi

- Action sınırında Zod doğrulama; `validatePeriods`/`validateSlots` başarısızsa kullanıcıya
  anlaşılır mesaj, kayıt yapılmaz (kısmi/bozuk slot yazılmaz).
- `class_id` doğrulaması server tarafında okul sınıflarına karşı yapılır (UI dropdown'ına güvenilmez;
  cross-tenant/silinmiş sınıf reddedilir).
- Cron best-effort: bir öğretmenin push'u patlarsa diğerleri etkilenmez (`allSettled`).

## Test

- **Birim (vitest):** `scheduleMath` — `DEFAULT_PERIODS` tutarlılığı (artan, çakışmasız),
  `validatePeriods` (çakışma/sıra/adet kenar durumları), `validateSlots` (geçersiz gün/periyot/sınıf,
  yinelenen slot), `todaysLessons` (gün filtreleme + saat sıralaması, boş gün).
- **E2E (playwright, opsiyonel ilk teslimde):** öğretmen `/ders-programi` açar → bir hücreye sınıf
  seçer → kaydeder → yeniden yüklemede görünür. `global-setup` seed'i (öğretmenin sınıfı) zaten mevcut.

## Teslim sırası (writing-plans aşamasına girdi)

1. Migration: `periods` kolonu + öğretmen-self RLS. `database.types.ts` yenile.
2. `scheduleMath.ts` + birim testleri (TDD).
3. Repository + Service + Zod + `saveSchedule` action.
4. `/ders-programi` sayfası + `DersProgramiClient` ızgara + Sidebar linki.
5. `dersProgramiOzeti` cron + kayıt + birim test.
