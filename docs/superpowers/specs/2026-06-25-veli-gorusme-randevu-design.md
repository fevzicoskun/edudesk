# Veli Görüşme Randevu Defteri — Tasarım

**Tarih:** 2026-06-25
**Durum:** Onaylandı (tasarım)

## Amaç

Öğretmenin dönem başı veli görüşmelerini, **ders programındaki boş saatlerine
göre** kaydedebileceği kişisel bir randevu defteri. Öğretmen güdümlü: öğretmen
boş bir periyot + tarih seçer, bir öğrenciyi (velisini) atar, not ekler. Veli
sisteme girmez; bildirim gönderilmez (en yalın model).

## Kapsam

### v1 (bu spec)
- Tarihli tekil randevu kaydı: tarih + boş ders periyodu + öğrenci + not + durum.
- `/randevular` sayfası: yaklaşan/geçmiş liste + "Yeni randevu" modalı.
- Boş-saat hesabı: seçilen tarihin hafta gününe göre öğretmenin ders
  programındaki dolu periyotlar ve o tarihe zaten rezerve periyotlar çıkarılır.
- Durum yönetimi: planlandı / yapıldı / iptal.
- Sidebar girişi (teaching roller).

### Kapsam dışı (v1 değil)
- Veli bildirimi (WhatsApp/e-posta) — kullanıcı talebiyle: sadece kayıt.
- Müdür/MY görünümü ve raporu.
- Okul-dışı serbest saat (16:00 gibi, 9 periyot dışı).
- Tekrarlayan/haftalık sabit görüşme saati.

## Veri modeli

Tek yeni tablo: `parent_meetings`.

```sql
CREATE TABLE parent_meetings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id  uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  meet_date   date NOT NULL,
  period      int  NOT NULL CHECK (period BETWEEN 1 AND 9),
  status      text NOT NULL DEFAULT 'planlandi'
              CHECK (status IN ('planlandi', 'yapildi', 'iptal')),
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Aynı slota iki aktif randevu olmasın
CREATE UNIQUE INDEX parent_meetings_slot_uniq
  ON parent_meetings (teacher_id, meet_date, period)
  WHERE status <> 'iptal';

-- updated_at trigger (mevcut update_*_updated_at pattern'i)
```

`period` öğretmenin ders programındaki periyot numarasına (1..9) karşılık gelir;
saat aralığı `lesson_schedules.periods` (veya `DEFAULT_PERIODS`) üzerinden
çözülür, ayrıca saklanmaz.

## RLS

Mevcut tenant + sahiplik pattern'i:

- SELECT/INSERT/UPDATE/DELETE policy:
  `school_id = current_school_id() AND teacher_id = auth.uid()`
- INSERT'te ek olarak `student_id`'nin öğretmenin okuluna ait olması zaten
  `current_school_id()` ile garanti; öğrenci seçimi istemcide öğretmenin kendi
  sınıflarıyla sınırlanır.
- Migration sonrası `database.types.ts` yeniden üretilir (zorunlu — yoksa tsc
  kırılır).

## Boş-saat mantığı (saf fonksiyon)

`src/domains/schedule/parentMeetingMath.ts`:

```ts
freePeriods(
  slots: Slot[],          // öğretmenin ders programı slotları
  periods: Period[],      // periyot tanımları (no, start, end)
  weekday: number,        // 1..5 (seçilen tarihten türetilir)
  bookedPeriods: number[] // o tarihe zaten rezerve periyot no'ları
): Period[]
```

- Dolu periyotlar = `slots.filter(s => s.day === weekday).map(s => s.period)`.
- Müsait = `periods` − dolu − bookedPeriods.
- Hafta sonu (weekday ∉ 1..5) veya tam dolu gün → boş dizi.

Hesap tamamen istemcide; `ScheduleService.getMySchedule()` zaten slot+period
getiriyor. Sunucuya ekstra sorgu yok.

## Akış

1. `/randevular` (teaching roller; değilse `/anasayfa`'ya redirect — mevcut
   ders-programi pattern'i).
2. Liste: **Yaklaşan** (meet_date ≥ bugün, status≠iptal) ve **Geçmiş**.
   Her satır: öğrenci adı · sınıf · tarih · "N. ders · HH:MM–HH:MM" · durum rozeti.
   Aksiyonlar: Yapıldı işaretle · İptal · Sil.
3. Yeni randevu modalı:
   - `<input type="date">` (hafta içi; hafta sonu seçilirse uyarı).
   - Tarih seçilince → `freePeriods(...)` → periyot dropdown'u (saat aralığıyla).
   - Boş periyot yoksa: "Bu gün boş saatin yok" mesajı, kaydet kapalı.
   - Öğrenci dropdown'u: öğretmenin kendi sınıflarındaki öğrenciler, sınıfa göre
     gruplu.
   - Not (opsiyonel).
   - Kaydet → server action → UNIQUE ihlali kullanıcı-dostu hataya çevrilir.

## Server actions

`app/actions` altında (mevcut pattern):
- `createMeeting(input)` — Zod doğrulama, INSERT.
- `updateMeetingStatus(id, status)` — UPDATE.
- `deleteMeeting(id)` — DELETE.

## Surfacing

- Sidebar `navItems`: `{ href: '/randevular', label: 'Veli Görüşmeleri',
  roles: teaching, ... }`.
- (Opsiyonel, v1 değil) Anasayfa "Bugünkü görüşmelerim" widget'ı — "Bugünkü
  Programım" pattern'iyle.

## Test (TDD)

- `parentMeetingMath.test.ts`: dolu gün, tam dolu gün, hafta sonu, çakışan
  rezervasyon çıkarma.
- Server action testleri: oluştur / durum değiştir / sil; RLS — başka
  öğretmenin randevusuna erişememe; UNIQUE slot ihlali.
- 1 Playwright happy-path: randevu oluştur → yaklaşan listede görün.
