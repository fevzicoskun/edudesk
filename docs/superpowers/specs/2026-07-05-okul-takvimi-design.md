# Okul Takvimi — Tasarım

**Tarih:** 2026-07-05
**Durum:** Onaylandı

## Amaç

Okuldaki tüm zamana bağlı olayları tek görsel takvimde toplamak: veli randevuları, nöbetler, ödev teslim tarihleri, resmî tatiller ve yönetimin elle eklediği okul etkinlikleri (gezi, tören vb.). Öğretmen her gün tek bakışta "bu ay beni ne bekliyor" sorusunun cevabını görür.

## Kapsam

### Dahil (v1)
- `/takvim` sayfası, sidebar'da "Takvim" girişi
- Ay ızgarası (masaüstü) + kronolojik ajanda listesi (dar ekran) — tek component, CSS breakpoint ile iki layout
- Ay geçişi URL-state ile: `/takvim?ay=2026-07` → server yeniden çeker
- 5 olay kaynağı: veli randevuları, nöbetler, ödev teslimleri, resmî tatiller, okul etkinlikleri
- Güne tıklayınca gün detay paneli
- Müdür/MY için "+ Etkinlik" ekleme ve etkinlik silme (soft-delete)

### Hariç (bilinçli, v1 sonrası)
- Hafta görünümü
- Okul/zümre toplantıları kaynağı
- Ders programı kaynağı
- Sürükle-bırak, iCal export

## Veri Modeli

Tek yeni tablo: **`school_events`**

| Kolon | Tip | Not |
|---|---|---|
| id | uuid PK | |
| school_id | uuid FK schools | her sorguda filtre |
| title | text | |
| event_date | date | tek günlük olay |
| note | text nullable | |
| created_by | uuid FK profiles | |
| created_at | timestamptz | |
| deleted_at / deleted_by | soft-delete deseni | |

**RLS:** SELECT → okul üyeleri (`is_school_member`); INSERT/UPDATE/DELETE → müdür + müdür yardımcısı. Migration sonrası DB tipleri regen edilecek (`database.types.ts`) — yoksa tsc kırılır.

## Mimari (Yaklaşım A: sunucu-birleştirmeli ay beslemesi)

```
app/(dashboard)/takvim/page.tsx  (server component)
  → CalendarService.getMonthEvents(ability, ay)
      → CalendarRepository  (5 kaynak, paralel, ay aralığı)
      → calendarMath.ts     (saf birleştirme — tüm unit testler burada)
  → <TakvimGrid events=... />  (client, sadece çizer)
```

### `src/domains/calendar/`

- **CalendarRepository** — ham Supabase sorguları, iş mantığı yok:
  - `parent_meetings`: `meet_date` ay aralığında, iptal edilenler hariç
  - `teacher_duties`: okulun tüm nöbetleri (haftalık tekrarlı: `day_of_week` + `time_range` + `location`)
  - `homeworks`: `due_date` ay aralığında, `deleted_at IS NULL`
  - `school_events`: `event_date` ay aralığında, `deleted_at IS NULL`
  - Hepsi `school_id` filtreli.
- **calendarMath.ts** — saf, DB'siz:
  - Nöbet genişletme: `day_of_week` → ayın somut tarihleri; **resmî tatile denk gelen gün atlanır**, hafta sonu üretilmez
  - Tüm kaynaklar tek tip `CalendarEvent { date: string; type: 'randevu' | 'nobet' | 'odev' | 'tatil' | 'etkinlik'; title: string; detail?: string }` listesine birleştirilir
  - Güne gruplama: `Map<date, CalendarEvent[]>`, gün içi sıralama sabit (tatil → etkinlik → nöbet → randevu → ödev)
- **CalendarService** — `getAbility()` ile rol bazlı kapsam:
  - Öğretmen: yalnızca **kendi** nöbeti, kendi randevuları, kendi ödevleri
  - Müdür/MY: okul geneli (tüm nöbetler, tüm randevular, tüm ödevler)
  - Tatiller (`SCHOOL_YEAR_HOLIDAYS` sabiti) ve okul etkinlikleri: herkese
- **Server action** (`app/actions/`): etkinlik ekle/sil — Zod doğrulama → service (RBAC: müdür/MY) → `revalidatePath('/takvim')`

## UI

- **TakvimGrid** (client component):
  - Ay ızgarası: Pzt–Paz sütunları, renk kodlu kategori işaretleri (◆ randevu, ■ nöbet, ● ödev, ▲ etkinlik), tatil hücresi soluk arka plan + etiket
  - Güne tıklama → gün detay paneli (olay listesi: saat/ders saati, başlık, detay)
  - Dar ekranda ajanda listesi: sadece olaylı günler, kronolojik
  - A11y: soluk metin `text-gray-500 dark:text-slate-400`; gün hücreleri buton, klavye erişilebilir
- **YeniEtkinlikModal**: müdür/MY'ye görünen "+ Etkinlik" butonu; başlık + tarih + not alanları
- Boş durum: olaysız ayda rol-bazlı boş-durum mesajı (mevcut boş-durum desenine uygun)
- Sayfa `loading.tsx` iskeleti + `title` metadata mevcut desenle

## Hata ve Kenar Durumları

- Tatile denk gelen nöbet gösterilmez (okul kapalı)
- `day_of_week` yalnızca 1–5 beklenir; aralık dışı değer sessizce atlanmaz, loglanır ve üretilmez
- İptal edilmiş randevular (`status`) hariç tutulur
- Ay parametresi geçersizse (`?ay=abc`) içinde bulunulan aya düşülür
- Ay sınırları: önceki/sonraki ayın taşan günleri ızgarada soluk gösterilir, olay çekilmez

## Test

- **Unit (calendarMath):** nöbet genişletme (doğru haftalar), tatil çakışması (nöbet düşer, tatil kalır), ay sınırları, boş ay, gün içi sıralama, geçersiz `day_of_week`
- **E2E:** öğretmen yalnız kendi olaylarını görür; müdür okul genelini görür; öğretmen "+ Etkinlik" butonunu görmez; müdür etkinlik ekler ve takvimde görünür; boş-durum mesajı
- Mevcut 763 unit + 67 e2e regresyonu yeşil kalır
