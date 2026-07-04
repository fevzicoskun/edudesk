# Günlük Özet (Sabah 07:30 Bildirimi) — Tasarım

**Tarih:** 2026-07-04
**Durum:** Onaylandı
**Amaç:** Öğretmenin güne EduDesk ile başlamasını sağlayan tek zengin sabah bildirimi (retention/alışkanlık kancası).

## Karar Özeti (kullanıcı onaylı)

| Soru | Karar |
|---|---|
| Kitle | Sadece öğretmen + zümre başkanı (müdür/MY okul özeti sonraki iterasyon) |
| İçerik | Mevcut ders+nöbet + 3 yeni bölüm: dün eksik yoklama, bugün teslim ödevler, bugünkü veli randevuları |
| Kanal | Çan (notifications) + web push — mevcut kanallar, e-posta YOK |
| Mimari | Mevcut `dersProgramiOzeti` cron'u `gunlukOzet`'e evrilir (ayrı cron YOK, sabah TEK bildirim) |

## Gerçeklik Notları (keşifte doğrulandı)

1. **Yoklama sınıf-gün bazlı ve mentor sorumlu.** `attendance` kayıtları `class_id + date` üzerinden tutulur; sorumlu kişi `classes.mentor_teacher_id`. 10:00 cron'u (`yoklamaHatirlatici`) bu modelle çalışır ve `findMissingClasses` helper'ını export eder. "Dün eksik yoklama" bölümü bu yüzden ders programına göre DEĞİL, öğretmenin **mentoru olduğu sınıflara** göre hesaplanır.
2. **Push altyapısı hazır:** `sendPushToUser` (VAPID) + `notifications` tablosu mevcut cron'da zaten kullanılıyor.
3. **`parent_meetings` embed edilebilir:** `student_id` FK'sı `students`'a → `students(full_name)` PostgREST embed çalışır (MeetingRepository'de kanıtlı).
4. **`homeworkReminder` (08:00) çakışmaz:** tercihe bağlı "X gün kala" hatırlatması + veli e-postası — farklı amaç, DOKUNULMAZ. `yoklamaHatirlatici` (10:00) da kalır (gün-içi hatırlatma; bizimki dün-geriye bakış).

## Bildirim Formatı

Başlık kuralı (kesin): ders varsa **"Bugünün dersleri"**; yoksa nöbet varsa **"Bugün nöbettesin"** (mevcut başlıklar korunur); ikisi de yoksa **"Günlük özet"**. Gövde — boş bölüm hiç görünmez:

```
1. ders 9-A, 3. ders 10-B ...          ← mevcut formatOzetBody
🔔 Nöbet: Bahçe 12:00-12:40            ← mevcut formatDutyReminder
⚠️ Dün 9-A yoklaması alınmadı           ← YENİ (2+ sınıf: "Dün 2 sınıfın yoklaması alınmadı: 9-A, 10-B")
📚 Bugün teslim: "Kesirler" (+1 ödev)   ← YENİ (1 ödev: sadece başlık; 2+: ilk başlık + "+N ödev")
👤 Veli görüşmesi: 3. ders Ayşe Yılmaz  ← YENİ (period sırasına dizili, her randevu ayrı satır)
```

- Hiçbir bölüm dolu değilse bildirim gitmez (mevcut davranış).
- Bildirim URL'i `/ders-programi` → **`/anasayfa`** olur (özet artık tek konuya bağlı değil).
- Yalnız `status='planlandi'` randevular listelenir.
- "Dün" = önceki okul günü: Pazartesi → Cuma (`previousSchoolDay`). Cron zaten `1-5` günlerde çalışır.

## Mimari

**Saf mantık (TDD):** `src/domains/notifications/gunlukOzetMath.ts`
- `previousSchoolDay(dow: 1..5): 1..5` — Pzt(1)→Cuma(5), diğerleri `dow-1`.
- `formatGunlukOzet(sections)` — bölümleri yukarıdaki kurallarla satırlara dizer, başlığı seçer; `{ title, body } | null` (hepsi boşsa null). Girdi tipi saf (DB tipi sızmaz): ders satırı (hazır string), nöbet satırları (hazır string[]), eksik yoklama sınıf adları, bugün teslim ödev başlıkları, randevular `{ period, studentName }[]`.
- Mevcut `formatOzetBody` / `formatDutyReminder` / `findMissingClasses` aynen yeniden kullanılır.

**Cron:** `src/domains/notifications/functions/gunlukOzet.ts` (dersProgramiOzeti.ts'in yerine; Inngest id `gunluk-ozet`, cron `TZ=Europe/Istanbul 30 7 * * 1-5`)
- Mevcut 2 sorguya (lesson_schedules, teacher_duties) 4 toplu okul-geneli sorgu eklenir (service client):
  1. `classes` (id, name, school_id, mentor_teacher_id; deleted_at null) — zaten kısmen çekiliyor, mentor kolonu eklenir.
  2. `attendance` (class_id) `date = dün` — `findMissingClasses` ile eksikler, mentor'a gruplanır.
  3. `homeworks` (teacher_id, title) `due_date = bugün`, `deleted_at null`.
  4. `parent_meetings` (teacher_id, period, students(full_name)) `meet_date = bugün`, `status = 'planlandi'`.
- **Alıcı kümesi = birleşim:** ders programı olanlar ∪ bugün nöbetçiler ∪ mentor-eksik-yoklamalılar ∪ bugün-teslim-ödevliler ∪ bugün-randevulular. (Mevcut kodda sadece ders∪nöbet vardı; bugün dersi olmayan ama randevusu olan öğretmen de artık özet alır.)
- Tarihler İstanbul TZ (`Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' })` — yoklamaHatirlatici deseni).
- `app/api/inngest/route.ts` import/register güncellenir (`dersProgramiOzetiFn` → `gunlukOzetFn`).

**Migration YOK. Yeni tablo YOK. UI YOK. Yeni bağımlılık YOK.**

## Hata Yönetimi

- Bölüm sorgusu hata verirse o bölüm boş sayılır + `logger.error` (fail-quiet — özet kritik yol değil, Başlangıç Kartı deseni).
- Push hataları mevcut `Promise.allSettled` + toplu `logger.error` deseniyle.
- school_id: alıcı için ilk bulunan kaynağın school_id'si (tüm kaynaklar zaten school_id taşır).

## Test

- `tests/vitest/unit/domains/notifications/gunlukOzetMath.test.ts`: previousSchoolDay (Pzt→Cuma sınırı), tüm bölümler boş → null, tek bölüm dolu → başlık seçimi, ödev kısaltması (1 vs 3 ödev), randevu period sıralaması, eksik yoklama tekil/çoğul formatı.
- Cron fonksiyonu mevcut cron'lar gibi unit-test dışı (mantık saf katmanda).
- Mevcut `scheduleMath`/`dutyMath` testleri değişmez.

## Bilinçli Dışarıda (sonraki iterasyonlar)

- Müdür/MY okul özeti (10:00 cron'unda kısmi karşılığı var)
- E-posta kanalı
- Kullanıcı aç/kapa tercihi (`notification_preferences` genişletmesi)
- Anlık devamsızlık veli bildirimi, PWA push teşvik UI'ı, Öğrenci 360 (yol haritasının sonraki maddeleri)
