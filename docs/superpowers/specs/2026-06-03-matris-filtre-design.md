# Sınıf Ödev Matrisi Filtre ve Sıralama — Tasarım Dokümanı

**Tarih:** 2026-06-03  
**Kapsam:** `/odevler/sinif/[classId]` sayfasına öğrenci arama + tamamlanma sıralaması

---

## 1. Mimari

`page.tsx` değişmeden veri çekmeye devam eder. Yeni `MatrisClient.tsx` client bileşeni oluşturulur. Server tüm öğrenci, ödev ve submission verisini prop olarak geçer. Filtre/sıralama tamamen client-side — ek DB sorgusu yok.

**Etkilenen dosyalar:**
- `app/(dashboard)/odevler/sinif/[classId]/page.tsx` — `MatrisClient`'ı import edip veri geçmek için minimal değişiklik
- `app/(dashboard)/odevler/sinif/[classId]/MatrisClient.tsx` — yeni client bileşeni (tablo rendering + filtre + sıralama)

---

## 2. UI Kontrolleri

Tablonun üstüne iki kontrol eklenir:

**Arama kutusu:**
- Öğrenci adı veya numarasına göre anlık filtre
- 6+ öğrenci varsa gösterilir (StatusBoard pattern ile tutarlı)
- Temizleme (×) butonu
- Aktif filtre varsa: "5 / 28 öğrenci gösteriliyor" bilgisi

**Sıralama dropdown:**
- "Numara sırası" (varsayılan — mevcut davranış)
- "Tamamlanma ↓ (en başarılı önce)"
- "Tamamlanma ↑ (en riskli önce)"

**Footer satırı (Sınıf ortalaması):** Arama/sıralamadan etkilenmez, her zaman tüm sınıfı gösterir.

---

## 3. State ve Veri Akışı

`MatrisClient.tsx`'te iki state:
```ts
const [search, setSearch]   = useState('')
const [sortBy, setSortBy]   = useState<'number' | 'pct_desc' | 'pct_asc'>('number')
```

`subMap` server'dan `Record<string, SubmissionStatus>` olarak prop geçirilir.

Her render'da doğrudan türetme (useMemo gerekmez — 30×30 = 900 hücre):
1. `filteredStudents` — `search` varsa `full_name` veya `student_number` içeriyor mu kontrolü
2. `sortedStudents` — `sortBy`'a göre sırala:
   - `'number'` → `student_number` ASC (null'lar sona)
   - `'pct_desc'` → `studentStats().pct` DESC (null'lar sona)
   - `'pct_asc'` → `studentStats().pct` ASC (null'lar sona)
3. Tablo `sortedStudents` üzerinden render edilir

`studentStats()` ve `homeworkStats()` fonksiyonları `page.tsx`'ten `MatrisClient.tsx`'e taşınır.

---

## 4. Props Arayüzü

```ts
type Props = {
  cls:       { name: string; grade: number }
  students:  { id: string; full_name: string; student_number: string | null }[]
  homeworks: { id: string; title: string; subject: string; due_date: string | null }[]
  subMap:    Record<string, SubmissionStatus>  // key: `${studentId}_${homeworkId}`
}
```

`page.tsx`'te `subMap` build edilip `MatrisClient`'a geçilir. `students.length` ve `homeworks.length` zaten hesaplı.

---

## Kapsam Dışı

- Ödev kolonlarına göre sıralama (YAGNI)
- Ödev sayısı limiti değişikliği (hâlâ 30)
- Pagination
- Sıralama/arama URL'e yazılması
