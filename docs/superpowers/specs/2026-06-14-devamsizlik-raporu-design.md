# Spec: Devamsızlık Raporu Sayfası

**Tarih:** 2026-06-14  
**Durum:** Onaylandı

---

## Bağlam

Müdür ve müdür yardımcısı, MEB özürsüz devamsızlık sınırına (15 gün uyarı, 20 gün tehlike) yaklaşan öğrencileri tek ekranda görmek istiyor. Şu an bu bilgiye ulaşmak için her sınıfın yoklama çizelgesini tek tek açmak gerekiyor. Yeni sayfa tüm okulu tek sorguda özetler.

---

## Kapsam

- **Erişim:** Yalnızca `mudur` ve `mudur_yardimcisi` rolleri — diğer roller `redirect('/anasayfa')` alır.
- **Dönem:** `schoolYearStart()` tarihinden bugüne tüm devamsızlık kayıtları.
- **Görünüm:** Risk sırasına göre flat liste + 3 özet kart + Excel export.
- **Kapsam dışı:** Özür belgesi yükleme, SMS bildirimi, sayfa başına filtreleme.

---

## Veri Akışı

```
page.tsx (server component)
  └─ getCurrentProfile() → rol kontrolü (mudur/mudur_yardimcisi değilse redirect)
  └─ createClient() → attendance JOIN students(full_name, student_number, classes(name, grade))
       .eq('school_id', profile.school_id)
       .gte('date', schoolYearStart())
  └─ countAbsences(rows) → Record<student_id, AbsenceCount>
  └─ buildReportRows(counts, students) → RaporRow[] (unexcused DESC, sıfır olanlar hariç)
  └─ render: özet kartlar + tablo + DevamsizlikExcelButton
```

Excel endpoint aynı sorguyu bağımsız çalıştırır; page.tsx'ten veri paylaşımı yoktur.

---

## Pure Fonksiyonlar — `src/domains/attendance/lib/absenceReport.ts`

```typescript
export type RaporRow = {
  studentId:   string
  fullName:    string
  studentNo:   string | null
  className:   string
  unexcused:   number   // absent×1 + late×0.5
  excused:     number
  risk:        'tehlike' | 'uyari' | 'takip'
}

// Eşikler: ATTENDANCE_LIMIT_DAYS=20 → tehlike, ATTENDANCE_WARN_DAYS=15 → uyarı
export function getRisk(unexcused: number): 'tehlike' | 'uyari' | 'takip'

// unexcused === 0 && excused === 0 olanları filtreler, unexcused DESC sıralar
export function buildReportRows(
  counts:   Record<string, AbsenceCount>,
  students: StudentMeta[]  // { id, fullName, studentNo, className }
): RaporRow[]

// Excel satır formatı: gün sayısını "22g" / "1g" şeklinde stringe çevirir
export function buildExcelRows(rows: RaporRow[]): Record<string, unknown>[]
```

---

## Sayfa Görünümü — `/rapor/devamsizlik`

### Üst: Özet Kartlar (3 adet)

| Kart | Koşul | Renk |
|------|-------|------|
| Tehlikede | unexcused ≥ 20 | Kırmızı |
| Uyarıda | 15 ≤ unexcused < 20 | Sarı |
| Takipte | 0 < unexcused < 15 | Gri |

### Orta: Başlık + Excel Butonu

`<DevamsizlikExcelButton />` sağ üstte, `window.location.href = '/api/rapor/devamsizlik'` ile dosya indirir.

### Alt: Tablo

Kolonlar: Sıra · Ad Soyad · Sınıf · Özürsüz · Özürlü · Durum  
Sıralama: `unexcused DESC` (özürsüz eşit olanlarda `fullName ASC`)  
Durum badge: kırmızı (tehlike) · sarı (uyarı) · gri (takip)

Hiç devamsızlık yoksa boş durum mesajı: "Bu dönemde devamsızlık kaydı bulunmuyor."

---

## Dosyalar

### Yeni

| Dosya | Açıklama |
|-------|----------|
| `app/(dashboard)/rapor/devamsizlik/page.tsx` | Server component — veri çekimi + render |
| `app/(dashboard)/rapor/devamsizlik/DevamsizlikExcelButton.tsx` | `'use client'` — Excel indirme butonu |
| `app/api/rapor/devamsizlik/route.ts` | GET — ExcelJS ile `.xlsx` üretir, stream döner |
| `src/domains/attendance/lib/absenceReport.ts` | Pure fonksiyonlar: `getRisk`, `buildReportRows`, `buildExcelRows` |
| `tests/vitest/unit/attendance/absenceReport.test.ts` | ~15 test |
| `tests/vitest/unit/attendance/devamsizlikExcel.test.ts` | ~8 test |

### Değişen

| Dosya | Değişiklik |
|-------|-----------|
| `components/layout/Sidebar.tsx` | `navItems` dizisine 1 giriş: `href: '/rapor/devamsizlik'`, `roles: ['mudur', 'mudur_yardimcisi']`, `mobile: false` |

---

## Excel Export — `app/api/rapor/devamsizlik/route.ts`

- GET handler, `getCurrentProfile()` ile rol kontrolü (401 değil 403 redirect uygun değil → `NextResponse` ile 403 JSON)
- `buildExcelRows(rows)` çıktısını ExcelJS `Workbook` → `xlsx` buffer → `Response` ile döner
- Header: `Content-Disposition: attachment; filename="devamsizlik-raporu.xlsx"`
- Kolon başlıkları: Sıra, Ad Soyad, Numara, Sınıf, Özürsüz Gün, Özürlü Gün, Durum
- Header satırı bold + yeşil fill (`FFD9EAD3` — mevcut XlsxBuilder pattern'i)

---

## Testler

### `absenceReport.test.ts` (~15 test)

| Fonksiyon | Senaryo |
|-----------|---------|
| `getRisk()` | unexcused=14.5 → takip |
| `getRisk()` | unexcused=15 → uyarı |
| `getRisk()` | unexcused=19.5 → uyarı |
| `getRisk()` | unexcused=20 → tehlike |
| `buildReportRows()` | unexcused=0 && excused=0 → hariç |
| `buildReportRows()` | excused>0 ama unexcused=0 → dahil |
| `buildReportRows()` | unexcused DESC sıralama |
| `buildReportRows()` | eşit unexcused → fullName ASC |
| `buildReportRows()` | boş input → boş dizi |
| `buildReportRows()` | risk alanı doğru atanır |

### `devamsizlikExcel.test.ts` (~8 test)

| Fonksiyon | Senaryo |
|-----------|---------|
| `buildExcelRows()` | unexcused=22 → "22g" |
| `buildExcelRows()` | unexcused=1.5 → "1.5g" |
| `buildExcelRows()` | excused=0 → "0g" |
| `buildExcelRows()` | Durum sütunu Türkçe: "Tehlike" / "Uyarı" / "Takipte" |
| `buildExcelRows()` | Sıra 1'den başlar |
| `buildExcelRows()` | Boş liste → boş dizi |

---

## Dokunulmayacak Dosyalar

- `src/infrastructure/supabase/database.types.ts` — migration yok
- `proxy.ts` — değişiklik yok
- `src/domains/attendance/lib/attendanceMath.ts` — değişiklik yok (`countAbsences` olduğu gibi kullanılır)

---

## Doğrulama

1. `npx vitest run` → tüm testler yeşil
2. `npx tsc --noEmit` → 0 hata
3. `ogretmen` rolüyle `/rapor/devamsizlik` aç → `/anasayfa`'ya yönlendirilir
4. `mudur` rolüyle aç → tablo ve 3 özet kart görünür
5. Excel butonu → `devamsizlik-raporu.xlsx` indirilir, kolonlar ve veriler doğru
