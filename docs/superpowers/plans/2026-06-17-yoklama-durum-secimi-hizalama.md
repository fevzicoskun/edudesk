# Yoklama Durum Seçimi Hizalama — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Yoklamadaki döngüsel tek-buton durum seçimini, her durumun tek tıkla seçildiği 4 ayrı butona çevirmek (ödev `StudentRow` deseni).

**Architecture:** İki dosya değişir; veri akışı, kaydetme, bildirim ve kilit mantığı aynen kalır. `YoklamaClient` döngüsel `toggle(id)` yerine doğrudan `setStatus(id, status)` sağlar; `YoklamaStudentPanel` öğrenci satırını dikey düzene alıp 4 durum butonu render eder.

**Tech Stack:** Next.js App Router (non-standard sürüm — middleware `proxy.ts`), React 19, Tailwind v4, TypeScript, Vitest (`environment: node`).

## Global Constraints

- `school_id` her sorguda — bu değişiklikte DB sorgusu yok, geçerli değil ama kural sabit.
- Component testi altyapısı yok (RTL kurulu değil, vitest `node`). Bu sunum-katmanı değişikliğine yeni otomatik test EKLENMEZ; doğrulama `npm run build` + mevcut action testi + manuel.
- İki dosya prop imzasıyla (`toggle` → `setStatus`) birbirine bağımlı → tek atomik commit (ara durum derlenmez).
- Durum sırası ve etiketleri: `present`=Mevcut, `absent`=Devamsız, `late`=Geç, `excused`=Özürlü (mevcut `STATUS_LABELS`/`STATUS_COLORS`'tan).

---

### Task 1: Etkileşimi ödev desenine hizala

**Files:**
- Modify: `app/(dashboard)/yoklama/YoklamaClient.tsx` (satır 151-163 `toggle`, 295 prop geçişi, 310-312 açıklama metni)
- Modify: `app/(dashboard)/yoklama/YoklamaStudentPanel.tsx` (props imzası, satır düzeni 78-118)

**Interfaces:**
- Produces: `YoklamaStudentPanel` artık `setStatus: (studentId: string, status: AttendanceStatus) => void` prop'u alır (`toggle: (studentId: string) => void` yerine). `setStatuses`, `onDirty`, diğer tüm prop'lar aynen kalır.

- [ ] **Step 1: `YoklamaClient` — `toggle`'ı `setStatus` ile değiştir**

`app/(dashboard)/yoklama/YoklamaClient.tsx` içinde şu bloğu (satır ~151-163):

```tsx
  function toggle(studentId: string) {
    if (isLocked) return
    isDirty.current = true
    setStatuses(prev => {
      const cur = prev[studentId] ?? 'present'
      const next: AttendanceStatus =
        cur === 'present' ? 'absent'
        : cur === 'absent' ? 'late'
        : cur === 'late'   ? 'excused'
        :                    'present'
      return { ...prev, [studentId]: next }
    })
  }
```

şununla değiştir:

```tsx
  function setStatus(studentId: string, status: AttendanceStatus) {
    if (isLocked) return
    isDirty.current = true
    setStatuses(prev => ({ ...prev, [studentId]: status }))
  }
```

- [ ] **Step 2: `YoklamaClient` — prop geçişini güncelle**

Aynı dosyada `<YoklamaStudentPanel ... />` içindeki (satır ~295):

```tsx
        toggle={toggle}
```

satırını şununla değiştir:

```tsx
        setStatus={setStatus}
```

- [ ] **Step 3: `YoklamaClient` — geçersiz kalan döngü açıklamasını kaldır**

Kaydet butonunun altındaki şu paragrafı (satır ~310-312) **tamamen sil** (döngü kalktığı için artık yanlış):

```tsx
        <p className="text-xs text-gray-400 dark:text-slate-500 text-center mt-1.5">
          Butona her tıklayınca: Mevcut → Devamsız → Geç → Özürlü → Mevcut
        </p>
```

- [ ] **Step 4: `YoklamaStudentPanel` — kısa etiket sabiti ekle**

`app/(dashboard)/yoklama/YoklamaStudentPanel.tsx` içinde `STATUS_COLORS` tanımının hemen altına ekle:

```tsx
const STATUS_SHORT: Record<AttendanceStatus, string> = {
  present: 'Mevcut',
  absent:  'Dev.',
  late:    'Geç',
  excused: 'Özür.',
}
```

- [ ] **Step 5: `YoklamaStudentPanel` — props imzasını güncelle**

Bileşen imzasındaki `toggle` prop'unu `setStatus` ile değiştir. Destructure satırında:

```tsx
  loading, students, isLocked, onDirty, statuses, setStatuses, absenceCounts, statusSummary, toggle,
```

→

```tsx
  loading, students, isLocked, onDirty, statuses, setStatuses, absenceCounts, statusSummary, setStatus,
```

Tip bloğunda:

```tsx
  toggle: (studentId: string) => void
```

→

```tsx
  setStatus: (studentId: string, status: AttendanceStatus) => void
```

- [ ] **Step 6: `YoklamaStudentPanel` — `<li>` satır düzenini değiştir**

Mevcut `<li>` bloğunu (satır ~82-115; solda isim, sağda tek döngü butonu) komple şununla değiştir:

```tsx
                <li key={s.id} className="px-4 py-2.5">
                  <div className="flex items-center gap-1 min-w-0 mb-2">
                    <span className="text-gray-400 dark:text-slate-500 mr-2 tabular-nums shrink-0 text-sm">{i + 1}.</span>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-gray-900 dark:text-slate-100 truncate text-sm">{s.full_name}</span>
                      {(() => {
                        const c = absenceCounts[s.id]
                        if (!c) return null
                        const danger = c.unexcused >= ATTENDANCE_LIMIT_DAYS
                        const warn   = c.unexcused >= ATTENDANCE_WARN_DAYS
                        return (
                          <Tooltip content={`Özürsüz: ${c.unexcused} gün · Özürlü: ${c.excused} gün (MEB sınırı ${ATTENDANCE_LIMIT_DAYS} gün)`}>
                            <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                              danger ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                              : warn  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                              :         'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
                            }`}>
                              {formatAbsenceBadge(c)}
                            </span>
                          </Tooltip>
                        )
                      })()}
                    </div>
                    {s.student_number && <span className="ml-1.5 text-xs text-gray-400 shrink-0">#{s.student_number}</span>}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['present', 'absent', 'late', 'excused'] as AttendanceStatus[]).map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setStatus(s.id, opt)}
                        disabled={isLocked}
                        className={`min-h-[44px] px-2 py-2 rounded-xl text-xs font-semibold ring-inset transition-colors flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed ${
                          status === opt
                            ? `${STATUS_COLORS[opt]} ring-2`
                            : 'bg-gray-50 text-gray-400 ring-1 ring-gray-200 dark:bg-slate-700/50 dark:text-slate-500 dark:ring-slate-600 hover:ring-gray-300 dark:hover:ring-slate-500'
                        }`}
                      >
                        <span className="md:hidden">{STATUS_SHORT[opt]}</span>
                        <span className="hidden md:inline">{STATUS_LABELS[opt]}</span>
                      </button>
                    ))}
                  </div>
                </li>
```

(Not: `status` değişkeni `const status = statuses[s.id] ?? 'present'` satırından gelir — bu satır korunur. `map`'in `(s, i) =>` imzası ve dıştaki `.map(...)` korunur.)

- [ ] **Step 7: Derleme temiz mi?**

Run: `npm run build`
Expected: TypeScript hatası yok, build başarılı. (Özellikle `toggle`/`setStatus` imza tutarlılığı her iki dosyada.)

- [ ] **Step 8: Mevcut action testleri hâlâ geçiyor mu?**

Run: `npx vitest run tests/vitest/unit/yoklama/`
Expected: PASS (bu dosyalara dokunulmadı; kaydetme/aksiyon davranışı değişmedi).

- [ ] **Step 9: Commit + push**

```bash
git add "app/(dashboard)/yoklama/YoklamaClient.tsx" "app/(dashboard)/yoklama/YoklamaStudentPanel.tsx"
git commit -m "feat(yoklama): durum seçimini tek-tık 4 butona çevir (ödev deseni)"
git push origin main
```

---

## Self-Review

**Spec coverage:**
- Etkileşim: döngü → 4 tek-tık buton → Step 1, 5, 6 ✓
- Satır düzeni (isim üstte, grid-cols-4 altta) → Step 6 ✓
- Responsive kısa/tam etiket → Step 4 (STATUS_SHORT) + Step 6 (`md:hidden`/`hidden md:inline`) ✓
- `setStatus` davranışı (state + isDirty, kaydetmeye kadar DB'ye gitmez) → Step 1 ✓
- `isLocked` disabled → Step 6 (`disabled={isLocked}`) ✓
- Dokunulmayanlar (Kaydet, bildirim, kilit, toplu butonlar, badge) → değiştirilmedi; toplu butonlar `setStatuses`+`onDirty` kullanır, korunur ✓
- Geçersiz döngü açıklaması kaldırma → Step 3 ✓
- Doğrulama (build + action testi + manuel) → Step 7, 8 ✓

**Type consistency:** `setStatus(studentId: string, status: AttendanceStatus)` Step 1 (tanım), Step 5 (prop tipi), Step 6 (`setStatus(s.id, opt)` çağrısı, `opt: AttendanceStatus`) — tutarlı. `STATUS_SHORT` Step 4'te tanımlı, Step 6'da kullanılıyor. `AttendanceStatus` her iki dosyada zaten import edili.

**Placeholder scan:** Yok — tüm adımlar birebir kod içeriyor.
