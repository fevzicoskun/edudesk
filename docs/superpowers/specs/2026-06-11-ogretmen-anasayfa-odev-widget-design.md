# Öğretmen Anasayfası — Ödev Tamamlanma Widget Yenileme

**Tarih:** 2026-06-11
**Kapsam:** Devamsızlık Trendi kaldır; Ödev Tamamlanma grafiğini tam genişliğe al, sınıf tab filtresi + gerçek sayılar + tıklanabilir bar ekle.

---

## Özet

| Değişiklik | Açıklama |
|---|---|
| `YoklamaTrendWidget` + `YoklamaTrendChart` | Dosyalar **siliniyor** |
| `OdevTamamlanmaWidget` | Tam genişlik; sınıf tab'ları; dinamik alt başlık |
| `OdevTamamlanmaChart` | Tıklanabilir bar; gerçek sayı tooltip |
| `TeacherDashboardService` | `tamamlanmaData` genişletildi; trend bloğu + DB sorgusu kaldırıldı |
| `types.ts` | `OdevTamamlanmaItem` yeni alanlar; `YoklamaTrendItem` ve `yoklamaTrendData` silindi |
| `OgretmenDashboard` | Grid kaldırıldı, widget tam genişlik |

---

## 1. Tip Değişiklikleri — `src/domains/dashboard/types.ts`

### `OdevTamamlanmaItem` (güncelleniyor)

```ts
export type OdevTamamlanmaItem = {
  id:           string   // homework id — /odevler/[id] linki
  title:        string   // maks 14 karakter, truncated
  classId:      string   // client-side tab filtresi
  className:    string   // tab label
  yapildi:      number   // % (0-100)
  eksik:        number   // %
  diger:        number   // %
  yapildiCount: number   // gerçek tamamlayan öğrenci sayısı
  total:        number   // toplam submission sayısı
}
```

### Silinen tipler

- `YoklamaTrendItem` — tamamen kaldırılıyor
- `DashboardMetrics.yoklamaTrendData` alanı — kaldırılıyor

---

## 2. Service Değişiklikleri — `TeacherDashboardService.ts`

### Import satırı

`YoklamaTrendItem` importdan çıkarılır. Kalan: `OdevTamamlanmaItem`, `DashboardMetrics`, `RiskAlert`, `ClassSummary`, `HomeworkLite`, `YoklamaDurumItem`.

### `getDashboardMetrics` içindeki değişiklikler

**Kaldırılan değişken:**
```ts
// SİL:
const eightWeeksAgo = turkeyDate(subDays(new Date(), 56))
```

**`Promise.all` bloğu** (satır 181-185): `trendResult` kaldırılır:
```ts
// ESKİ:
const [weeklyResult, trendResult, todayAttResult] = await Promise.all([
  DashboardRepository.getWeeklySubmissionStats(hwIds, weekStart),
  DashboardRepository.getAttendanceTrend(classIds, eightWeeksAgo),
  DashboardRepository.getTodayClassAttendance(classIds, today),
])

// YENİ:
const [weeklyResult, todayAttResult] = await Promise.all([
  DashboardRepository.getWeeklySubmissionStats(hwIds, weekStart),
  DashboardRepository.getTodayClassAttendance(classIds, today),
])
```

**`trendRows` satırı silinir** (artık kullanılmıyor).

**`tamamlanmaData` bloğu** (satır 202-224) yeniden yazılır:

```ts
// Ödev tamamlanma chart: sınıf başına son 6 geçmiş ödev
const pastHwByClass = new Map<string, typeof homeworks>()
for (const hw of homeworks) {
  if (hw.due_date > today) continue
  const list = pastHwByClass.get(hw.class_id) ?? []
  if (list.length < 6) {
    list.push(hw)
    pastHwByClass.set(hw.class_id, list)
  }
}
// homeworks due_date DESC sıralı gelir; düz kopyalar da DESC
// Her sınıfın son 6'sını birleştir
const pastHws = [...pastHwByClass.values()].flat()

const subByHw = new Map<string, { yapildi: number; eksik: number; diger: number; toplam: number }>()
for (const hw of pastHws) subByHw.set(hw.id, { yapildi: 0, eksik: 0, diger: 0, toplam: 0 })
for (const s of submissions) {
  const e = subByHw.get(s.homework_id)
  if (!e) continue
  e.toplam++
  if      (s.status === 'yapildi') e.yapildi++
  else if (s.status === 'eksik')   e.eksik++
  else                             e.diger++
}

const tamamlanmaData: OdevTamamlanmaItem[] = pastHws
  .sort((a, b) => a.due_date.localeCompare(b.due_date))  // eskiden yeniye (grafik için)
  .map(hw => {
    const s = subByHw.get(hw.id) ?? { yapildi: 0, eksik: 0, diger: 0, toplam: 0 }
    const t = s.toplam
    const title = hw.title.length > 14 ? hw.title.slice(0, 13) + '…' : hw.title
    return {
      id:           hw.id,
      title,
      classId:      hw.class_id,
      className:    hw.classes?.name ?? '—',
      yapildi:      t > 0 ? Math.round((s.yapildi / t) * 100) : 0,
      eksik:        t > 0 ? Math.round((s.eksik   / t) * 100) : 0,
      diger:        t > 0 ? Math.round((s.diger   / t) * 100) : 0,
      yapildiCount: s.yapildi,
      total:        t,
    }
  })
```

**Yoklama trend bloğu** (satır 226-242) tamamen silinir.

**Return nesnesi:** `yoklamaTrendData` satırı kaldırılır.

---

## 3. `OdevTamamlanmaWidget.tsx` — yeniden yazılır

`'use client'` direktifi kalır. `useRouter` importu eklenir. Yeni mantık:

**Tab ve subtitle hesabı (pure, bileşen içinde):**

```
classes: OdevTamamlanmaItem[]'den unique classId+className listesi, className'e göre sıralı
selectedClass: string state ('' = Tümü)

filteredData:
  - selectedClass === '' → son 8 item (data.slice(-8))
  - seçili class → data.filter(d => d.classId === selectedClass)

subtitle hesabı (filteredData üzerinden):
  - count = filteredData.length
  - avgPct = count > 0 ? Math.round(toplam yapildi% / count) : 0
  - totalDone = sum(d.yapildiCount)
  - totalStudents = sum(d.total)
  - classLabel = selectedClass === '' ? 'Tüm sınıflar' : seçili className
  - subtitle = `Son ${count} ödev · ${classLabel} · ort. %${avgPct} · ${totalDone}/${totalStudents} öğrenci`
  - totalStudents === 0 ise subtitle = `Son ${count} ödev · ${classLabel}` (henüz submission yok)
```

**Render:**

```
<Card>
  <CardHeader>
    <CardTitle>Ödev Tamamlanma Oranları</CardTitle>
    <p className="text-xs text-gray-400">{subtitle}</p>
  </CardHeader>

  {/* Tab butonları — sınıf sayısı > 1 ise göster */}
  {classes.length > 1 && (
    <div className="px-4 pb-2 flex gap-1 flex-wrap">
      <TabButton id="" label="Tümü" selected={selectedClass} onSelect={setSelectedClass} />
      {classes.map(c => (
        <TabButton key={c.classId} id={c.classId} label={c.className} selected={selectedClass} onSelect={setSelectedClass} />
      ))}
    </div>
  )}

  <CardContent>
    {filteredData.length === 0 ? (
      <p>Geçmiş ödev bulunamadı.</p>
    ) : (
      <OdevTamamlanmaChart data={filteredData} />
    )}
  </CardContent>
</Card>
```

**`TabButton`** — bileşen içi küçük bileşen (dışa export edilmez):
```tsx
function TabButton({ id, label, selected, onSelect }: { id: string; label: string; selected: string; onSelect: (id: string) => void }) {
  const active = selected === id
  return (
    <button
      onClick={() => onSelect(id)}
      className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
        active
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700 hover:border-blue-400'
      }`}
    >
      {label}
    </button>
  )
}
```

---

## 4. `OdevTamamlanmaChart.tsx` — güncellenir

**`DataPoint` tipi:**
```ts
type DataPoint = { id: string; title: string; yapildi: number; eksik: number; diger: number; yapildiCount: number; total: number }
```

**Router + click handler:**
```ts
import { useRouter } from 'next/navigation'
const router = useRouter()
```

**`BarChart` props'una click ekle:**
```tsx
<BarChart
  data={data}
  onClick={(payload) => {
    const id = payload?.activePayload?.[0]?.payload?.id as string | undefined
    if (id) router.push(`/odevler/${id}`)
  }}
  style={{ cursor: 'pointer' }}
  ...
>
```

**Tooltip `formatter`** gerçek sayıları gösterir:
```ts
formatter={(value, name, props) => {
  const p = props.payload as DataPoint
  const label = LABEL[String(name)] ?? String(name)
  if (String(name) === 'yapildi' && p.total > 0) {
    return [`%${value} (${p.yapildiCount}/${p.total})`, label] as [string, string]
  }
  return [`%${value}`, label] as [string, string]
}}
```

---

## 5. `OgretmenDashboard.tsx` — layout güncellenir

**Kaldırılanlar:**
```ts
// SİL:
import YoklamaTrendWidget from './YoklamaTrendWidget'
```

**Grid → full-width (satır 107-111):**
```tsx
// ESKİ:
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
  <YoklamaTrendWidget data={metrics.yoklamaTrendData} />
  <OdevTamamlanmaWidget data={metrics.tamamlanmaData} />
</div>

// YENİ:
<div className="mb-4">
  <OdevTamamlanmaWidget data={metrics.tamamlanmaData} />
</div>
```

---

## 6. Silinen dosyalar

- `app/(dashboard)/anasayfa/YoklamaTrendWidget.tsx`
- `app/(dashboard)/anasayfa/YoklamaTrendChart.tsx`

---

## Test Planı

Mevcut test suite'inde bu bileşenleri kapsayan birim testi yok. Aşağıdakiler manuel doğrulanır:

1. `npx tsc --noEmit` — 0 hata
2. `npm run test:unit` — mevcut 409 test geçiyor (tip değişikliği regresyon yok)
3. `npm run build` — production build başarılı
4. Manuel: `/anasayfa` açılıyor, `YoklamaTrendWidget` yok, `OdevTamamlanmaWidget` tam genişlik
5. Manuel: Birden fazla sınıf varsa tab'lar görünüyor, seçim çalışıyor
6. Manuel: Bar'a tıklayınca doğru ödev detayı açılıyor
7. Manuel: Tooltip'te `%72 (15/23)` formatında gösteriyor

---

## Kapsam Dışı

- Yoklama trend datasının başka bir sayfada gösterilmesi
- Grafik boyutunu değiştirme
- Animasyon veya geçiş efektleri
