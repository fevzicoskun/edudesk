# Yoklama Modülü İyileştirme — Tasarım

**Tarih:** 2026-06-10
**Durum:** Onaylandı
**Kapsam:** Özürlü (izinli/raporlu) durumu, karma sorumluluk modeli, aylık çizelge + raporlama, Excel dışa aktarım

## Amaç

Yoklama modülü MVP seviyesinde: günlük alma akışı çalışıyor ama özürlü/özürsüz
ayrımı yok, geçmiş görünümü ve rapor yok, "yoklama alındı mı" takibi yok.
Bu tasarım dört eksiği tek sprintte kapatır. Ders saati bazlı yoklama ve
ihtar mektubu otomasyonu **kapsam dışıdır** (YAGNI).

## 1. Veri modeli: `excused` durumu

- Status seti `present | absent | late | excused` olur ("Özürlü" — izinli ve
  raporlu tek durum altında; ayrımı v1'de yok).
- Migration: `attendance.status` üzerinde CHECK constraint varsa `excused`
  eklenecek şekilde güncellenir. Başka şema değişikliği yok.
- `AttendanceStatus` TS tipi (`app/actions/yoklama.ts`) genişletilir.
- Toggle döngüsü: Mevcut → Devamsız → Geç → Özürlü → Mevcut. Özürlü rozeti
  mavi (`bg-blue-100 text-blue-700` + dark karşılıkları).

### Sayım kuralları (pure function olarak `src/domains/attendance/`)

- **Özürsüz devamsızlık** = `absent` × 1 + `late` × 0,5 (hafta sonu hariç —
  mevcut davranış korunur).
- **Özürlü devamsızlık** = `excused` × 1, ayrı sayaç.
- Rozet gösterimi: `"4g + 2ö"` (özürlü yoksa sadece `"4g"`).
- `ATTENDANCE_WARN_DAYS` (15) ve `ATTENDANCE_LIMIT_DAYS` (20) sabitleri
  değişmez; uyarı eşiği **özürsüz** sayaca uygulanır.

### Veli bildirimi

- `veliAbsenceNotifier`: `excused` durumunda e-posta gönderilmez
  (`skipped: 'ozurlu'`). `saveYoklama` zaten yalnızca `absent`/`late` için
  event gönderiyor; bu davranış korunur — `excused` event üretmez.
- 45 dk gecikme penceresinde öğretmen durumu `excused`'a çevirirse notifier'ın
  kontrol adımı güncel satırı okuduğu için e-posta kendiliğinden iptal olur.

## 2. Sorumluluk & akış (karma model)

Öğretmen alır; almadıysa idare tamamlar. Sorumluluk takibi türetilmiş durumla
yapılır: **bir sınıf+tarih için `attendance` satırı varsa yoklama alınmıştır**
(`saveYoklama` mevcut öğrencileri de upsert ettiği için güvenilir). Ayrı bir
"taken" tablosu/flag'i tutulmaz.

### /yoklama sınıf seçicisi

- Sınıflar iki grupta listelenir: **"Sınıflarım"** (`classes.mentor_teacher_id
  = ben` ∪ `teacher_classes`) önce, **"Diğer sınıflar"** sonra
  (`<optgroup>`).
- Varsayılan seçim: ilk "benim" sınıfım; yoksa mevcut davranış (ilk sınıf).
- Yetki modeli değişmez — `ATTENDANCE.UPDATE` olan herkes her sınıfa
  girebilmeye devam eder (idarenin tamamlama yetkisi buradan gelir).

### Inngest cron: `yoklama-hatirlatici`

- Zamanlama: okul günleri 10:00 TR (`TZ=Europe/Istanbul 0 10 * * 1-5`).
- Akış: o günün tarihinde satırı olmayan aktif sınıfları bulur →
  - Mentor öğretmene web push + `notifications` kaydı
    ("9-A yoklaması henüz alınmadı").
  - Mentor'u olmayan sınıflar yalnızca idare özetinde görünür.
  - `mudur` / `mudur_yardimcisi` rollerine tek özet bildirim
    ("3 sınıfın yoklaması eksik: 9-A, 10-C, 11-B").
- Eksik sınıf yoksa hiç bildirim üretmez. Resmî tatil bilgisi v1'de yok;
  tatil gününde gelen bildirim kabul edilen sınırlılıktır.

### BugunYoklamaWidget (idare)

- Alınan/alınmayan sınıf listesi; alınanlarda kimin aldığı
  (`attendance.teacher_id` → profil adı) ve saat.
- Eksik sınıfa "Yoklama al →" linki (`/yoklama?sinif=<id>`).
- Limit yaklaşan öğrenciler (özürsüz ≥ 15 gün) ayrı küçük liste.

## 3. Çizelge & raporlar — `/yoklama/cizelge`

Alma ekranı (mobil, hızlı) ile raporlama (masaüstü, idare) ayrı sayfalardır.

### Aylık çizelge

- Ay + sınıf seçici. Grid: satır = öğrenci, kolon = okul günü (Pzt–Cum).
- Hücre kodları: `·` mevcut / `D` devamsız (kırmızı) / `G` geç (sarı) /
  `Ö` özürlü (mavi) / boş = yoklama alınmamış gün.
- Sağ kolonlar: öğrenci toplamı (özürsüz | özürlü). Alt satır: gün bazında
  devamsız sayısı.
- Sorgu: tek `attendance` çekimi (sınıf + ay aralığı), gridleme client'ta
  pure function ile.

### Öğrenci devamsızlık dökümü

- Çizelgede öğrenci satırına tık → panel: tüm devamsız/geç/özürlü günlerin
  tarih + durum listesi (okul yılı başından itibaren).
- Aynı bileşen öğrenci profil modalına **"Devamsızlık" sekmesi** olarak
  eklenir (veli görüşmesi senaryosu).

### Excel dışa aktarım

- Çizelge sayfasında "Excel" butonu: tarih aralığı + sınıf → XLSX.
- İki sayfa: (1) çizelge grid'i, (2) öğrenci özetleri (özürsüz/özürlü
  toplamları). Mevcut `export` domain + `XlsxBuilder` kalıbı kullanılır;
  satır limiti mevcut `XLSX_EXPORT_LIMIT` yaklaşımıyla sınırlanır.

### RBAC

- Öğretmen: yalnızca kendi sınıflarının çizelgesi (`scope()`).
- `mudur` / `mudur_yardimcisi`: tüm okul.
- Sayfa `ATTENDANCE.READ` gerektirir; export mevcut export izinlerine uyar.

## 4. Mimari

Mevcut domain kalıbına uyum (`repositories → services → actions`):

```
src/domains/attendance/
  repositories/AttendanceRepository.ts   # raw Supabase (getByClassMonth,
                                         #   getMissingClassesForDate,
                                         #   getStudentHistory, upsertEntries)
  services/AttendanceService.ts          # getAbility() RBAC + orkestrasyon
  lib/attendanceMath.ts                  # pure: sayım, gridleme, okul günü
app/actions/yoklama.ts                   # thin action — service'e delege
app/(dashboard)/yoklama/cizelge/         # page.tsx + CizelgeClient + loading
src/domains/notifications/functions/yoklamaHatirlatici.ts
```

- `app/actions/yoklama.ts` içindeki doğrudan Supabase çağrıları
  `AttendanceRepository`'ye taşınır (mevcut davranış birebir korunarak).
- `/yoklama` page.tsx'teki devamsızlık sayım döngüsü `attendanceMath`'a alınır.

## 5. Test

- **Unit (~25-30):** `attendanceMath` (özürlü/özürsüz sayımı, hafta sonu,
  geç=0,5, gridleme, okul günü üretimi), cron'un eksik sınıf tespiti
  (repository mock), XlsxBuilder yoklama sayfaları.
- **E2E (2-3 spec):** excused toggle + kaydet akışı; çizelge görüntüleme;
  öğretmen scope kısıtı (kendi sınıfı dışını görememe).
- Mevcut yoklama unit testleri (`yoklama-action.test.ts`) yeni statüye göre
  güncellenir.

## Kabul Kriterleri

1. Öğretmen bir öğrenciyi "Özürlü" işaretleyebilir; veliye e-posta gitmez.
2. Rozet özürsüz/özürlü ayrımını gösterir; 15/20 gün uyarıları yalnızca
   özürsüze bakar.
3. 10:00 TR'de yoklaması eksik sınıfın mentor'una push + bildirim düşer;
   idareye özet gider.
4. `/yoklama/cizelge` aylık grid'i, öğrenci dökümünü ve Excel çıktısını verir.
5. Öğretmen yalnızca kendi sınıflarının çizelgesini görür; müdür tümünü.
6. Tüm mevcut testler + yeni testler yeşil; 0 TS hatası.
