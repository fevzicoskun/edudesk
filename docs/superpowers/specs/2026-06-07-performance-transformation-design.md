# EduDesk Performans Dönüşümü — Tasarım Dokümanı

**Tarih:** 2026-06-07  
**Kapsam:** Sayfa ilk açılışı, sayfalar arası geçiş, form kaydetme sonrası, dashboard widget hızı  
**Hedef:** "Çat çat açılan ekranlar" — hem algısal hem gerçek hız

---

## 1. Tespit Edilen Bottleneck'lar

### ① Yoklama — Çift Round Trip (En Yüksek Öncelik)

**Problem:** `YoklamaClient` mount olduktan sonra `getYoklama()` server action çağırıyor.

Mevcut akış:
```
Server render (sınıf listesi) → HTML → Hydrate → useEffect → getYoklama() → tablo dolar
```

Kullanıcı ~300-500ms boş tablo görüyor. En sık kullanılan özellik olduğu için etkisi yüksek.

**Çözüm:** Bugünün yoklamasını `yoklama/page.tsx`'de server-side pre-fetch et.

Yeni akış:
```
Server render (sınıf listesi + bugünün yoklaması) → HTML (tablo dolu) → Hydrate → anında görünür
```

### ② 6 Eksik `loading.tsx`

**Problem:** Şu rotalar skeleton olmadan açılıyor — eski sayfa takılı kalıyor:
- `/yonetim`
- `/yonetim/ogrenciler`
- `/kullanicilar`
- `/odevler/analitik`
- `/odevler/takvim`
- `/odevler/[id]/duzenle`

**Çözüm:** Her rota için sayfanın gerçek layout'unu yansıtan skeleton dosyası.

### ③ Kullanıcılar Sayfası — Duplicate Auth Round Trip

**Problem:** `kullanicilar/page.tsx` şu an:
```ts
const profile = await getCurrentProfile()  // cache'li, 1 Supabase round trip
const { data: { user } } = await supabase.auth.getUser()  // gereksiz 2. round trip!
```

**Çözüm:**
```ts
const user = await getCurrentUser()  // cache'den, sıfır ek maliyet
```

### ④ Ödev Detay — StatusBoard Tüm Sayfayı Bloke Ediyor

**Problem:** `odevler/[id]/page.tsx` öğrenci + submission + weekLoad verisi hazır olmadan hiçbir şey render etmiyor.

**Çözüm:** StatusBoard'u Suspense boundary içine al — ödev başlığı/bilgileri anında gelir, liste stream edilir.

---

## 2. Değiştirilecek Dosyalar

### Güncellemeler (4 dosya)

| Dosya | Değişiklik |
|-------|-----------|
| `app/(dashboard)/yoklama/page.tsx` | Bugünün yoklamasını Promise.all'a ekle, initialStatuses/initialDate prop geç |
| `app/(dashboard)/yoklama/YoklamaClient.tsx` | initialStatuses/initialDate prop al, dolu gelince loadYoklama skip |
| `app/(dashboard)/kullanicilar/page.tsx` | `supabase.auth.getUser()` → `getCurrentUser()` |
| `app/(dashboard)/odevler/[id]/page.tsx` | Suspense + StatusBoardLoader ekle, yalnızca hw fetch'i bırak |

### Yeni Bileşen (1 dosya)

| Dosya | İçerik |
|-------|--------|
| `app/(dashboard)/odevler/[id]/StatusBoardLoader.tsx` | Async server component: students/submissions/weekLoad fetch + StatusBoard render |

### Yeni Dosyalar (6 loading.tsx)

| Dosya | Skeleton İçeriği |
|-------|----------------|
| `app/(dashboard)/yonetim/loading.tsx` | 3 büyük kart + 2 tablo satırı |
| `app/(dashboard)/yonetim/ogrenciler/loading.tsx` | Arama bar + 8 satır liste |
| `app/(dashboard)/kullanicilar/loading.tsx` | Form + 5 kullanıcı satırı |
| `app/(dashboard)/odevler/analitik/loading.tsx` | 4 KPI kart + 2 grafik alanı |
| `app/(dashboard)/odevler/takvim/loading.tsx` | Takvim grid skeleton |
| `app/(dashboard)/odevler/[id]/duzenle/loading.tsx` | Form alanları skeleton |

---

## 3. Yoklama Pre-fetch Detayı

### `yoklama/page.tsx` değişikliği

```ts
// 1. Timezone-safe bugün
const todayISO = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())
const firstClassId = classes[0]?.id ?? ''

// 2. Mevcut Promise.all'a ekle (yeni bir await değil)
const [rawClasses, todayAttendanceRes] = await Promise.all([
  supabase.from('classes')...,
  firstClassId
    ? supabase.from('attendance')
        .select('student_id, status')
        .eq('class_id', firstClassId)
        .eq('school_id', profile.school_id)
        .eq('date', todayISO)
    : Promise.resolve({ data: [] }),
])

// 3. initialStatuses oluştur
const initialStatuses: Record<string, AttendanceStatus> = {}
for (const row of todayAttendanceRes.data ?? []) {
  initialStatuses[row.student_id] = row.status as AttendanceStatus
}
```

### `YoklamaClient.tsx` değişikliği

Props:
```ts
interface Props {
  classes: ClassWithStudents[]
  absenceCounts: Record<string, number>
  initialStatuses?: Record<string, AttendanceStatus>  // yeni
  initialDate?: string                                 // yeni
}
```

State init ve skip mantığı:
```ts
const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>(
  initialStatuses ?? {}
)
const [date, setDate] = useState(initialDate ?? todayISO())

// loadYoklama: initialStatuses dolu ve date aynıysa skip et
const initializedRef = useRef(!!initialStatuses && Object.keys(initialStatuses).length > 0)
useEffect(() => {
  if (initializedRef.current && date === (initialDate ?? todayISO())) {
    initializedRef.current = false  // sonraki değişiklikte normal yükle
    return
  }
  loadYoklama()
}, [loadYoklama])
```

**Önemli:** Boş yoklama günleri (yeni gün, hiç kayıt yok) için `initialStatuses = {}` geçilir — bu da skip sayılır. Mantık: boş object geçilmişse server "kayıt yok" demiş demektir, `loadYoklama` gereksiz.

---

## 4. StatusBoard Refactor Detayı

### Mevcut durum

`StatusBoard.tsx` 554 satır `'use client'` bileşeni — `useState`, `useTransition`, Excel export, interaktif submission güncelleme içeriyor. Async yapılamaz.

`odevler/[id]/page.tsx` şu an:
1. `hw` fetch (access control için)
2. 4 paralel sorgu: students, submissions, otherHw, weekLoad
3. 1 sequential sorgu: cumulativeSubs (otherHomeworkIds'e bağımlı)
4. `items` array oluştur → `<StatusBoard items={items} ... />`

Tüm bu işlemler tamamlanmadan sayfa render edilmiyor.

### Hedef durum — Wrapper Pattern

**Yeni dosya: `StatusBoardLoader.tsx`** (async server component)
```ts
// 'use server' değil, sadece async — server component
import { createClient } from '@/src/infrastructure/supabase/server'
import { getClassWeekLoad } from '@/app/actions/homework'
import StatusBoard from './StatusBoard'

export default async function StatusBoardLoader({
  homeworkId, classId, dueDate, schoolId, canWrite,
  homeworkTitle, className: cls,
}: {
  homeworkId: string
  classId: string
  dueDate: string | null
  schoolId: string
  canWrite: boolean
  homeworkTitle?: string
  className?: string
}) {
  const supabase = await createClient()

  // 4 paralel sorgu (aynı mantık page.tsx'ten taşınıyor)
  const [studentsResult, subsResult, otherHwRes, weekLoadResult] = await Promise.all([...])

  // cumulativeSubs sequential (otherHomeworkIds gerekli)
  const cumulativeResult = ...

  // items array oluştur
  const items: StatusItem[] = ...

  return (
    <StatusBoard
      homeworkId={homeworkId}
      items={items}
      homeworkTitle={homeworkTitle}
      totalHomeworks={totalHomeworkCount}
      classId={classId}
      dueDate={dueDate ?? ''}
      className={cls}
      weekLoad={weekLoad}
    />
  )
}
```

**`StatusItem` tipi:** StatusBoard.tsx'ten export edilecek (`export type StatusItem = { ... }`).

**`odevler/[id]/page.tsx` sonrası:**
```ts
// Sadece hw fetch kalır (access control için gerekli)
const { data: hw } = await supabase.from('homeworks').select('*, classes(name)')...
if (!hw) notFound()

// StatusBoardLoader Suspense içinde stream edilir
<Suspense fallback={<StatusBoardSkeleton />}>
  <StatusBoardLoader
    homeworkId={id}
    classId={hw.class_id}
    dueDate={hw.due_date}
    schoolId={profile.school_id}
    canWrite={canWrite}
    homeworkTitle={hw.title}
    className={(hw.classes as { name: string } | null)?.name}
  />
</Suspense>
```

`StatusBoardSkeleton` page.tsx içinde inline tanımlanır (animate-pulse tablo satırları).

**Sonuç:** Ödev başlığı/metadata ~80ms'de render. StatusBoard skeleton gösterir, list ~300ms'de stream edilir.

---

## 5. Skeleton Tasarım Kararları

Mevcut proje skeleton deseni (anasayfa ve siniflar'dan alınan):
```tsx
<div className="animate-pulse rounded-xl bg-gray-100 dark:bg-slate-800 h-XX" />
```

Her loading.tsx gerçek sayfanın grid/layout yapısını taklit eder — tek bir büyük dikdörtgen değil, gerçek içerik şekli. Bu "content shift" hissini azaltır.

---

## 6. Test Planı

| Değişiklik | Test |
|-----------|------|
| Yoklama pre-fetch | Yoklama sayfasını aç → tablo anında dolu mu? (network tab'da getYoklama çağrısı olmamalı) |
| Sınıf değiştirme | YoklamaClient'ta sınıf değiştir → hâlâ getYoklama çağrılıyor mu? |
| Tarih değiştirme | Farklı tarih seç → getYoklama çağrılıyor mu? |
| loading.tsx | 6 rotayı ziyaret et → skeleton görünüyor mu? |
| Kullanıcılar | Kullanıcılar sayfası hâlâ açılıyor mu, users listesi geliyor mu? |
| Ödev detay | StatusBoard skeleton görünüyor mu, sonra liste geliyor mu? |
| Mevcut testler | `npm run test` — 261 test geçmeli |

---

## 7. Kapsam Dışı

Aşağıdakiler bu sprint'e dahil değil:
- Optimistic UI (ödev status update, öğrenci ekleme)
- Sidebar prefetch hint'leri
- Service Worker / offline cache
- Image/font optimizasyonu
