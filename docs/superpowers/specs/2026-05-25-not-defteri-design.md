# Not Defteri — Tasarım Dokümanı

**Tarih:** 2026-05-25  
**Proje:** EduDesk (myedudesk.com.tr)  
**Durum:** Onaylandı — uygulamaya hazır

---

## Bağlam

EduDesk'te öğrenci risk sinyalleri (devamsızlık + ödev) mevcuttur, ancak öğretmenin kendi sınav, quiz ve proje notlarını girebileceği kişisel bir not defteri yoktur. Mevcut `exam_entries` tablosu yalnızca zümre başkanı tarafından yönetilen ortak sınavlar içindir. Bu boşluk, öğretmenlerin not verilerini harici araçlarda (Excel, kağıt) tutmasına yol açmaktadır.

**Amaç:** Öğretmene kendi sınıfları için tablo tabanlı bir not defteri sunmak — yazılı, quiz ve proje notlarını tek yerde tutsun, dilediğinde Excel'e aktarsın.

---

## Kapsam Dışı

- Otomatik dönem sonu notu hesaplama (öğretmen bu değerlendirmeyi kendisi yapar)
- Ağırlıklı ortalama
- Sözlü notu (ilk versiyon)
- Öğrenci veya veli erişimi

---

## Veri Modeli

### `grade_columns` — Her ölçme (sütun)

```sql
id          uuid PK
teacher_id  uuid FK profiles(id)
class_id    uuid FK classes(id)
school_id   uuid FK schools(id)
title       text NOT NULL          -- "Yazılı 1", "Quiz 3"
grade_type  text NOT NULL          -- 'yazili' | 'quiz' | 'proje'
max_score   smallint DEFAULT 100
exam_date   date
created_at  timestamptz DEFAULT now()
```

**RLS:** `teacher_id = auth.uid()` veya `school_id = current_school_id()` ve rol ≥ müdür yardımcısı (okuma).

### `grade_entries` — Her öğrencinin puanı

```sql
id               uuid PK
grade_column_id  uuid FK grade_columns(id) ON DELETE CASCADE
student_id       uuid FK students(id) ON DELETE CASCADE
school_id        uuid FK schools(id)
score            numeric(5,1)   -- NULL = henüz girilmedi
updated_at       timestamptz DEFAULT now()
UNIQUE(grade_column_id, student_id)
```

**RLS:** `school_id = current_school_id()` — öğretmen yazar, müdür/MY okur.

---

## Sayfa Yapısı

### `/not-defteri/` (index)

- Öğretmenin sınıflarını kart olarak listeler
- Müdür/MY için tüm öğretmenlere ait sınıf listesi (salt okunur)
- Her kartta: sınıf adı, öğrenci sayısı, ölçme sayısı

### `/not-defteri/[classId]/`

Spreadsheet grid:

```
┌─────────────────┬──────────────┬──────────┬─────────┬───┐
│ Öğrenci         │ 🔵 Yazılı 1  │ 🟡 Quiz 1│ 🟢Proje │ + │
│                 │  15 Mart/100 │  22 Mart │ 30 Mart │   │
├─────────────────┼──────────────┼──────────┼─────────┼───┤
│ Ahmet Yılmaz    │     85       │    70    │         │   │
│ Ayşe Kaya       │     92       │    88    │   95    │   │
│ Mehmet Öztürk   │              │    65    │         │   │
├─────────────────┼──────────────┼──────────┼─────────┼───┤
│ Sınıf ort.      │    88.5      │   74.3   │   95.0  │   │
└─────────────────┴──────────────┴──────────┴─────────┴───┘
```

**Etkileşimler:**
- Öğrenci kolonu sabit (sticky left, yatay scroll'da kaybolmaz)
- Hücreye tıklama → inline input (type="number", min=0, max=max_score)
- Enter veya Tab → sonraki hücreye geç
- Boşluk bırakma → NULL (girilmedi)
- `onBlur` + debounce → `upsertScore` server action (optimistic UI)
- Sütun başlığı: sağ tık veya üç nokta → Düzenle / Sil
- `[+]` butonu → `AddColumnModal` (başlık, tür, tarih, max_score)
- Sütun ortalaması satırı: girilmiş notların ortalaması (boş hücreler hariç)
- **Excel Export** butonu — mevcut `XlsxBuilder` pattern'i kullanır

---

## Dosya Yapısı

**Yeni dosyalar:**

```
supabase/migrations/
  XXXX_create_grade_columns.sql
  XXXX_create_grade_entries.sql

src/domains/grades/
  types.ts            → GradeColumn, GradeEntry, GradeType
  service.ts          → GradeService: getColumns, getEntriesForClass, upsertEntry
  actions.ts          → addColumn, updateColumn, deleteColumn, upsertScore

app/(dashboard)/not-defteri/
  page.tsx            → Server component, sınıf listesi
  [classId]/
    page.tsx          → Server component, veri çeker ve GradeGrid'e geçer
    GradeGrid.tsx     → Client component (interaktif tablo)
    AddColumnModal.tsx → Yeni ölçme oluşturma formu
    ExportButton.tsx  → XlsxBuilder çağırır
```

**Değişecek dosyalar:**

| Dosya | Değişiklik |
|-------|-----------|
| `components/layout/Sidebar.tsx` | "Not Defteri" linki ekle (Ödevler ile Yoklama arasında) |
| `src/shared/permissions/index.ts` | `grades.read` + `grades.write` izinleri ekle |
| `src/domains/export/` | `buildGradeSheetXlsx()` metodu ekle |

---

## İzin Matrisi

| Rol | grade_columns | grade_entries |
|-----|--------------|---------------|
| Öğretmen (kendi sınıfları) | Yazar | Yazar |
| Zümre Başkanı (kendi branşı) | Okur | Okur |
| Müdür Yardımcısı | Okur (tüm) | Okur (tüm) |
| Müdür | Okur (tüm) | Okur (tüm) |

---

## Doğrulama

1. Yeni migration'ları `supabase db push` ile uygula
2. Öğretmen olarak giriş yap → Not Defteri → sınıf seç
3. `+` ile "Yazılı 1" oluştur → tüm öğrenciler için not gir
4. Sayfayı yenile → notlar kalıcı mı?
5. Sütun sil → ilgili `grade_entries` CASCADE ile siliniyor mu?
6. Müdür olarak giriş yap → Not Defteri → salt okunur mu?
7. Excel export → tüm sütun ve notlar doğru mu?
8. `npm run test` — mevcut 70 test hâlâ geçiyor mu?
