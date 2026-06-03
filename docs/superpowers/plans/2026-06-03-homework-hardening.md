# Ödev Sistemi Sağlamlaştırma — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ödev sistemini backend güvenliği, frontend hata yönetimi ve test kapsamı açısından sağlamlaştır.

**Architecture:** Katman katman — (1) backend action standardizasyonu + multi-class paralel oluşturma, (2) frontend sessiz hata ve boş durum düzeltmeleri, (3) eksik unit/integration testleri.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, Supabase, React `useTransition`

---

## Dosya Haritası

| Dosya | Değişiklik |
|-------|-----------|
| `app/actions/homework.ts` | `deleteHomework`/`restoreHomework` throw→{error}; multi-class Promise.allSettled |
| `app/(dashboard)/odevler/SwipeableHomeworkCard.tsx` | onDelete dönüş tipi güncelleme + error revert |
| `app/(dashboard)/odevler/[id]/StatusBoard.tsx` | `saveNote` error handling |
| `app/(dashboard)/odevler/page.tsx` | Filtreli empty state |
| `tests/vitest/unit/homework/homework-service.test.ts` | Edge case testleri ekleme |
| `tests/vitest/integration/server-actions/homework-service.test.ts` | Multi-class integration testi |

---

## Task 1 — Backend: deleteHomework / restoreHomework error standardization

**Files:**
- Modify: `app/actions/homework.ts:144-156`
- Modify: `app/(dashboard)/odevler/SwipeableHomeworkCard.tsx:51,226-229`

**Sorun:** `deleteHomework` ve `restoreHomework` hata durumunda `throw` yapıyor. Diğer tüm action'lar `{ error: string }` döndürüyor. `SwipeableHomeworkCard` optimistik olarak `isDeleted=true` set ediyor ama hata olduğunda revert etmiyor.

- [ ] **Step 1: `app/actions/homework.ts` satır 144-156'yı güncelle**

```ts
export async function deleteHomework(id: string): Promise<{ error?: string }> {
  UUID.parse(id)
  const result = await HomeworkService.deleteHomework(id)
  if (result.error) return { error: result.error }
  revalidatePath('/odevler')
  return {}
}

export async function restoreHomework(id: string): Promise<{ error?: string }> {
  UUID.parse(id)
  const result = await HomeworkService.restoreHomework(id)
  if (result.error) return { error: result.error }
  revalidatePath('/odevler')
  return {}
}
```

- [ ] **Step 2: `SwipeableHomeworkCard.tsx` prop tipini ve delete handler'ı güncelle**

Prop tipini değiştir (satır 51):
```ts
onDelete: () => Promise<{ error?: string } | void>
```

State ekle (satır 69 sonrasına):
```ts
const [deleteError, setDeleteError] = useState<string | null>(null)
```

Delete butonunun onClick'ini güncelle (satır 226-229):
```ts
onClick={() => {
  setShowConfirm(false)
  setIsDeleted(true)
  startTransition(async () => {
    const result = await onDelete()
    if (result && 'error' in result && result.error) {
      setIsDeleted(false)
      setDeleteError(result.error)
    }
  })
}}
```

`deleteError` göstergesi ekle — return içinde, `{showConfirm && ...}` bloğundan sonra:
```tsx
{deleteError && (
  <div className="absolute bottom-3 left-3 right-3 z-20 bg-red-600 text-white text-xs font-medium px-3 py-2 rounded-lg text-center">
    {deleteError}
  </div>
)}
```

- [ ] **Step 3: Testleri çalıştır**

```bash
npx vitest run tests/vitest/unit/homework/
```
Beklenti: tüm testler geçer (mevcut testlerde bu action çağrılmıyor, break yok).

- [ ] **Step 4: Commit**

```bash
git add app/actions/homework.ts app/(dashboard)/odevler/SwipeableHomeworkCard.tsx
git commit -m "fix(homework): deleteHomework/restoreHomework throw→{error}, optimistik revert"
```

---

## Task 2 — Backend: Multi-class homework Promise.allSettled

**Files:**
- Modify: `app/actions/homework.ts:56-73`
- Modify: `app/(dashboard)/odevler/page.tsx` (hatali param gösterimi)

**Sorun:** Çoklu sınıf ataması sequential loop ile yapılıyor. İlk hata durumunda sonraki sınıflar atlanıyor ve hangi sınıfların başarılı olduğu bilinmiyor.

- [ ] **Step 1: `app/actions/homework.ts` satır 56-73'ü `Promise.allSettled` ile yeniden yaz**

Mevcut `let firstId: string | undefined` ve `for` döngüsünü şununla değiştir:
```ts
const results = await Promise.allSettled(
  classIds.map(classId =>
    HomeworkService.createHomework({
      class_id:    classId,
      title:       parsed.data.title,
      description: parsed.data.description ?? null,
      subject:     parsed.data.subject,
      due_date:    parsed.data.due_date,
      source_id:   parsed.data.source_id ?? null,
      is_template: false,
    })
  )
)

const succeeded = results
  .filter((r): r is PromiseFulfilledResult<{ id?: string; error?: string }> =>
    r.status === 'fulfilled' && !r.value.error
  )
  .map(r => r.value.id!)
  .filter(Boolean)

const failedCount = results.length - succeeded.length

if (succeeded.length === 0) return { error: 'Ödev oluşturulamadı' }

revalidatePath('/odevler')
if (succeeded.length === 1 && failedCount === 0) redirect(`/odevler/${succeeded[0]}`)
if (failedCount > 0) redirect(`/odevler?olusturuldu=${succeeded.length}&hatali=${failedCount}`)
redirect(`/odevler?olusturuldu=${succeeded.length}`)
```

- [ ] **Step 2: `app/(dashboard)/odevler/page.tsx` — `FilterParams` tipine `hatali` ekle ve banner güncelle**

`FilterParams` tipine ekle:
```ts
type FilterParams = {
  sinif?: string
  ders?: string
  ogretmen?: string
  q?: string
  olusturuldu?: string
  hatali?: string      // ← ekle
}
```

Mevcut `params.olusturuldu` banner'ını güncelle (satır 93-102):
```tsx
{params.olusturuldu && parseInt(params.olusturuldu) > 0 && (
  <div className={`mb-4 flex items-start gap-2 border text-sm px-4 py-3 rounded-xl ${
    params.hatali
      ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
      : 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
  }`}>
    <svg className={`w-4 h-4 shrink-0 mt-0.5 ${params.hatali ? 'text-amber-500' : 'text-green-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d={params.hatali ? 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z' : 'M5 13l4 4L19 7'} />
    </svg>
    <div>
      <p>{parseInt(params.olusturuldu) === 1
        ? 'Ödev başarıyla oluşturuldu.'
        : `${params.olusturuldu} sınıf için ödev oluşturuldu.`}
      </p>
      {params.hatali && (
        <p className="text-xs mt-0.5 opacity-80">{params.hatali} sınıf için oluşturulamadı.</p>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 3: Testleri çalıştır**

```bash
npx vitest run tests/vitest/
```
Beklenti: tüm testler geçer.

- [ ] **Step 4: Commit**

```bash
git add app/actions/homework.ts "app/(dashboard)/odevler/page.tsx"
git commit -m "feat(homework): çoklu sınıf atamasında Promise.allSettled, kısmi başarı bildirimi"
```

---

## Task 3 — Frontend: StatusBoard saveNote sessiz hata düzeltmesi

**Files:**
- Modify: `app/(dashboard)/odevler/[id]/StatusBoard.tsx:122-129`

**Sorun:** `saveNote` fonksiyonu `updateSubmissionNote` sonucunu kontrol etmiyor. Sunucu hatası sessizce geçiyor, kullanıcı "✓ Kaydedildi" görse de not kaydedilmemiş olabilir.

- [ ] **Step 1: `saveNote` fonksiyonunu güncelle (satır 122-129)**

```ts
function saveNote(studentId: string, note: string) {
  setNotes(prev => ({ ...prev, [studentId]: note }))
  startTransition(async () => {
    const result = await updateSubmissionNote(homeworkId, studentId, note)
    if (result?.error) {
      setErrorMsg(result.error)
    } else {
      setNoteSavedId(studentId)
      setTimeout(() => setNoteSavedId(id => id === studentId ? null : id), 2000)
    }
  })
}
```

- [ ] **Step 2: Manuel test**

Dev server'ı başlat (`npm run dev`), bir ödevin StatusBoard'una git, öğrenci notuna bir şey yaz ve blur yap. "✓ Kaydedildi" görünmeli. Network sekmesinde action'ın 200 döndürdüğünü doğrula.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/odevler/[id]/StatusBoard.tsx"
git commit -m "fix(homework): saveNote sessiz hata düzeltildi"
```

---

## Task 4 — Frontend: Filtreli boş liste empty state

**Files:**
- Modify: `app/(dashboard)/odevler/page.tsx:304-324` (`HomeworkSection` içindeki empty state)

**Sorun:** Filtre uygulandığında sonuç boşsa "Henüz ödev yok" mesajı gösteriliyor. Bu yanıltıcı — ödevler var ama filtreye uymuyor.

- [ ] **Step 1: `HomeworkSection` içinde `hasFilters` kontrolü ekle**

`totalCount` hesabının hemen altına (satır 227 sonrasına) ekle:
```ts
const hasFilters = !!(params.sinif || params.ders || params.ogretmen || params.q)
```

- [ ] **Step 2: empty state bloğunu güncelle (satır 304-324)**

```tsx
{totalCount === 0 ? (
  <div className="flex flex-col items-center justify-center py-24 text-center">
    <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
      <svg className="w-8 h-8 text-gray-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    </div>
    {hasFilters ? (
      <>
        <p className="text-gray-900 dark:text-slate-100 font-semibold text-base">Bu kriterlere uygun ödev bulunamadı</p>
        <p className="text-gray-400 text-sm mt-1 max-w-xs">Farklı filtreler deneyin veya filtreyi temizleyin.</p>
        <Link
          href="/odevler"
          className="mt-5 flex items-center gap-2 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
        >
          Filtreyi Sıfırla
        </Link>
      </>
    ) : (
      <>
        <p className="text-gray-900 dark:text-slate-100 font-semibold text-base">Henüz ödev yok</p>
        <p className="text-gray-400 text-sm mt-1 max-w-xs">Sınıflarınıza ödev tanımlamak için yeni bir ödev oluşturun.</p>
        {canWrite && (
          <Link
            href="/odevler/yeni"
            className="mt-5 flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-blue-500/25"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            İlk Ödevi Oluştur
          </Link>
        )}
      </>
    )}
  </div>
) : (
```

- [ ] **Step 3: Testleri çalıştır**

```bash
npx vitest run tests/vitest/
```

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/odevler/page.tsx"
git commit -m "fix(homework): filtreli boş liste için doğru empty state"
```

---

## Task 5 — Tests: Unit edge case testleri

**Files:**
- Modify: `tests/vitest/unit/homework/homework-service.test.ts` (mevcut dosyaya ekle)

**Eklenecek test grubu: `HomeworkService.createHomework()` edge case'leri**

- [ ] **Step 1: Mevcut `describe('HomeworkService.createHomework()')` bloğuna şu testleri ekle**

```ts
it('due_date null ile ödev oluşturulur (şablon)', async () => {
  vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
  vi.mocked(HomeworkRepository.insertHomework).mockResolvedValue({ data: { id: 'hw-tmpl' }, error: null } as never)
  const result = await HomeworkService.createHomework({
    ...HW_DATA,
    due_date: null,
    is_template: true,
  })
  expect(result.error).toBeUndefined()
  expect(HomeworkRepository.insertHomework).toHaveBeenCalledWith(
    expect.objectContaining({ due_date: null, is_template: true })
  )
})

it('source_id null ile ödev oluşturulur', async () => {
  vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
  vi.mocked(HomeworkRepository.insertHomework).mockResolvedValue({ data: { id: 'hw-nosrc' }, error: null } as never)
  const result = await HomeworkService.createHomework({ ...HW_DATA, source_id: null })
  expect(result.error).toBeUndefined()
  expect(HomeworkRepository.insertHomework).toHaveBeenCalledWith(
    expect.objectContaining({ source_id: null })
  )
})
```

**Eklenecek test grubu: RBAC cross-school sınır testi**

```ts
describe('HomeworkService.updateSubmissionStatus() — cross-school', () => {
  it('başka okul school_id ile ödev bulunamaz → hata döner', async () => {
    // Ability kendi schoolId=SCHOOL_ID ile; DB'den farklı okul ödevi döndürüyor gibi
    // findHomeworkTeacher null döndürürse (school_id filtresi DB'de devreye giriyor)
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(HomeworkRepository.findHomeworkTeacher).mockResolvedValue({
      data: null, error: null,
    } as never)
    const result = await HomeworkService.updateSubmissionStatus('hw-other', 'stu-1', 'yapildi')
    expect(result.error).toBe('Ödev bulunamadı')
    expect(HomeworkRepository.upsertSubmissionStatus).not.toHaveBeenCalled()
  })
})
```

**Eklenecek test grubu: `getStudentHomeworkProfile` edge case**

```ts
it('null due_date olan ödev profile\'da düzgün işlenir', async () => {
  vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
  vi.mocked(HomeworkRepository.findStudentHomeworkProfile).mockResolvedValue({
    student: { full_name: 'Test', student_number: null, veli_ad: null, veli_telefon: null },
    homeworks: [
      { id: 'hw-1', title: 'Şablon', subject: 'Mat', due_date: null },
    ],
    submissions: [],
  } as never)
  const result = await HomeworkService.getStudentHomeworkProfile('stu-1', 'cls-1')
  if ('error' in result) throw new Error(result.error)
  expect(result.homeworks[0].due_date).toBeNull()
  expect(result.homeworks[0].status).toBe('yapilmadi')
})
```

- [ ] **Step 2: Testlerin başarısız olduğunu doğrula (TDD)**

```bash
npx vitest run tests/vitest/unit/homework/homework-service.test.ts
```
Beklenti: yeni testler PASS etmeli (implementasyon zaten var, edge case'leri test ediyoruz).

- [ ] **Step 3: Tüm testleri çalıştır**

```bash
npx vitest run tests/vitest/unit/
```
Beklenti: tüm testler geçer.

- [ ] **Step 4: Commit**

```bash
git add tests/vitest/unit/homework/homework-service.test.ts
git commit -m "test(homework): null due_date, source_id null, cross-school RBAC edge case testleri"
```

---

## Task 6 — Tests: Integration — multi-class create

**Files:**
- Modify: `tests/vitest/integration/server-actions/homework-service.test.ts`

**Eklenecek test grubu: `HomeworkService.createHomework()` multi-class simülasyonu**

Not: Servis katmanı tek sınıf için çalışıyor; Promise.allSettled action katmanında. Servis testinde çoklu çağrı senaryosu test ederiz.

- [ ] **Step 1: Integration test dosyasına yeni `describe` bloğu ekle — mevcut `afterAll` öncesine**

```ts
describe('HomeworkService.createHomework() — paralel çoklu çağrı', () => {
  const createdIds: string[] = []

  afterAll(async () => {
    if (createdIds.length) {
      await serviceDb.from('homework_submissions').delete().in('homework_id', createdIds)
      await serviceDb.from('homeworks').delete().in('id', createdIds)
    }
  })

  it('birden fazla sınıf için ardışık create hepsi başarılı', async () => {
    // 2 sınıf için ayrı ayrı createHomework çağrısı → ikisi de başarılı
    const [r1, r2] = await Promise.all([
      HomeworkService.createHomework({
        class_id: classId, title: 'Paralel Ödev 1',
        description: null, subject: 'Matematik', due_date: '2026-12-31',
      }),
      HomeworkService.createHomework({
        class_id: classId, title: 'Paralel Ödev 2',
        description: null, subject: 'Fizik', due_date: '2026-12-31',
      }),
    ])

    expect(r1.error).toBeUndefined()
    expect(r2.error).toBeUndefined()
    expect(r1.id).toBeTruthy()
    expect(r2.id).toBeTruthy()
    expect(r1.id).not.toBe(r2.id)

    if (r1.id) createdIds.push(r1.id)
    if (r2.id) createdIds.push(r2.id)

    // DB'de ikisi de var
    const { data } = await serviceDb
      .from('homeworks')
      .select('id')
      .in('id', createdIds)
      .eq('school_id', school.id)
    expect(data).toHaveLength(2)
  })

  it('geçersiz sınıf ID ile create hata döner', async () => {
    const result = await HomeworkService.createHomework({
      class_id: '00000000-0000-0000-0000-000000000000',
      title: 'Geçersiz Sınıf Ödevi',
      description: null,
      subject: 'Test',
      due_date: '2026-12-31',
    })
    // DB FK constraint veya RLS nedeniyle hata beklenir
    expect(result.error).toBeTruthy()
  })
})
```

- [ ] **Step 2: Integration testleri çalıştır**

```bash
npx vitest run tests/vitest/integration/server-actions/homework-service.test.ts
```
Beklenti: tüm testler geçer.

- [ ] **Step 3: Commit**

```bash
git add tests/vitest/integration/server-actions/homework-service.test.ts
git commit -m "test(homework): paralel çoklu sınıf create ve geçersiz sınıf integration testleri"
```

---

## Task 7 — Tests: Concurrency unit testi

**Files:**
- Modify: `tests/vitest/unit/homework/homework-service.test.ts`

**Sorun:** Aynı öğrenci için aynı anda iki `updateSubmissionStatus` çağrısı — servis katmanı DB upsert kullanıyor, son gelen kazanır. Bu davranışı test edelim.

- [ ] **Step 1: Yeni describe bloğu ekle**

```ts
describe('HomeworkService.updateSubmissionStatus() — concurrency', () => {
  it('aynı öğrenci için paralel iki güncelleme — son gelen DB\'ye yazılır', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(HomeworkRepository.findHomeworkTeacher).mockResolvedValue({
      data: { teacher_id: TEACHER_ID }, error: null,
    } as never)

    // Her iki çağrı da upsert yapacak — DB garantisi: UNIQUE constraint
    // Mock: her ikisi de başarılı döner
    vi.mocked(HomeworkRepository.upsertSubmissionStatus)
      .mockResolvedValueOnce({ error: null } as never)
      .mockResolvedValueOnce({ error: null } as never)

    const [r1, r2] = await Promise.all([
      HomeworkService.updateSubmissionStatus('hw-1', 'stu-1', 'yapildi'),
      HomeworkService.updateSubmissionStatus('hw-1', 'stu-1', 'eksik'),
    ])

    // İkisi de success döner — DB'de son gelen kazanır (upsert semantiği)
    expect(r1.success).toBe(true)
    expect(r2.success).toBe(true)
    // Upsert 2 kez çağrıldı
    expect(HomeworkRepository.upsertSubmissionStatus).toHaveBeenCalledTimes(2)
  })

  it('bir istek başarısız olursa diğeri etkilenmez', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(HomeworkRepository.findHomeworkTeacher).mockResolvedValue({
      data: { teacher_id: TEACHER_ID }, error: null,
    } as never)

    vi.mocked(HomeworkRepository.upsertSubmissionStatus)
      .mockResolvedValueOnce({ error: { message: 'DB bağlantı hatası' } } as never)
      .mockResolvedValueOnce({ error: null } as never)

    const [r1, r2] = await Promise.all([
      HomeworkService.updateSubmissionStatus('hw-1', 'stu-1', 'yapildi'),
      HomeworkService.updateSubmissionStatus('hw-1', 'stu-2', 'eksik'),
    ])

    expect(r1.error).toBe('DB bağlantı hatası')
    expect(r2.success).toBe(true)
  })
})
```

- [ ] **Step 2: Testleri çalıştır**

```bash
npx vitest run tests/vitest/unit/homework/homework-service.test.ts
```
Beklenti: tüm testler geçer.

- [ ] **Step 3: Tüm test suite'i çalıştır**

```bash
npm run test
```
Beklenti: tüm testler geçer.

- [ ] **Step 4: Final commit**

```bash
git add tests/vitest/unit/homework/homework-service.test.ts
git commit -m "test(homework): concurrency unit testleri"
```

---

## Kapsam Dışı (LOW severity — sonraki sprint)

- Hardcoded tatil tarihleri (`HomeworkCalendar.tsx`)
- WhatsApp URL edge case (`veli_telefon` format)
- Geçmiş tarih uyarısı enforced hale getirme
- Sınıf matrisi öğrenci filtresi / arama
