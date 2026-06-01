# Öğrenci Ödev Profili — Design Spec

**Tarih:** 2026-06-02  
**Durum:** Onaylandı

---

## Özet

Her öğrenci için dönem boyunca atanan tüm ödevlerin durumunu gösteren bir modal dialog. StatusBoard'daki öğrenci adına tıklanarak ve öğrenci yönetim sayfasındaki "Ödev Sicili" butonuyla açılır.

---

## Erişim Noktaları

1. **StatusBoard** (`app/(dashboard)/odevler/[id]/StatusBoard.tsx`) — öğrenci satırında ada tıklanabilirlik eklenir.
2. **Öğrenci yönetim sayfası** (`app/(dashboard)/yonetim/ogrenciler/page.tsx`) — öğrenci kartına "Ödev Sicili" butonu eklenir.

---

## Veri Katmanı

### Server Action: `getStudentHomeworkProfile`

**Konum:** `app/actions/homework.ts`  
**İmza:**
```ts
async function getStudentHomeworkProfile(
  studentId: string,
  classId: string
): Promise<{ student: StudentInfo; homeworks: HomeworkRecord[]; stats: Stats } | { error: string }>
```

**Sorgular (paralel):**
- Öğrenci bilgisi: `students` tablosundan `full_name, student_number, veli_ad, veli_telefon`
- Tüm dönem ödevleri: `homeworks` + `homework_submissions` LEFT JOIN, `class_id` filtresi, `is_template = false`, `deleted_at IS NULL`
- RBAC: `getAbility()` ile `schoolId` kontrolü (school_id izolasyonu)

**Dönen tipler:**
```ts
type StudentInfo = {
  full_name: string
  student_number: string | null
  veli_ad: string | null
  veli_telefon: string | null
}

type HomeworkRecord = {
  id: string
  title: string
  subject: string
  due_date: string
  status: SubmissionStatus  // yapildi | eksik | yapilmadi | gec | mazeretli
  note: string | null
}

type Stats = {
  total: number
  yapildi: number
  eksik: number
  yapilmadi: number
  gec: number
  mazeretli: number
  completionRate: number  // 0-100; hesap: yapildi / (total - mazeretli), mazeretliler hariç tutulur
}
```

---

## UI Bileşeni

### `StudentHomeworkProfileModal.tsx`

**Konum:** `app/(dashboard)/odevler/[id]/StudentHomeworkProfileModal.tsx`  
**Tip:** Client bileşeni  
**State:**
- `isOpen: boolean`
- `isLoading: boolean`
- `data: ProfileData | null`
- `error: string | null`

**Açılış akışı:**
1. Öğrenci adına tıklanır → `isOpen = true`, server action çağrılır
2. Loading spinner gösterilir
3. Veri gelince modal içi render edilir

**Modal düzeni:**

```
┌────────────────────────────────────────────────┐
│  Ahmet Yılmaz  · No: 12             [×]        │
│  Veli: Mehmet Yılmaz  ·  [WhatsApp ↗]          │
├────────────────────────────────────────────────┤
│  [14 Ödev]  [10 Yapıldı]  [2 Eksik]  [2 Yok]  │
│  Tamamlanma %71  ████████░░                    │
├────────────────────────────────────────────────┤
│  Matematik Testleri    ● Yapıldı    05 Haz      │
│  Türkçe Okuma Ödevi    ● Eksik      01 Haz      │
│  Fen Lab Raporu        ● Yapılmadı  28 May      │
│  ...                                            │
└────────────────────────────────────────────────┘
```

**Ödev listesi sıralaması:** `due_date DESC` (en yeni önce)  
**Renk kodlaması:** Mevcut `STYLES` nesnesiyle (yapildi→yeşil, eksik→sarı, yapilmadi→kırmızı, gec→turuncu, mazeretli→gri)  
**WhatsApp linki:** `https://wa.me/90${telefon}` formatı — rakam dışı karakterler (`+`, boşluk, `-`) ve baştaki `0` kaldırılır; `veli_telefon` null ise link gösterilmez

---

## Öğrenci Yönetim Sayfası Entegrasyonu

`StudentHomeworkProfileModal` bileşeni `yonetim/ogrenciler/page.tsx`'e de eklenir. Her öğrenci kartında "Ödev Sicili" butonu → modalı aynı şekilde açar.

`classId` öğrencinin `class_id` alanından gelir.

---

## Mimari Kararlar

- **Neden server action fetch, pre-load değil?** StatusBoard'da 30+ öğrenci olabilir; hepsinin dönem ödev geçmişini önceden çekmek gereksiz payload. Modal açılışında lazy fetch daha verimli.
- **Neden parallel routes değil?** EduDesk'te parallel routes kullanılmıyor; URL state yönetimi ek karmaşıklık getirir. Modal state tamamen client-side.
- **RBAC:** `getAbility()` action içinde çağrılır, `school_id` filtresi zorunlu. Öğretmen yalnızca kendi okul öğrencilerini görebilir.

---

## Test Kapsamı

- Unit: `getStudentHomeworkProfile` — boş ödev, tüm durum tipleri, school_id izolasyonu
- Manuel: StatusBoard'dan açılış, öğrenci yönetiminden açılış, WhatsApp linki, loading/error state
