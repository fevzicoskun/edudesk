# Öğretmen Dosyası (Denetim Paketi) — Tasarım Speci

**Tarih:** 2026-05-27  
**Durum:** Onaylandı

---

## Özet

Müfettiş denetiminde öğretmenin tüm belgelerini hazır tutmasını sağlayan özellik. Profil sayfasına "Dosyam" sekmesi eklenir. 4 yeni belge türü inşa edilir; mevcut zümre ve sınav verileri otomatik dahil edilir. Tüm belgeler tek PDF olarak indirilebilir.

---

## Navigasyon

Mevcut `/profil` sayfasına yeni sekme: **"Dosyam"**. Ayrı sidebar menüsü eklenmez. Eksik belge sayısı sekme başlığında badge olarak gösterilir.

Route: `/profil/dosyam`

---

## Belge Türleri

### 1. Günlük Ders Planı
**Route:** `/profil/dosyam/gunluk-plan/yeni`, `/profil/dosyam/gunluk-plan/[id]`

Kullanıcının gireceği değişken alanlar:
- Sınıf/Şube (mevcut `classes` tablosundan seçim)
- Tarih
- Ders Saati (1.–8. saat)
- Ünite (müfredattan)
- Konu (serbest metin)
- Kazanımlar (TYMM kodlarından çoklu seçim)
- Öğretim Yöntemleri (checkbox: Anlatım, Soru-Cevap, Grup Çalışması, Problem Çözme, Beyin Fırtınası)
- Araç-Gereçler (checkbox: Akıllı Tahta, Ders Kitabı, Projeksiyon, Cetvel, Pergel)

Standart metinle önceden dolu, düzenlenebilir:
- Giriş/Hazırlık (5 dk) — "Bir önceki dersin konusu kısaca hatırlatılır, günlük konuya motivasyon sorusu yöneltilir."
- Gelişme/Konu İşleme (30 dk) — "Konu öğretmen tarafından anlatılır, örnek problemler çözülür, öğrencilerden aktif katılım beklenir."
- Sonuç/Değerlendirme (5 dk) — "Öğrencilere sınıf içi değerlendirme soruları yöneltilir. Ev ödevi verilir."

Okul adı, öğretmen adı, branş: profilden otomatik.

**DB Tablosu:** `daily_plans`
```
id uuid PK
teacher_id uuid FK profiles
school_id uuid FK schools
class_id uuid FK classes
plan_date date
lesson_hour smallint (1–8)
unit text
topic text
objectives text[] (TYMM kodları)
methods text[]
materials text[]
intro_text text
development_text text
conclusion_text text
created_at timestamptz
deleted_at timestamptz
```

---

### 2. Yıllık Plan
**Route:** `/profil/dosyam/yillik-plan`

Uygulama, sınıf seviyesine göre (9.–12. sınıf) hardcoded MEB matematik müfredatı konu listesi içerir. Bu liste akademik yıla (Eylül–Haziran, 36 hafta) otomatik yayılır. Öğretmen haftalık dağılımı görür, gerekirse sürükleme/düzenleme yapar, onaylar. Onaydan sonra PDF alınabilir.

Not: `curriculum_progress` tablosu mevcut ama yalnızca ilerleme takibi içerir, konu master listesi yoktur. Konu listesi `AnnualPlanService` içinde sabit veri (constant) olarak tutulur; gelecekte DB'ye taşınabilir.

**DB Tablosu:** `annual_plans`
```
id uuid PK
teacher_id uuid FK profiles
school_id uuid FK schools
academic_year text (ör: "2025-2026")
subject text
weekly_plan jsonb  [{week: 1, dates: "...", topics: [...], objectives: [...]}]
approved_at timestamptz
created_at timestamptz
```

---

### 3. ŞÖK Tutanağı (Şube Öğretmenler Kurulu)
**Route:** `/profil/dosyam/sok/yeni`, `/profil/dosyam/sok/[id]`

Kullanıcının gireceği değişken alanlar:
- Şube (sınıf seçimi)
- Toplantı Tarihi
- Dönem (1. / 2.)
- Katılımcı Öğretmenler (okul öğretmenlerinden çoklu seçim, branş gösterilir)
- Öğrenci bazlı notlar (opsiyonel)

Standart metinle önceden dolu, düzenlenebilir:

**Gündem Maddeleri (9 madde):**
1. Sınıfın genel akademik durumunun değerlendirilmesi
2. Öğrencilerin devamsızlık durumlarının görüşülmesi
3. Öğrencilerin davranış ve disiplin durumlarının değerlendirilmesi
4. Başarısız ve başarılı öğrencilerin belirlenmesi, gerekli tedbirlerin alınması
5. Öğrencilerin rehberlik ihtiyaçlarının belirlenmesi
6. Ders dışı etkinliklere ve sosyal faaliyetlere katılımın değerlendirilmesi
7. Sınıfın temizlik, düzen ve fiziki ortamının değerlendirilmesi
8. Velilerle işbirliği ve iletişimin değerlendirilmesi
9. Dilek ve temenniler

**Alınan Kararlar (standart, düzenlenebilir):**
1. Başarısız öğrencilerin velileri okula davet edilecektir.
2. Devamsızlığı yüksek öğrenciler için veli bildirimi yapılacaktır.
3. Rehberlik servisine yönlendirilmesi gereken öğrenciler bildirilecektir.

Her madde işaretlenebilir (görüşüldü ✓) ve üzerine not eklenebilir.

**DB Tablosu:** `sok_reports`
```
id uuid PK
teacher_id uuid FK profiles
school_id uuid FK schools
class_id uuid FK classes
meeting_date date
term smallint (1 veya 2)
academic_year text
participants jsonb  [{user_id, full_name, subject}]
agenda_items jsonb  [{order, text, discussed: bool, note}]
decisions jsonb    [{order, text, note}]
student_notes jsonb [{student_id, student_name, status, note}]
created_at timestamptz
deleted_at timestamptz
```

---

### 4. Defter Kontrolü
**Route:** `/profil/dosyam/defter-kontrolu`

Basit log. Tarih + sınıf + opsiyonel not. Liste görünümünde dönem boyunca tüm kontroller listelenir.

**DB Tablosu:** `notebook_checks`
```
id uuid PK
teacher_id uuid FK profiles
school_id uuid FK schools
class_id uuid FK classes
check_date date
notes text
created_at timestamptz
```

---

## Mevcut Verilerden Otomatik Dahil Edilenler

Yeni belge türü inşa edilmez, "Dosyam" sayfasında doğrudan linklenir:

| Belge | Kaynak |
|---|---|
| Zümre Toplantı Raporları | `zumre_meetings` tablosu → `/zumre` sayfası |
| Yazılı Sınavlar | `common_exams` tablosu → ilgili sayfa |

---

## Tümünü PDF İndirme

Tüm belge türlerini (4 yeni + 2 mevcut) tek PDF dosyasında birleştirir. Bölümler arası sayfa ayırıcı. Kapak sayfası: öğretmen adı, okul, dönem, tarih. Mevcut jsPDF altyapısı kullanılır.

---

## Profil Sekmesi — Dosyam

Tamamlanma yüzdesi hesabı: 6 belge türünden kaç tanesi bu dönem en az 1 kayıt içeriyor?

Eksik belgeler kırmızı badge ile gösterilir. Her belge satırında:
- Yeşil (✓) = bu dönem kayıt var
- Kırmızı (!) = kayıt yok

---

## Veritabanı Migrasyonu

4 yeni tablo: `daily_plans`, `annual_plans`, `sok_reports`, `notebook_checks`

Her tabloda:
- `school_id` foreign key (multi-tenant izolasyon)
- RLS policy: `school_id = current_school_id()`
- `teacher_id` = `auth.uid()` kontrolü (sadece kendi kayıtlarını görür/yazar)

---

## Domain Yapısı

```
src/domains/inspection/
  services/
    InspectionService.ts      # Dosya tamamlanma hesabı, PDF birleştirme
    AnnualPlanService.ts      # TYMM'den yıllık plan otomatik oluşturma
  repositories/
    InspectionRepository.ts   # 4 tablo CRUD
  types/
    index.ts
```

---

## Test Planı

- Unit: `AnnualPlanService` — TYMM konularını 40 haftaya yayma algoritması
- Unit: `InspectionService.getCompletionScore()` — tamamlanma yüzdesi hesabı
- E2E: Günlük plan oluştur → Dosyam sayfasında görünür → PDF indir
