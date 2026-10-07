# Öğrenci Bazlı Mentörlük — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** İdare sınıfı mentörler arasında öğrenci bazında böler; mentör kendi grubunun tüm derslerdeki ödev durumunu tek tabloda görür ve toplantı öncesi iki tür çıktı alır.

**Architecture:** Mevcut `mentorships` tablosu tek-mentör kuralına (`unique(student_id)`) ve `assigned_by` kolonuna geçer; RLS idareye okul geneli yazma açar. Ödev verisi yeni bir toplu repo fonksiyonuyla (sabit sorgu sayısı) yüklenir, mevcut `sinifOdevKayitlari`/`dersOzeti` saf fonksiyonlarından geçer; tablo kurma yeni saf `mentorTablosu.ts`'tedir. Ekran, iki yazdırma sayfası ve tek öğrenci sayfası aynı fonksiyonlardan beslenir.

**Tech Stack:** Next.js App Router (proxy.ts'li özel sürüm), React 19, Tailwind v4, Supabase SSR + RLS, Vitest (unit + integration gerçek JWT), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-07-ogrenci-bazli-mentorluk-design.md`

## Global Constraints

- Her sorguda `school_id` filtresi; `deleted_at` soft-delete her zaman `.is('deleted_at', null)`.
- 1000 satırı aşabilecek okuma `fetchAll`/`fetchAllResult` + sonda `.order('id')` (PostgREST max_rows=1000, hata vermeden keser).
- Yeni migration sonrası `src/infrastructure/supabase/database.types.ts` güncellenir (Supabase MCP `generate_typescript_types` ya da elle); yoksa tsc kırılır.
- RLS helper SECURITY DEFINER fonksiyonlardan anon/authenticated EXECUTE ÇEKİLMEZ (`is_mudur_or_my`, `current_school_id`).
- Yazdırma çıktısında **öğrenci numarası basılmaz**; alt bilgi `myedudesk.com.tr`; başlık `yazdirmaBasligi(...)`; renk yalnız rakamda.
- Hücre metni "4/5" (yüzde değil); eksik varsa "(1e)". Hesap `dersOzeti` ile aynı (mazeretli + kontrol edilmemiş paydada yok).
- Tarih filtresi `homeworks.assigned_date >= bas`; varsayılan `donemBasi()` (`src/shared/utils`).
- Turbopack YASAK — `npm run dev` (webpack).
- PostgREST `.update()/.delete()` 0 satır = hata değil → `.select('id')` ile satır sayısı kontrol edilir.
- Türkçe metinler eksiksiz Türkçe karakterle; kullanıcıya görünen kopya aynen plandaki gibi.
- Her task sonunda commit + push (kullanıcının kalıcı talimatı), mesaj sonu `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Silinmiş öğrencinin mentörlük satırı** — öğrenci soft-delete edilince tabloda, yazdırmada ve sayaçta görünmemeli (Task 2 `listMentorships` zaten `students.deleted_at` süzer; Task 4 toplu repo da süzer — Task 4 integration testi silinmiş öğrenciyi içerir).
2. **Bozuk / ileri `?bas=`** — `?bas=abc` → dönem başı, `?bas=2099-01-01` → bugün; boş tablo ya da 500 değil (Task 3 unit).
3. **Aynı dersin farklı yazımı** ("Matematik", "matematik ") tek sütun olmalı (Task 3 unit, `dersAnahtari`).
4. **İki öğretmen aynı öğrenciyi aynı anda ekler** — biri başarılı, diğeri "Bu öğrencinin mentörü X" (23505 yolu; Task 1 integration + Task 2 unit).
5. **Mentörün öğrencisi farklı sınıflardan** — her öğrencinin hücresi yalnız KENDİ sınıfının ödevlerinden gelir; başka sınıfın ödevi "kontrol edilmedi" olarak sızmaz (Task 4 integration).

---

## Dosya Haritası

| Dosya | Sorumluluk |
|---|---|
| `supabase/migrations/20261007120000_mentorluk_ogrenci_bazli.sql` (yeni) | unique(student_id), assigned_by, 4 policy, `ogrenci_mentor_adlari()` RPC |
| `src/infrastructure/supabase/database.types.ts` | assigned_by + RPC tipi |
| `src/domains/mentor/repositories/MentorRepository.ts` | atama upsert/sil, mentör adları RPC, setClassMentor SİLİNİR |
| `src/domains/mentor/services/MentorService.ts` | `assignMentors`, `getMentorAdlari`, ekleme/çıkarma kuralları, assignClassMentor SİLİNİR |
| `app/actions/mentor.ts` | `assignMentors` action; assignClassMentor SİLİNİR |
| `src/domains/mentor/lib/mentorTablosu.ts` (yeni) | saf: tablo kurma, hücre metni, dikkat listesi, `basTarihi` |
| `src/domains/homework/repositories/HomeworkRepository.ts` | `findStudentsHomeworkProfiles`, `findStudentHomeworkProfile` bas filtresi |
| `src/domains/homework/services/HomeworkService.ts` | `getMentorHomeworkProfiles`, `getStudentHomeworkProfile({bas})` |
| `app/(dashboard)/mentorluk/page.tsx` + `MentorTablosu.tsx` (yeni) + `OgrenciEkleKarti.tsx` | ana ekran |
| `app/(dashboard)/mentorluk/[studentId]/page.tsx` + `OdevDurumu.tsx` (yeni) | detay: ödev bölümü, yazdır, veli linki |
| `app/(dashboard)/mentorluk/yazdir/page.tsx` (yeni) | hepsini yazdır |
| `app/(dashboard)/mentorluk/tablo/page.tsx` (yeni) | tablo yazdır (yatay) |
| `app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/odev-raporu/page.tsx` + `OgrenciOdevOzeti.tsx` | `?bas=` + kapsam alt başlığı |
| `app/(dashboard)/siniflar/[id]/MentorDagilimiKarti.tsx` (yeni) | idare toplu atama |
| `app/(dashboard)/siniflar/[id]/page.tsx` | MentorAtamaKarti → MentorDagilimiKarti |
| `app/(dashboard)/siniflar/[id]/MentorAtamaKarti.tsx`, `tests/vitest/unit/mentor/assignClassMentor.test.ts` | SİLİNİR |
| `app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/page.tsx` | "Mentörü: X", rehberlik bölümü mentorships'e |
| `components/layout/navMath.ts`, `components/layout/Sidebar.tsx`, `app/(dashboard)/layout.tsx` | mentörü olan öğretmende Mentörlük menüde |

---

### Task 1: Migration — tek mentör, assigned_by, RLS, mentör adları RPC

**Files:**
- Create: `supabase/migrations/20261007120000_mentorluk_ogrenci_bazli.sql`
- Modify: `src/infrastructure/supabase/database.types.ts`
- Test: `tests/vitest/integration/rls/mentorluk-atama-rls.test.ts` (yeni)

**Interfaces:**
- Produces: `mentorships.assigned_by uuid null`; `unique(student_id)` (constraint adı `mentorships_student_id_key`); RPC `ogrenci_mentor_adlari() returns table(student_id uuid, mentor_id uuid, mentor_adi text)`.

- [ ] **Step 1: Mevcut constraint adını ve çakışmayı canlıda doğrula**

Supabase MCP `execute_sql` (project `agijvfrcudpzsofgfogu`):
```sql
select conname from pg_constraint where conrelid = 'public.mentorships'::regclass and contype = 'u';
select student_id, count(*) from mentorships group by student_id having count(*) > 1;
```
Expected: `mentorships_mentor_id_student_id_key`; ikinci sorgu 0 satır. Ad farklıysa migration'daki `drop constraint` satırını o adla yaz.

- [ ] **Step 2: Failing integration testini yaz**

`tests/vitest/integration/rls/mentorluk-atama-rls.test.ts`:
```ts
/**
 * Öğrenci bazlı mentörlük RLS'i — gerçek kullanıcı JWT'siyle (createUserClient), servis anahtarıyla DEĞİL.
 * Kurallar (spec 2026-10-07): tek mentör (unique student_id); öğretmen yalnız kendine ve assigned_by=kendisi
 * ekler; idare atamasını öğretmen silemez; MY okul içinde atar/değiştirir; başka okula yazamaz;
 * öğretmen başkasının satırını göremez; ogrenci_mentor_adlari yalnız kendi okulunu döner.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  serviceDb, createUserClient, createTestSchool, createTestUser, signInTestUser, cleanupTestData,
  type TestSchool, type TestUser,
} from '../../setup/db'

let okul: TestSchool, digerOkul: TestSchool
let ogrA: TestUser, ogrB: TestUser, my: TestUser, digerMy: TestUser
let tA: string, tB: string, tMy: string, tDigerMy: string
let classId: string

async function ogrenci(ad: string): Promise<string> {
  const { data, error } = await serviceDb.from('students')
    .insert({ full_name: ad, student_number: null, class_id: classId, school_id: okul.id })
    .select('id').single()
  if (error) throw new Error(error.message)
  return data!.id
}

beforeAll(async () => {
  ;[okul, digerOkul] = await Promise.all([createTestSchool('_MENTOR_ATAMA'), createTestSchool('_MENTOR_ATAMA_2')])
  ;[ogrA, ogrB, my, digerMy] = await Promise.all([
    createTestUser({ role: 'ogretmen', schoolId: okul.id }),
    createTestUser({ role: 'ogretmen', schoolId: okul.id }),
    createTestUser({ role: 'mudur_yardimcisi', schoolId: okul.id }),
    createTestUser({ role: 'mudur_yardimcisi', schoolId: digerOkul.id }),
  ])
  ;[tA, tB, tMy, tDigerMy] = await Promise.all([ogrA, ogrB, my, digerMy].map(u => signInTestUser(u.email, u.password)))
  const { data: cls } = await serviceDb.from('classes')
    .insert({ name: 'Mentör Atama Test', grade: 10, academic_year: '2025-2026', school_id: okul.id })
    .select('id').single()
  classId = cls!.id
})

afterAll(async () => {
  await cleanupTestData({ userIds: [ogrA.id, ogrB.id, my.id, digerMy.id], schoolIds: [okul.id, digerOkul.id] })
})

describe('mentorships — öğrenci bazlı RLS', () => {
  it('öğretmen kendine ekler; ikinci öğretmen aynı öğrenciyi ekleyemez (23505)', async () => {
    const sid = await ogrenci('Tek Mentör')
    const a = await createUserClient(tA).from('mentorships')
      .insert({ mentor_id: ogrA.id, student_id: sid, school_id: okul.id, assigned_by: ogrA.id })
    expect(a.error).toBeNull()
    const b = await createUserClient(tB).from('mentorships')
      .insert({ mentor_id: ogrB.id, student_id: sid, school_id: okul.id, assigned_by: ogrB.id })
    expect(b.error?.code).toBe('23505')
  })

  it('öğretmen başkası adına ya da assigned_by=başkası ile ekleyemez', async () => {
    const sid = await ogrenci('Sahte Atama')
    const r1 = await createUserClient(tA).from('mentorships')
      .insert({ mentor_id: ogrB.id, student_id: sid, school_id: okul.id, assigned_by: ogrA.id })
    expect(r1.error).not.toBeNull()
    const r2 = await createUserClient(tA).from('mentorships')
      .insert({ mentor_id: ogrA.id, student_id: sid, school_id: okul.id, assigned_by: my.id })
    expect(r2.error).not.toBeNull()
  })

  it('MY atar; öğretmen idare atamasını silemez, MY silebilir', async () => {
    const sid = await ogrenci('İdare Ataması')
    const ins = await createUserClient(tMy).from('mentorships')
      .insert({ mentor_id: ogrA.id, student_id: sid, school_id: okul.id, assigned_by: my.id })
    expect(ins.error).toBeNull()
    const silA = await createUserClient(tA).from('mentorships').delete().eq('student_id', sid).select('id')
    expect(silA.data ?? []).toHaveLength(0)
    const silMy = await createUserClient(tMy).from('mentorships').delete().eq('student_id', sid).select('id')
    expect(silMy.data).toHaveLength(1)
  })

  it('MY upsert ile mentörü değiştirir', async () => {
    const sid = await ogrenci('Mentör Değişimi')
    await createUserClient(tA).from('mentorships')
      .insert({ mentor_id: ogrA.id, student_id: sid, school_id: okul.id, assigned_by: ogrA.id })
    const up = await createUserClient(tMy).from('mentorships')
      .upsert({ mentor_id: ogrB.id, student_id: sid, school_id: okul.id, assigned_by: my.id }, { onConflict: 'student_id' })
      .select('mentor_id')
    expect(up.error).toBeNull()
    expect(up.data?.[0].mentor_id).toBe(ogrB.id)
  })

  it('öğretmen başkasının satırını görmez; MY okuldakilerin hepsini görür', async () => {
    const sid = await ogrenci('Görünürlük')
    await createUserClient(tB).from('mentorships')
      .insert({ mentor_id: ogrB.id, student_id: sid, school_id: okul.id, assigned_by: ogrB.id })
    const a = await createUserClient(tA).from('mentorships').select('id').eq('student_id', sid)
    expect(a.data).toHaveLength(0)
    const m = await createUserClient(tMy).from('mentorships').select('id').eq('student_id', sid)
    expect(m.data).toHaveLength(1)
  })

  it('başka okulun MY\'si bu okula atama yapamaz', async () => {
    const sid = await ogrenci('Okullar Arası')
    const r = await createUserClient(tDigerMy).from('mentorships')
      .insert({ mentor_id: ogrA.id, student_id: sid, school_id: okul.id, assigned_by: digerMy.id })
    expect(r.error).not.toBeNull()
  })

  it('ogrenci_mentor_adlari: öğretmen kendi okulundaki tüm atamaların yalnız adını görür', async () => {
    const sid = await ogrenci('Ad RPC')
    await createUserClient(tB).from('mentorships')
      .insert({ mentor_id: ogrB.id, student_id: sid, school_id: okul.id, assigned_by: ogrB.id })
    const { data, error } = await createUserClient(tA).rpc('ogrenci_mentor_adlari')
    expect(error).toBeNull()
    const satir = (data ?? []).find((r: { student_id: string }) => r.student_id === sid)
    expect(satir).toMatchObject({ mentor_id: ogrB.id })
    expect(Object.keys(satir!).sort()).toEqual(['mentor_adi', 'mentor_id', 'student_id'])
    const diger = await createUserClient(tDigerMy).rpc('ogrenci_mentor_adlari')
    expect((diger.data ?? []).some((r: { student_id: string }) => r.student_id === sid)).toBe(false)
  })
})
```

- [ ] **Step 3: Testin kırmızı olduğunu gör**

Run: `npx vitest run tests/vitest/integration/rls/mentorluk-atama-rls.test.ts`
Expected: FAIL (assigned_by kolonu yok / rpc yok / MY insert reddedilir).

- [ ] **Step 4: Migration'ı yaz**

`supabase/migrations/20261007120000_mentorluk_ogrenci_bazli.sql`:
```sql
-- Öğrenci bazlı mentörlük (spec 2026-10-07):
--  - Her öğrencinin TEK mentörü olur (unique student_id).
--  - Atamayı idare (müdür/MY) da yapabilir; assigned_by kimin atadığını tutar.
--    assigned_by <> mentor_id = "İdare atadı" → mentör kendi kendine kaldıramaz.
--  - mentor_profiles / mentor_reports DEĞİŞMEZ: yalnız mentöre aittir.

do $$ begin
  if exists (select 1 from mentorships group by student_id having count(*) > 1) then
    raise exception 'Birden fazla mentörü olan öğrenci var — önce elle çözülmeli';
  end if;
end $$;

alter table mentorships drop constraint if exists mentorships_mentor_id_student_id_key;
alter table mentorships add constraint mentorships_student_id_key unique (student_id);

alter table mentorships add column if not exists assigned_by uuid references profiles(id) on delete set null;
update mentorships set assigned_by = mentor_id where assigned_by is null;
create index if not exists mentorships_assigned_by_idx on mentorships (assigned_by);

drop policy if exists mentorships_owner_all on mentorships;

create policy mentorships_select on mentorships for select
  using (school_id = current_school_id() and (mentor_id = (select auth.uid()) or is_mudur_or_my()));

create policy mentorships_insert on mentorships for insert
  with check (
    school_id = current_school_id()
    and assigned_by = (select auth.uid())
    and (mentor_id = (select auth.uid()) or is_mudur_or_my())
  );

create policy mentorships_update on mentorships for update
  using (school_id = current_school_id() and is_mudur_or_my())
  with check (school_id = current_school_id() and is_mudur_or_my() and assigned_by = (select auth.uid()));

create policy mentorships_delete on mentorships for delete
  using (
    school_id = current_school_id()
    and (is_mudur_or_my() or (mentor_id = (select auth.uid()) and assigned_by = (select auth.uid())))
  );

-- "Bu öğrencinin mentörü X" için: yalnız öğrenci → mentör adı. Kim/ne zaman atadı açılmaz,
-- SELECT policy genişletilmez.
create or replace function public.ogrenci_mentor_adlari()
returns table (student_id uuid, mentor_id uuid, mentor_adi text)
language sql stable security definer
set search_path to 'public' as $$
  select m.student_id, m.mentor_id, coalesce(p.full_name, 'Öğretmen')
  from mentorships m
  join profiles p on p.id = m.mentor_id
  where m.school_id = current_school_id()
$$;
revoke execute on function public.ogrenci_mentor_adlari() from anon, public;
grant execute on function public.ogrenci_mentor_adlari() to authenticated;
```

- [ ] **Step 5: Canlıya uygula ve tipleri güncelle**

Supabase MCP `apply_migration` (name `mentorluk_ogrenci_bazli`, yukarıdaki SQL). Sonra `generate_typescript_types` ile `database.types.ts`'i yenile; yeniden üretim büyük fark çıkarırsa yalnız `mentorships` Row/Insert/Update'e `assigned_by: string | null` (Insert/Update'te `?`) ve `Functions`'a:
```ts
ogrenci_mentor_adlari: { Args: never; Returns: { student_id: string; mentor_id: string; mentor_adi: string }[] }
```
elle eklenir.

- [ ] **Step 6: Test yeşil + tsc**

Run: `npx vitest run tests/vitest/integration/rls/mentorluk-atama-rls.test.ts && npx tsc --noEmit`
Expected: 7/7 PASS, tsc 0 hata. Mevcut `tests/vitest/integration/rls/mentorships-rls.test.ts` + `mentor-rls.test.ts` da koşulur → PASS (insert'lerine `assigned_by` gerekiyorsa ekle: `assigned_by: mentorTeacher.id`).

- [ ] **Step 7: Commit + push**

```bash
git add supabase/migrations/20261007120000_mentorluk_ogrenci_bazli.sql src/infrastructure/supabase/database.types.ts tests/vitest/integration/rls/
git commit -m "feat(db): öğrenci bazlı mentörlük — tek mentör, idare ataması, mentör adları RPC"
git push origin main
```

---

### Task 2: Servis + action — idare toplu atama, ekleme/çıkarma kuralları

**Files:**
- Modify: `src/domains/mentor/repositories/MentorRepository.ts`
- Modify: `src/domains/mentor/services/MentorService.ts`
- Modify: `app/actions/mentor.ts`
- Delete: `tests/vitest/unit/mentor/assignClassMentor.test.ts`
- Test: `tests/vitest/unit/mentor/mentorship-service.test.ts` (mevcut, genişlet)

**Interfaces:**
- Consumes: Task 1 kolon/RPC.
- Produces:
  - `MentorshipRow` alanı eklenir: `idare_atadi: boolean`.
  - `MentorService.getMyMentorships(): Promise<MentorshipRow[]>` — okuma hatasında **throw** (sessiz `[]` yok).
  - `MentorService.getMentorAdlari(): Promise<Map<string, { mentor_id: string; ad: string }>>` (öğrenci id → mentör).
  - `MentorService.assignMentors(studentIds: string[], mentorId: string | null): Promise<{ error?: string }>` — yalnız müdür/MY.
  - action `assignMentors(classId: string, studentIds: string[], mentorId: string | null): Promise<ActionResult>`.

- [ ] **Step 1: Failing unit testleri yaz**

`tests/vitest/unit/mentor/mentorship-service.test.ts` içinde mevcut mock desenini (repo `vi.mock`) kullanarak ekle:
```ts
describe('MentorService.addMentorship — tek mentör', () => {
  it('23505 gelirse mevcut mentörün adını söyler', async () => {
    mockRepo.findStudentInSchool.mockResolvedValue({ data: { id: S1, full_name: 'Ali', class_id: C1 } })
    mockRepo.insertMentorship.mockResolvedValue({ error: { code: '23505', message: 'dup' } })
    mockRepo.mentorAdlari.mockResolvedValue({ data: [{ student_id: S1, mentor_id: 'm2', mentor_adi: 'Ayşe Kaya' }], error: null })
    expect(await MentorService.addMentorship(S1)).toEqual({ error: 'Bu öğrencinin mentörü Ayşe Kaya' })
  })
  it('assigned_by = kendisi ile yazar', async () => {
    mockRepo.findStudentInSchool.mockResolvedValue({ data: { id: S1, full_name: 'Ali', class_id: C1 } })
    mockRepo.insertMentorship.mockResolvedValue({ error: null })
    await MentorService.addMentorship(S1)
    expect(mockRepo.insertMentorship).toHaveBeenCalledWith({ mentor_id: USER, student_id: S1, school_id: SCHOOL, assigned_by: USER })
  })
})

describe('MentorService.removeMentorship', () => {
  it('idare atamasını mentör kaldıramaz — açık mesaj', async () => {
    mockRepo.findMentorshipAtama.mockResolvedValue({ data: { assigned_by: 'idare-id' }, error: null })
    expect(await MentorService.removeMentorship(S1)).toEqual({ error: 'Bu atamayı idare yaptı; kaldırmak için idareye başvurun.' })
    expect(mockRepo.deleteMentorship).not.toHaveBeenCalled()
  })
})

describe('MentorService.assignMentors', () => {
  it('öğretmen rolü reddedilir', async () => {
    mockProfile({ role: 'ogretmen' })
    expect(await MentorService.assignMentors([S1], 'm1')).toEqual({ error: 'Bu işlem için yetkiniz yok' })
  })
  it('başka okulun öğrencisi varsa hiçbir şey yazılmaz', async () => {
    mockProfile({ role: 'mudur_yardimcisi' })
    mockRepo.findSchoolTeacher.mockResolvedValue({ data: { id: 'm1' } })
    mockRepo.countStudentsInSchool.mockResolvedValue({ count: 1, error: null }) // 2 istendi, 1 bulundu
    expect(await MentorService.assignMentors([S1, S2], 'm1')).toEqual({ error: 'Öğrenci bulunamadı' })
    expect(mockRepo.upsertMentorships).not.toHaveBeenCalled()
  })
  it('mentör yalnız okulun öğretmeni/zümre başkanı olabilir', async () => {
    mockProfile({ role: 'mudur' })
    mockRepo.findSchoolTeacher.mockResolvedValue({ data: null })
    expect(await MentorService.assignMentors([S1], 'x')).toEqual({ error: 'Seçilen öğretmen bu okulda bulunamadı' })
  })
  it('mentorId null → seçilenlerin mentörlüğü silinir', async () => {
    mockProfile({ role: 'mudur' })
    mockRepo.countStudentsInSchool.mockResolvedValue({ count: 2, error: null })
    mockRepo.deleteMentorshipsByStudents.mockResolvedValue({ error: null })
    expect(await MentorService.assignMentors([S1, S2], null)).toEqual({})
    expect(mockRepo.deleteMentorshipsByStudents).toHaveBeenCalledWith([S1, S2], SCHOOL)
  })
  it('upsert assigned_by = idare kullanıcısı', async () => {
    mockProfile({ role: 'mudur_yardimcisi' })
    mockRepo.findSchoolTeacher.mockResolvedValue({ data: { id: 'm1' } })
    mockRepo.countStudentsInSchool.mockResolvedValue({ count: 1, error: null })
    mockRepo.upsertMentorships.mockResolvedValue({ data: [{ id: 'r1' }], error: null })
    await MentorService.assignMentors([S1], 'm1')
    expect(mockRepo.upsertMentorships).toHaveBeenCalledWith([{ student_id: S1, mentor_id: 'm1', school_id: SCHOOL, assigned_by: USER }])
  })
  it('boş liste reddedilir', async () => {
    mockProfile({ role: 'mudur' })
    expect(await MentorService.assignMentors([], 'm1')).toEqual({ error: 'Öğrenci seçilmedi' })
  })
})

describe('MentorService.getMyMentorships', () => {
  it('okuma hatası sessizce [] dönmez, fırlatır', async () => {
    mockRepo.listMentorships.mockResolvedValue({ data: null, error: { message: 'boom' } })
    mockRepo.lastReportDates.mockResolvedValue({ data: [], error: null })
    await expect(MentorService.getMyMentorships()).rejects.toThrow('boom')
  })
})
```
(`mockProfile`, `USER`, `SCHOOL`, `S1`, `S2`, `C1` dosyanın mevcut yardımcıları yoksa en üstte tanımla: `getCurrentProfile` mock'u `{ id: USER, school_id: SCHOOL, role }` döner; `requireAbility` mock'u `{ userId: USER, schoolId: SCHOOL }`. Yeni repo fonksiyonlarını `vi.mock` fabrikasına ekle — eklenmezse undefined = test yanlış kırmızı.)

- [ ] **Step 2: Kırmızıyı gör**

Run: `npx vitest run tests/vitest/unit/mentor/mentorship-service.test.ts`
Expected: FAIL (assignMentors / mentorAdlari tanımlı değil).

- [ ] **Step 3: Repository**

`MentorRepository.ts`: `listMentorships` select'ine `assigned_by` ekle; `insertMentorship` tipine `assigned_by: string` ekle; `setClassMentor` ve `findSchoolStaff`'ı SİL; ekle:
```ts
  async findMentorshipAtama(studentId: string, mentorId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase.from('mentorships').select('assigned_by')
      .eq('student_id', studentId).eq('mentor_id', mentorId).eq('school_id', schoolId).maybeSingle()
  },

  async mentorAdlari() {
    const supabase = await createClient()
    return supabase.rpc('ogrenci_mentor_adlari')
  },

  // Mentör adayı: okulun öğretmeni ya da zümre başkanı (mentörlük ekranı yalnız bu rollere açık)
  async findSchoolTeacher(profileId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase.from('profiles').select('id')
      .eq('id', profileId).eq('school_id', schoolId).in('role', ['ogretmen', 'zumre_baskani']).maybeSingle()
  },

  async countStudentsInSchool(studentIds: string[], schoolId: string) {
    const supabase = await createClient()
    return supabase.from('students').select('id', { count: 'exact', head: true })
      .in('id', studentIds).eq('school_id', schoolId).is('deleted_at', null)
  },

  async upsertMentorships(rows: { student_id: string; mentor_id: string; school_id: string; assigned_by: string }[]) {
    const supabase = await createClient()
    return supabase.from('mentorships').upsert(rows, { onConflict: 'student_id' }).select('id')
  },

  async deleteMentorshipsByStudents(studentIds: string[], schoolId: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('mentorships').delete().in('student_id', studentIds).eq('school_id', schoolId)
    return { error }
  },
```
(`deleteMentorshipsByStudents`: atanmamış öğrenci seçiliyse 0 satır silinmesi meşrudur — bu yüzden burada sayım kontrolü YOK.)

- [ ] **Step 4: Service**

`MentorService.ts`: `MENTOR_ASSIGN_ROLES` kalır; `MentorshipRow`'a `idare_atadi: boolean`; `assignClassMentor` SİLİNİR.
```ts
  async getMyMentorships(): Promise<MentorshipRow[]> {
    const ability = await requireAbility()
    const [listRes, dateRes] = await Promise.all([
      MentorRepository.listMentorships(ability.userId, ability.schoolId),
      MentorRepository.lastReportDates(ability.userId, ability.schoolId),
    ])
    // Sessiz [] = "öğrencin yok" yalanı; hata sayfanın error boundary'sine gider
    if (listRes.error) throw new Error(listRes.error.message)
    if (dateRes.error) {
      logger.error({ event: 'mentorship_last_report_dates_failed', userId: ability.userId, err: dateRes.error.message }, 'Son görüşme tarihleri okunamadı')
    }
    const sonGorusme = new Map<string, string>()
    for (const r of dateRes.data ?? []) {
      if (!sonGorusme.has(r.student_id)) sonGorusme.set(r.student_id, r.report_date)
    }
    return (listRes.data ?? []).map(row => ({
      student_id:       row.student_id,
      full_name:        row.students?.full_name ?? '—',
      class_name:       row.students?.classes?.name ?? null,
      last_report_date: sonGorusme.get(row.student_id) ?? null,
      idare_atadi:      row.assigned_by !== ability.userId,
    }))
  },

  async getMentorAdlari(): Promise<Map<string, { mentor_id: string; ad: string }>> {
    await requireAbility()
    const { data, error } = await MentorRepository.mentorAdlari()
    if (error) throw new Error(error.message)
    return new Map((data ?? []).map(r => [r.student_id, { mentor_id: r.mentor_id, ad: r.mentor_adi }]))
  },

  async addMentorship(studentId: string): Promise<{ error?: string }> {
    const ability = await requireAbility()
    const { data: student } = await MentorRepository.findStudentInSchool(studentId, ability.schoolId)
    if (!student) return { error: 'Öğrenci bulunamadı' }
    const { error } = await MentorRepository.insertMentorship({
      mentor_id: ability.userId, student_id: studentId, school_id: ability.schoolId, assigned_by: ability.userId,
    })
    if (error) {
      if ((error as { code?: string }).code === '23505') {
        const { data } = await MentorRepository.mentorAdlari()
        const mevcut = (data ?? []).find(r => r.student_id === studentId)
        if (mevcut?.mentor_id === ability.userId) return { error: 'Bu öğrenci zaten listenizde' }
        return { error: `Bu öğrencinin mentörü ${mevcut?.mentor_adi ?? 'başka bir öğretmen'}` }
      }
      return { error: error.message }
    }
    return {}
  },

  async removeMentorship(studentId: string): Promise<{ error?: string }> {
    const ability = await requireAbility()
    const { data: satir, error: okuma } = await MentorRepository.findMentorshipAtama(studentId, ability.userId, ability.schoolId)
    if (okuma) return { error: okuma.message }
    if (!satir) return { error: 'Kayıt bulunamadı veya yetkiniz yok.' }
    if (satir.assigned_by !== ability.userId) return { error: 'Bu atamayı idare yaptı; kaldırmak için idareye başvurun.' }
    const { error } = await MentorRepository.deleteMentorship(studentId, ability.userId, ability.schoolId)
    if (error) return { error: error.message }
    return {}
  },

  // İdare: seçilen öğrencilere mentör ata (mentorId null → mentörlüğü kaldır). Fail-closed: tek yabancı öğrenci = hiç yazma.
  async assignMentors(studentIds: string[], mentorId: string | null): Promise<{ error?: string }> {
    const profile = await getCurrentProfile()
    if (!profile?.school_id) return { error: 'Giriş gerekli' }
    if (!MENTOR_ASSIGN_ROLES.includes(profile.role)) return { error: 'Bu işlem için yetkiniz yok' }
    const ids = [...new Set(studentIds)]
    if (ids.length === 0) return { error: 'Öğrenci seçilmedi' }

    if (mentorId) {
      const { data: t } = await MentorRepository.findSchoolTeacher(mentorId, profile.school_id)
      if (!t) return { error: 'Seçilen öğretmen bu okulda bulunamadı' }
    }
    const { count, error: sayim } = await MentorRepository.countStudentsInSchool(ids, profile.school_id)
    if (sayim) return { error: sayim.message }
    if (count !== ids.length) return { error: 'Öğrenci bulunamadı' }

    if (!mentorId) {
      const { error } = await MentorRepository.deleteMentorshipsByStudents(ids, profile.school_id)
      return error ? { error: error.message } : {}
    }
    const { data, error } = await MentorRepository.upsertMentorships(
      ids.map(student_id => ({ student_id, mentor_id: mentorId, school_id: profile.school_id!, assigned_by: profile.id })),
    )
    if (error) return { error: error.message }
    if ((data ?? []).length !== ids.length) return { error: 'Atama kaydedilemedi' }
    return {}
  },
```

- [ ] **Step 5: Action**

`app/actions/mentor.ts`: `assignClassMentor` bloğunu SİL, yerine:
```ts
// ── İdare: öğrenci bazlı mentör atama ─────────────────────────────────────────

const atamaSchema = z.object({
  classId:    UUID,
  studentIds: z.array(UUID).min(1, 'Öğrenci seçilmedi').max(200),
  mentorId:   UUID.nullable(),
})

export async function assignMentors(classId: string, studentIds: string[], mentorId: string | null): Promise<ActionResult> {
  const parsed = atamaSchema.safeParse({ classId, studentIds, mentorId })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const result = await MentorService.assignMentors(parsed.data.studentIds, parsed.data.mentorId)
  if (result.error) return { error: result.error }

  revalidatePath(`/siniflar/${classId}`)
  revalidatePath('/mentorluk')
  return {}
}
```
`removeMentorship` action'ına `revalidatePath(`/mentorluk/${studentId}`)` ekle. `tests/vitest/unit/mentor/assignClassMentor.test.ts` dosyasını sil.

- [ ] **Step 6: Yeşil + tsc**

Run: `npx vitest run tests/vitest/unit/mentor && npx tsc --noEmit`
Expected: PASS, tsc 0 (MentorAtamaKarti hâlâ assignClassMentor import ediyorsa tsc kırılır → Task 8'e kadar beklemeden `MentorAtamaKarti.tsx`'i ve `siniflar/[id]/page.tsx`'teki kullanımını BU task'ta sil; kartın yerine Task 8 gelir).

- [ ] **Step 7: Commit + push**

```bash
git add -A src/domains/mentor app/actions/mentor.ts tests/vitest/unit/mentor "app/(dashboard)/siniflar/[id]"
git commit -m "feat(mentor): idare toplu atama, tek mentör mesajı, idare atamasını mentör kaldıramaz"
git push origin main
```

---

### Task 3: Saf mantık — mentör tablosu, hücre metni, dikkat listesi, tarih ayrıştırma

**Files:**
- Create: `src/domains/mentor/lib/mentorTablosu.ts`
- Test: `tests/vitest/unit/mentor/mentorTablosu.test.ts`

**Interfaces:**
- Consumes: `HomeworkRecord`, `dersOzeti`, `dersAnahtari`, `DersOzeti` (`src/domains/homework/lib/stats.ts`); `odevSeviyesi` (`src/domains/classes/lib/genelDurum.ts`); `RISK_ESIGI` (`src/domains/homework/lib/odev-takibi.ts`).
- Produces:
```ts
export type MentorOgrenci = { id: string; full_name: string; class_name: string | null; homeworks: HomeworkRecord[] }
export type MentorHucre = { metin: string; kirmizi: boolean }
export type MentorSatir = { id: string; full_name: string; class_name: string | null; hucreler: MentorHucre[]; dersler: DersOzeti[] }
export type DikkatSatiri = { id: string; full_name: string; toplam: number; dersler: string }
export type MentorTablo = { dersler: string[]; satirlar: MentorSatir[]; dikkat: DikkatSatiri[] }
export function hucreMetni(d: DersOzeti | undefined): MentorHucre
export function mentorTablosu(ogrenciler: MentorOgrenci[]): MentorTablo
export function basTarihi(param: string | string[] | undefined, donemBasi: string, bugun: string): string
```

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest'
import { mentorTablosu, hucreMetni, basTarihi } from '@/src/domains/mentor/lib/mentorTablosu'
import type { HomeworkRecord } from '@/src/domains/homework/lib/stats'

const hw = (subject: string, status: HomeworkRecord['status'], i = Math.random()): HomeworkRecord => ({
  id: `h${i}`, title: 't', subject, due_date: '2026-10-01', status, note: null, teacher_id: 'x', bekliyor: false,
})

describe('hucreMetni', () => {
  it('ödev yoksa —', () => expect(hucreMetni(undefined)).toEqual({ metin: '—', kirmizi: false }))
  it('yapılan/değerlendirilen, eksik parantezde', () => {
    expect(hucreMetni({ ders: 'Fizik', yapildi: 2, eksik: 1, gec: 0, degerlendirilen: 3, toplam: 3 }).metin).toBe('2/3 (1e)')
  })
  it('hiç kontrol edilmemişse —', () => {
    expect(hucreMetni({ ders: 'Fizik', yapildi: 0, eksik: 0, gec: 0, degerlendirilen: 0, toplam: 2 }).metin).toBe('—')
  })
  it('kırmızı eşiği odevSeviyesi ile aynı: 5 değerlendirilenden 1 yapıldı = risk', () => {
    expect(hucreMetni({ ders: 'M', yapildi: 1, eksik: 0, gec: 0, degerlendirilen: 5, toplam: 5 }).kirmizi).toBe(true)
    expect(hucreMetni({ ders: 'M', yapildi: 0, eksik: 0, gec: 0, degerlendirilen: 2, toplam: 2 }).kirmizi).toBe(false) // az veri
  })
})

describe('mentorTablosu', () => {
  it('sütunlar tüm öğrencilerin dersleri, alfabetik; farklı yazım tek sütun', () => {
    const t = mentorTablosu([
      { id: 'a', full_name: 'Ali', class_name: '11-B', homeworks: [hw('Matematik', 'yapildi'), hw('Fizik', 'eksik')] },
      { id: 'b', full_name: 'Ayşe', class_name: '11-A', homeworks: [hw('matematik ', 'yapildi'), hw('Kimya', 'yapildi')] },
    ])
    expect(t.dersler).toEqual(['Fizik', 'Kimya', 'Matematik'])
    expect(t.satirlar[0].hucreler.map(h => h.metin)).toEqual(['0/1 (1e)', '—', '1/1'])
    expect(t.satirlar[1].hucreler.map(h => h.metin)).toEqual(['—', '1/1', '1/1'])
  })
  it('satırlar Türkçe ada göre sıralı', () => {
    const t = mentorTablosu([
      { id: 'z', full_name: 'Şule', class_name: null, homeworks: [] },
      { id: 'c', full_name: 'Can', class_name: null, homeworks: [] },
    ])
    expect(t.satirlar.map(s => s.full_name)).toEqual(['Can', 'Şule'])
  })
  it('dikkat: 3+ yapılmadı/eksik, ders dökümüyle', () => {
    const t = mentorTablosu([
      { id: 'a', full_name: 'Ali', class_name: null, homeworks: [hw('Mat', 'yapilmadi'), hw('Mat', 'eksik'), hw('Fiz', 'yapilmadi')] },
      { id: 'b', full_name: 'Ayşe', class_name: null, homeworks: [hw('Mat', 'yapilmadi'), hw('Mat', 'gec')] },
    ])
    expect(t.dikkat).toEqual([{ id: 'a', full_name: 'Ali', toplam: 3, dersler: 'Fiz 1, Mat 2' }])
  })
})

describe('basTarihi', () => {
  const DB = '2026-09-08', BUGUN = '2026-10-07'
  it('yoksa dönem başı', () => expect(basTarihi(undefined, DB, BUGUN)).toBe(DB))
  it('bozuksa dönem başı', () => expect(basTarihi('abc', DB, BUGUN)).toBe(DB))
  it('geçersiz takvim günü dönem başı', () => expect(basTarihi('2026-02-31', DB, BUGUN)).toBe(DB))
  it('ileriyse bugün', () => expect(basTarihi('2099-01-01', DB, BUGUN)).toBe(BUGUN))
  it('dizi gelirse ilki', () => expect(basTarihi(['2026-09-20', 'x'], DB, BUGUN)).toBe('2026-09-20'))
  it('geçerliyse aynen', () => expect(basTarihi('2026-09-20', DB, BUGUN)).toBe('2026-09-20'))
})
```

- [ ] **Step 2: Kırmızı**

Run: `npx vitest run tests/vitest/unit/mentor/mentorTablosu.test.ts` → FAIL (modül yok).

- [ ] **Step 3: Uygulama**

`src/domains/mentor/lib/mentorTablosu.ts`:
```ts
import { dersOzeti, dersAnahtari, type DersOzeti, type HomeworkRecord } from '@/src/domains/homework/lib/stats'
import { odevSeviyesi } from '@/src/domains/classes/lib/genelDurum'
import { RISK_ESIGI } from '@/src/domains/homework/lib/odev-takibi'

export type MentorOgrenci = { id: string; full_name: string; class_name: string | null; homeworks: HomeworkRecord[] }
export type MentorHucre = { metin: string; kirmizi: boolean }
export type MentorSatir = { id: string; full_name: string; class_name: string | null; hucreler: MentorHucre[]; dersler: DersOzeti[] }
export type DikkatSatiri = { id: string; full_name: string; toplam: number; dersler: string }
export type MentorTablo = { dersler: string[]; satirlar: MentorSatir[]; dikkat: DikkatSatiri[] }

/** "4/5", eksik varsa "2/3 (1e)". Pay/payda dersOzeti ile aynı (mazeretli + kontrol edilmemiş paydada yok). */
export function hucreMetni(d: DersOzeti | undefined): MentorHucre {
  if (!d || d.degerlendirilen === 0) return { metin: '—', kirmizi: false }
  const oran = Math.round((d.yapildi / d.degerlendirilen) * 100)
  return {
    metin: `${d.yapildi}/${d.degerlendirilen}${d.eksik ? ` (${d.eksik}e)` : ''}`,
    kirmizi: odevSeviyesi(d.degerlendirilen, oran) === 'risk',
  }
}

/** Mentörün grubu: öğrenci × ders. Sütunlar grubun dersleri (dersAnahtari ile tekil), alfabetik. */
export function mentorTablosu(ogrenciler: MentorOgrenci[]): MentorTablo {
  const sirali = [...ogrenciler].sort((a, b) => a.full_name.localeCompare(b.full_name, 'tr'))
  const ozetler = sirali.map(o => dersOzeti(o.homeworks))
  const sutun = new Map<string, string>() // anahtar → ilk görülen görünen ad
  for (const oz of ozetler) for (const d of oz) if (!sutun.has(dersAnahtari(d.ders))) sutun.set(dersAnahtari(d.ders), d.ders)
  const anahtarlar = [...sutun.keys()].sort((a, b) => sutun.get(a)!.localeCompare(sutun.get(b)!, 'tr'))

  const satirlar = sirali.map((o, i) => {
    const m = new Map(ozetler[i].map(d => [dersAnahtari(d.ders), d]))
    return { id: o.id, full_name: o.full_name, class_name: o.class_name, dersler: ozetler[i], hucreler: anahtarlar.map(k => hucreMetni(m.get(k))) }
  })

  // /yonetim/odevler riskliler ile aynı eşik: yapılmadı + eksik toplamı
  const dikkat = sirali.flatMap(o => {
    const sayac = new Map<string, number>()
    for (const h of o.homeworks) {
      if (h.status === 'yapilmadi' || h.status === 'eksik') {
        const ad = h.subject.trim() || 'Diğer'
        sayac.set(ad, (sayac.get(ad) ?? 0) + 1)
      }
    }
    const toplam = [...sayac.values()].reduce((a, b) => a + b, 0)
    if (toplam < RISK_ESIGI) return []
    const dersler = [...sayac.entries()].sort(([a], [b]) => a.localeCompare(b, 'tr')).map(([d, n]) => `${d} ${n}`).join(', ')
    return [{ id: o.id, full_name: o.full_name, toplam, dersler }]
  })

  return { dersler: anahtarlar.map(k => sutun.get(k)!), satirlar, dikkat }
}

/** ?bas= ayrıştırma: yok/bozuk → dönem başı, ileri → bugün. */
export function basTarihi(param: string | string[] | undefined, donemBasi: string, bugun: string): string {
  const v = Array.isArray(param) ? param[0] : param
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return donemBasi
  const d = new Date(`${v}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return donemBasi
  return v > bugun ? bugun : v
}
```

- [ ] **Step 4: Yeşil**

Run: `npx vitest run tests/vitest/unit/mentor/mentorTablosu.test.ts` → PASS (13 test).

- [ ] **Step 5: Commit + push**

```bash
git add src/domains/mentor/lib/mentorTablosu.ts tests/vitest/unit/mentor/mentorTablosu.test.ts
git commit -m "feat(mentor): öğrenci × ders tablosu saf mantığı + tarih ayrıştırma"
git push origin main
```

---

### Task 4: Toplu ödev yükleme + tarih filtresi

**Files:**
- Modify: `src/domains/homework/repositories/HomeworkRepository.ts`
- Modify: `src/domains/homework/services/HomeworkService.ts`
- Modify: `tests/vitest/unit/**` içindeki HomeworkRepository `vi.mock` fabrikaları (`homework-service.test.ts`, `tenant-isolation.test.ts`) — yeni fn eklenir
- Test: `tests/vitest/integration/server-actions/mentor-odev-profilleri.test.ts` (yeni)

**Interfaces:**
- Consumes: `sinifOdevKayitlari`, `computeStudentHomeworkStats`, `fetchAll`.
- Produces:
  - `HomeworkRepository.findStudentsHomeworkProfiles(studentIds: string[], schoolId: string, bas?: string)` → `{ students: {id, full_name, student_number, class_id, class_name}[], homeworks: (OdevSatiri & {class_id})[], submissions: TeslimSatiri[] }` (throw on error).
  - `HomeworkService.getMentorHomeworkProfiles(studentIds: string[], bas?: string)` → `{ error: string } | { ogrenciler: { id; full_name; student_number; class_id; class_name; homeworks: HomeworkRecord[]; stats }[] }`.
  - `getStudentHomeworkProfile(studentId, classId, { tumOdevler?, bas? })`; `findStudentHomeworkProfile(..., teacherIds?, bas?)`.

- [ ] **Step 1: Failing integration testi**

`tests/vitest/integration/server-actions/mentor-odev-profilleri.test.ts` — `homework-service.test.ts`'teki desenle (`createClient` → `serviceDb` mock, `getAbility` mock: `{ userId, schoolId, can: () => true, cannot: () => false }`):
```ts
// Kurulum: okul, iki sınıf (A, B), A'da öğrenci a1 ve silinmiş a2, B'de b1.
// A'ya iki ödev: h1 assigned_date 2026-09-10, h2 assigned_date 2026-09-25; B'ye bir ödev h3 (2026-09-25).
// Teslimler: a1-h1 yapildi (marked_at dolu), a1-h2 işaretsiz, b1-h3 eksik.
it('her öğrenci yalnız kendi sınıfının ödevlerini alır', async () => {
  const r = await HomeworkService.getMentorHomeworkProfiles([a1, b1])
  if ('error' in r) throw new Error(r.error)
  const a = r.ogrenciler.find(o => o.id === a1)!, b = r.ogrenciler.find(o => o.id === b1)!
  expect(a.homeworks.map(h => h.id).sort()).toEqual([h1, h2].sort())
  expect(b.homeworks.map(h => h.id)).toEqual([h3])
  expect(b.homeworks[0].status).toBe('eksik')
  expect(a.class_name).toBe('Mentör A')
})
it('bas filtresi assigned_date ile süzer', async () => {
  const r = await HomeworkService.getMentorHomeworkProfiles([a1], '2026-09-20')
  if ('error' in r) throw new Error(r.error)
  expect(r.ogrenciler[0].homeworks.map(h => h.id)).toEqual([h2])
})
it('silinmiş öğrenci dönmez', async () => {
  const r = await HomeworkService.getMentorHomeworkProfiles([a1, a2])
  if ('error' in r) throw new Error(r.error)
  expect(r.ogrenciler.map(o => o.id)).toEqual([a1])
})
it('boş liste → boş sonuç, sorgu yok', async () => {
  expect(await HomeworkService.getMentorHomeworkProfiles([])).toEqual({ ogrenciler: [] })
})
it('getStudentHomeworkProfile bas filtresi', async () => {
  const r = await HomeworkService.getStudentHomeworkProfile(a1, classA, { tumOdevler: true, bas: '2026-09-20' })
  if ('error' in r) throw new Error(r.error)
  expect(r.homeworks.map(h => h.id)).toEqual([h2])
})
```
(Ödev insert'lerinde `due_date` 2099-12-31 değil, `assigned_date`'ten sonra makul uzak tarih: `2099-12-31` — kısıt `due_date >= assigned_date`; işaretsiz h2 böylece "bekliyor" olur, test bunu etkilemez. Teslim satırları ödev trigger'ıyla otomatik açılır; işaretlemeyi `update({status, marked_at: new Date().toISOString()})` ile yap.)

- [ ] **Step 2: Kırmızı**

Run: `npx vitest run tests/vitest/integration/server-actions/mentor-odev-profilleri.test.ts` → FAIL.

- [ ] **Step 3: Repository**

`findStudentHomeworkProfile` imzası `(studentId, classId, schoolId, teacherIds?: string[], bas?: string)`; `if (teacherIds) ...` satırının altına `if (bas) homeworksQuery = homeworksQuery.gte('assigned_date', bas)`.

Yeni:
```ts
  /** Farklı sınıflardan öğrenciler (mentör grubu) — sabit 3 sorgu. Ödevler öğrencilerin sınıflarından,
   *  teslimler öğrenci id'siyle; başka sınıfın ödevi sinifOdevKayitlari'nda öğrenciye eşlenmez. */
  async findStudentsHomeworkProfiles(studentIds: string[], schoolId: string, bas?: string) {
    const supabase = await createClient()
    if (studentIds.length === 0) return { students: [], homeworks: [], submissions: [] }
    const studentsRes = await supabase
      .from('students')
      .select('id, full_name, student_number, class_id, classes(name)')
      .in('id', studentIds)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
    if (studentsRes.error) throw new Error(studentsRes.error.message)
    const students = (studentsRes.data ?? []).map(s => ({
      id: s.id, full_name: s.full_name, student_number: s.student_number, class_id: s.class_id,
      class_name: (s.classes as { name: string } | null)?.name ?? null,
    }))
    const classIds = [...new Set(students.map(s => s.class_id))]
    if (students.length === 0) return { students, homeworks: [], submissions: [] }

    const [homeworks, submissions] = await Promise.all([
      fetchAll((from, to) => {
        let q = supabase
          .from('homeworks')
          .select('id, title, subject, due_date, teacher_id, class_id')
          .in('class_id', classIds)
          .eq('school_id', schoolId)
          .eq('is_template', false)
          .is('deleted_at', null)
        if (bas) q = q.gte('assigned_date', bas)
        return q.order('due_date', { ascending: false }).order('id').range(from, to)
      }),
      fetchAll((from, to) => supabase
        .from('homework_submissions')
        .select('homework_id, student_id, status, note')
        .not('marked_at', 'is', null)
        .in('student_id', students.map(s => s.id))
        .eq('school_id', schoolId)
        .order('id')
        .range(from, to)),
    ])
    return { students, homeworks, submissions }
  },
```

- [ ] **Step 4: Service**

`getStudentHomeworkProfile` seçeneklerine `bas?: string` ekle, repo çağrısına beşinci argüman olarak geçir. Yeni:
```ts
  /** Mentör grubu (farklı sınıflar) için ödev özetleri — öğrenci bazlı ekranlar gibi TÜM ödevler (2026-09-28 kararı). */
  async getMentorHomeworkProfiles(studentIds: string[], bas?: string): Promise<
    | { error: string }
    | { ogrenciler: { id: string; full_name: string; student_number: string | null; class_id: string; class_name: string | null; homeworks: HomeworkRecord[]; stats: ReturnType<typeof computeStudentHomeworkStats> }[] }
  > {
    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli' }
    if (ability.cannot(P.HOMEWORK.READ)) return { error: 'Bu işlem için yetkiniz yok.' }
    if (studentIds.length === 0) return { ogrenciler: [] }

    const { students, homeworks, submissions } = await HomeworkRepository.findStudentsHomeworkProfiles(studentIds, ability.schoolId, bas)
    const bugun = todayLocalISO()
    const kayit = new Map<string, HomeworkRecord[]>()
    for (const classId of new Set(students.map(s => s.class_id))) {
      const sinifOgr = students.filter(s => s.class_id === classId).map(s => s.id)
      const sinifOdev = homeworks.filter(h => h.class_id === classId)
      for (const [sid, recs] of sinifOdevKayitlari(sinifOgr, sinifOdev, submissions, bugun)) kayit.set(sid, recs)
    }
    const ogrenciler = [...students]
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'tr'))
      .map(s => {
        const hws = kayit.get(s.id) ?? []
        return { ...s, homeworks: hws, stats: computeStudentHomeworkStats(hws) }
      })
    return { ogrenciler }
  },
```
Unit testlerdeki HomeworkRepository `vi.mock` fabrikalarına `findStudentsHomeworkProfiles: vi.fn()` ekle.

- [ ] **Step 5: Yeşil + regresyon**

Run: `npx vitest run tests/vitest/integration/server-actions/mentor-odev-profilleri.test.ts && npm run test:unit && npx tsc --noEmit`
Expected: 5/5 PASS, unit tamamı PASS, tsc 0.

- [ ] **Step 6: Commit + push**

```bash
git add src/domains/homework tests/vitest
git commit -m "feat(odev): mentör grubu için toplu ödev özeti + tarih filtresi"
git push origin main
```

---

### Task 5: `/mentorluk` ana ekran — tablo, tarih kutusu, ekleme kutusu

**Files:**
- Modify: `app/(dashboard)/mentorluk/page.tsx`
- Create: `app/(dashboard)/mentorluk/MentorTablosu.tsx` (server component — ekran ve tablo yazdırmasında ortak)
- Modify: `app/(dashboard)/mentorluk/OgrenciEkleKarti.tsx`

**Interfaces:**
- Consumes: `MentorService.getMyMentorships`, `MentorService.getMentorAdlari`, `HomeworkService.getMentorHomeworkProfiles`, `mentorTablosu`, `basTarihi`, `donemBasi`, `todayLocalISO`, `dersOzetiMetni`.
- Produces: `<MentorTablosu tablo={MentorTablo} sonGorusme={Record<string,string|null>} bas={string} baglanti={boolean} />` — `baglanti=false` yazdırmada link yok.

- [ ] **Step 1: MentorTablosu bileşeni**

```tsx
import Link from 'next/link'
import { format, parseISO } from '@/src/shared/date'
import { dersOzetiMetni } from '@/src/domains/homework/lib/stats'
import type { MentorTablo } from '@/src/domains/mentor/lib/mentorTablosu'

/** Öğrenci × ders. Renk yalnız rakamda (kırmızı = geride). Telefonda satır + ders metni. */
export default function MentorTablosu({ tablo, sonGorusme, bas, baglanti = true }: {
  tablo: MentorTablo; sonGorusme: Record<string, string | null>; bas: string; baglanti?: boolean
}) {
  const ad = (id: string, full: string) => baglanti
    ? <Link href={`/mentorluk/${id}?bas=${bas}`} className="font-medium text-gray-900 dark:text-slate-100 hover:text-blue-600">{full}</Link>
    : <span className="font-medium">{full}</span>
  const gorusme = (id: string) => sonGorusme[id] ? format(parseISO(sonGorusme[id]!), 'd MMM') : 'henüz yok'

  return (
    <>
      <div className="hidden md:block print:block overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-300 dark:border-slate-600 text-left text-xs text-gray-500 dark:text-slate-400 print:text-gray-700">
              <th className="py-2 pr-3 font-semibold">Öğrenci</th>
              <th className="py-2 pr-3 font-semibold">Sınıf</th>
              {tablo.dersler.map(d => <th key={d} className="py-2 px-2 font-semibold text-center">{d}</th>)}
              <th className="py-2 pl-3 font-semibold">Son görüşme</th>
            </tr>
          </thead>
          <tbody>
            {tablo.satirlar.map(s => (
              <tr key={s.id} className="border-b border-gray-100 dark:border-slate-700 break-inside-avoid">
                <td className="py-2 pr-3">{ad(s.id, s.full_name)}</td>
                <td className="py-2 pr-3 text-gray-600 dark:text-slate-400">{s.class_name ?? '—'}</td>
                {s.hucreler.map((h, i) => (
                  <td key={tablo.dersler[i]} className={`py-2 px-2 text-center tabular-nums ${h.kirmizi ? 'text-red-700 dark:text-red-400 font-semibold' : 'text-gray-800 dark:text-slate-200'}`}>{h.metin}</td>
                ))}
                <td className="py-2 pl-3 text-gray-600 dark:text-slate-400">{gorusme(s.id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="md:hidden print:hidden space-y-2">
        {tablo.satirlar.map(s => (
          <li key={s.id} className="p-3 rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800">
            <div className="flex items-baseline justify-between gap-2">
              <span>{ad(s.id, s.full_name)} <span className="text-xs text-gray-500 dark:text-slate-400">· {s.class_name ?? '—'}</span></span>
              <span className="text-xs text-gray-500 dark:text-slate-400 shrink-0">{gorusme(s.id)}</span>
            </div>
            <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-gray-700 dark:text-slate-300">
              {s.dersler.length === 0 ? 'Bu aralıkta ödev yok' : s.dersler.map(d => <span key={d.ders}>{dersOzetiMetni(d)}</span>)}
            </p>
          </li>
        ))}
      </ul>
    </>
  )
}
```

- [ ] **Step 2: Sayfa**

`page.tsx` imzası `({ searchParams }: { searchParams: Promise<{ bas?: string | string[] }> })`. Mevcut liste `<ul>` kaldırılır; yerine:
```tsx
  const { bas: basParam } = await searchParams
  const bas = basTarihi(basParam, donemBasi(), todayLocalISO())
  const [rows, adlar, supabase] = await Promise.all([MentorService.getMyMentorships(), MentorService.getMentorAdlari(), createClient()])
  const sonuc = await HomeworkService.getMentorHomeworkProfiles(rows.map(r => r.student_id), bas)
  if ('error' in sonuc) throw new Error(sonuc.error)
  const tablo = mentorTablosu(sonuc.ogrenciler.map(o => ({ id: o.id, full_name: o.full_name, class_name: o.class_name, homeworks: o.homeworks })))
  const sonGorusme = Object.fromEntries(rows.map(r => [r.student_id, r.last_report_date]))
```
Ekleme listesi: `eklenebilir` artık `{ id, full_name, class_name, mentor: string | null }` — `listedekiler` çıkarılır, diğerlerinde `mentor = adlar.get(o.id)?.ad ?? null`.

Başlık altında (öğrenci varsa):
```tsx
<div className="flex flex-wrap items-end justify-between gap-3 mb-4">
  <form method="get" className="flex items-end gap-2">
    <label className="text-sm text-gray-600 dark:text-slate-400">
      Şu tarihten itibaren
      <input type="date" name="bas" defaultValue={bas} max={todayLocalISO()}
        className="block mt-1 px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg text-base bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100" />
    </label>
    <button className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700">Uygula</button>
  </form>
  <div className="flex gap-2">
    <Link href={`/mentorluk/tablo?bas=${bas}`} className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700">Tabloyu yazdır</Link>
    <Link href={`/mentorluk/yazdir?bas=${bas}`} className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700">Hepsini yazdır</Link>
  </div>
</div>
<MentorTablosu tablo={tablo} sonGorusme={sonGorusme} bas={bas} />
```
Kapsayıcı `max-w-3xl` → `max-w-6xl` (tablo genişliği). Boş durum metni aynen kalır; öğrenci yoksa form ve düğmeler render edilmez.

- [ ] **Step 3: OgrenciEkleKarti**

Tip `type Ogrenci = { id: string; full_name: string; class_name: string | null; mentor: string | null }`. Sonuç satırında `mentor` doluysa buton `disabled` ve sağda `mentörü: {mentor}` (text-xs text-gray-500); `ekle()` yalnız `mentor === null` için çağrılır. Hata mesajı (sunucudan "Bu öğrencinin mentörü X") mevcut `hata` alanında gösterilir.

- [ ] **Step 4: Doğrula**

Run: `npx tsc --noEmit && npx vitest run tests/vitest/unit/mentor`; dev sunucu (`npm run dev`) ile `/mentorluk` ve `/mentorluk?bas=abc` açılır (öğretmen e2e hesabıyla) — 500 yok, tarih kutusu dönem başını gösterir.

- [ ] **Step 5: Commit + push**

```bash
git add "app/(dashboard)/mentorluk"
git commit -m "feat(mentorluk): öğrenci × ders tablosu, tarih aralığı, atanmış öğrenci ekleme kutusunda kilitli"
git push origin main
```

---

### Task 6: `/mentorluk/[id]` — ödev durumu, yazdır, veli linki; tek öğrenci raporuna `?bas=`

**Files:**
- Modify: `app/(dashboard)/mentorluk/[studentId]/page.tsx`
- Create: `app/(dashboard)/mentorluk/[studentId]/OdevDurumu.tsx`
- Modify: `app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/odev-raporu/page.tsx`
- Modify: `app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/odev-raporu/OgrenciOdevOzeti.tsx`

**Interfaces:**
- Consumes: `getStudentHomeworkProfile(studentId, classId, { tumOdevler: true, bas })`, `CopyVeliLink` (`app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/CopyVeliLink.tsx`, props `studentId, studentName, veliAd`), `MentorshipRow.idare_atadi`.
- Produces: `OgrenciOdevOzeti` yeni opsiyonel prop `kapsam?: string` (başlık altında tek satır, ör. "Mentör: Fevzi Coşkun · 8 Eyl 2026 – bugün").

- [ ] **Step 1: OdevDurumu**

```tsx
import { dersOzeti, dersOzetiMetni, type HomeworkRecord } from '@/src/domains/homework/lib/stats'
import { format, parseISO } from '@/src/shared/date'

/** Mentör detayında ödev özeti: ders satırı + yapılmayan/eksik liste (seçilen aralık). */
export default function OdevDurumu({ homeworks }: { homeworks: HomeworkRecord[] }) {
  const dersler = dersOzeti(homeworks)
  const sorunlu = homeworks.filter(h => h.status === 'yapilmadi' || h.status === 'eksik')
  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Ödev durumu</h2>
      {dersler.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">Bu aralıkta ödev yok.</p>
      ) : (
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-800 dark:text-slate-200">
          {dersler.map(d => <span key={d.ders}>{dersOzetiMetni(d)}</span>)}
        </p>
      )}
      {sorunlu.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {sorunlu.map(h => (
            <li key={h.id} className="flex flex-wrap gap-x-2">
              <span className={h.status === 'yapilmadi' ? 'text-red-700 dark:text-red-400 font-medium' : 'text-amber-800 dark:text-amber-400 font-medium'}>
                {h.status === 'yapilmadi' ? 'Yapılmadı' : 'Eksik'}
              </span>
              <span className="text-gray-800 dark:text-slate-200">{h.subject} · {h.title}</span>
              {h.due_date && <span className="text-gray-500 dark:text-slate-400">{format(parseISO(h.due_date), 'd MMM')}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Detay sayfası**

`searchParams` eklenir, `bas = basTarihi(...)`. Paralel okumaya öğrencinin `veli_ad`'ı (`students.select('class_id, veli_ad')`) ve sonra `getStudentHomeworkProfile(studentId, classId, { tumOdevler: true, bas })` eklenir (classId öğrenci satırından; hata → `throw`). Başlık sağı:
```tsx
<div className="flex flex-wrap items-center justify-end gap-2">
  <Link href={`/siniflar/${classId}/ogrenciler/${studentId}/odev-raporu?bas=${bas}`} className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700">Yazdır</Link>
  {satir.idare_atadi
    ? <span className="text-xs text-gray-500 dark:text-slate-400">İdare atadı</span>
    : <ListedenCikarButonu studentId={studentId} ad={satir.full_name} />}
</div>
```
`space-y-6` içinde ilk sıraya `<OdevDurumu homeworks={profil.homeworks} />` ve hemen altına `<CopyVeliLink studentId={studentId} studentName={satir.full_name} veliAd={ogrenci.veli_ad} />`.

- [ ] **Step 3: Tek öğrenci raporu `?bas=` + kapsam**

`odev-raporu/page.tsx`: `searchParams` eklenir; `bas` yalnız parametre VARSA uygulanır (`const bas = sp.bas ? basTarihi(sp.bas, donemBasi(), todayLocalISO()) : undefined`) — öğrenci sayfasından gelen eski bağlantı davranışı (tüm ödevler) değişmez. `kapsam = bas ? `${format(parseISO(bas), 'd MMM yyyy')} – bugün` : undefined` → `<OgrenciOdevOzeti ... kapsam={kapsam} />`.
`OgrenciOdevOzeti.tsx`: Props'a `kapsam?: string`; künye satırının (sınıf adının yazıldığı satır) hemen altına `{kapsam && <p className="text-xs text-gray-600">{kapsam}</p>}`.

- [ ] **Step 4: Doğrula**

Run: `npx tsc --noEmit`; dev sunucuda mentörlük detayı açılır, "Yazdır" tek öğrenci raporunu `?bas` ile açar ve künyede aralık görünür; öğrenci sayfasından açılan rapor aralıksız (eski davranış).

- [ ] **Step 5: Commit + push**

```bash
git add "app/(dashboard)/mentorluk/[studentId]" "app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/odev-raporu"
git commit -m "feat(mentorluk): detayda ödev durumu, tek öğrenci yazdırma ve veli linki"
git push origin main
```

---

### Task 7: Yazdırma sayfaları — hepsini yazdır + tablo (yatay)

**Files:**
- Create: `app/(dashboard)/mentorluk/yazdir/page.tsx`
- Create: `app/(dashboard)/mentorluk/tablo/page.tsx`

**Interfaces:**
- Consumes: `OgrenciOdevOzeti` (`kapsam`), `MentorTablosu` (`baglanti={false}`), `mentorTablosu`, `getMentorHomeworkProfiles`, `getMyMentorships`, `PrintButton`, `yazdirmaBasligi`.

- [ ] **Step 1: Hepsini yazdır**

```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { isTeachingRole } from '@/src/shared/types'
import { yazdirmaBasligi, donemBasi } from '@/src/shared/utils'
import { todayLocalISO, format, parseISO } from '@/src/shared/date'
import { MentorService } from '@/src/domains/mentor/services/MentorService'
import { HomeworkService } from '@/src/domains/homework/services/HomeworkService'
import { basTarihi } from '@/src/domains/mentor/lib/mentorTablosu'
import PrintButton from '@/components/PrintButton'
import OgrenciOdevOzeti from '../../siniflar/[id]/ogrenciler/[studentId]/odev-raporu/OgrenciOdevOzeti'

export const metadata = { title: yazdirmaBasligi('Mentör Öğrencileri Ödev Özetleri') }

/** Mentörün tüm öğrencileri, öğrenci başına bir A4 (veli toplantısı / öğrenci görüşmesi). */
export default async function MentorYazdirPage({ searchParams }: { searchParams: Promise<{ bas?: string | string[] }> }) {
  const profile = await getCurrentProfile()
  if (!profile?.school_id || !isTeachingRole(profile.role)) redirect('/anasayfa')
  const bas = basTarihi((await searchParams).bas, donemBasi(), todayLocalISO())
  const rows = await MentorService.getMyMentorships()
  const sonuc = await HomeworkService.getMentorHomeworkProfiles(rows.map(r => r.student_id), bas)
  if ('error' in sonuc) throw new Error(sonuc.error)
  const kapsam = `Mentör: ${profile.full_name ?? ''} · ${format(parseISO(bas), 'd MMM yyyy')} – bugün`

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto print:p-0 print:max-w-none">
      <div className="flex items-start justify-between gap-3 mb-4 print:hidden">
        <div>
          <Link href={`/mentorluk?bas=${bas}`} className="text-sm text-gray-600 dark:text-slate-400 hover:text-blue-600">← Mentörlüğüm</Link>
          <h1 className="text-lg font-bold text-gray-900 dark:text-slate-100 mt-1">Öğrencilerimin Ödev Özetleri</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">{sonuc.ogrenciler.length} öğrenci · yazdırınca her öğrenci ayrı sayfaya çıkar</p>
        </div>
        {sonuc.ogrenciler.length > 0 && <PrintButton />}
      </div>
      {sonuc.ogrenciler.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400 py-10 text-center">Mentörlük listende öğrenci yok.</p>
      ) : (
        <div className="space-y-6 print:space-y-0">
          {sonuc.ogrenciler.map(o => (
            <section key={o.id} aria-label={o.full_name} className="break-after-page last:break-after-auto">
              <OgrenciOdevOzeti okulAdi={profile.schools?.name ?? ''} sinifAdi={o.class_name ?? ''} ogrenci={o} homeworks={o.homeworks} stats={o.stats} kapsam={kapsam} />
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
```
(`profile.full_name` / `profile.schools?.name` alanları `getCurrentProfile` dönüşünde mevcut — sınıf rapor sayfası aynı alanı kullanıyor.)

- [ ] **Step 2: Tablo yazdır**

Aynı başlık/veri akışı; gövde:
```tsx
<div className="p-4 md:p-6 max-w-6xl mx-auto print:p-0 print:max-w-none">
  {/* Yalnız bu sayfa yatay basılır */}
  <style>{`@page { size: A4 landscape; } thead { display: table-header-group; }`}</style>
  {/* ekran üst çubuğu: ← Mentörlüğüm + PrintButton, print:hidden */}
  <header className="mb-3">  {/* DİKKAT: globals.css print'te `header{display:none}` → <div> kullan */}
```
— `<header>` YERİNE `<div>` kullan (globals.css print bloğu `header`'ı gizler; 2026-09-18 tuzağı). Başlık bloğu:
```tsx
<div className="mb-3">
  <p className="text-xs text-gray-600">{profile.schools?.name ?? ''}</p>
  <h1 className="text-lg font-bold text-gray-900 dark:text-slate-100 print:text-black">Mentör Grubu Ödev Durumu</h1>
  <p className="text-sm text-gray-700 dark:text-slate-300 print:text-gray-700">{profile.full_name} · {format(parseISO(bas), 'd MMM yyyy')} – bugün · {tablo.satirlar.length} öğrenci</p>
</div>
<MentorTablosu tablo={tablo} sonGorusme={sonGorusme} bas={bas} baglanti={false} />
{tablo.dikkat.length > 0 && (
  <div className="mt-4 border-l-4 border-red-600 pl-3 break-inside-avoid">
    <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 print:text-black">Dikkat edilecekler (3+ yapılmadı/eksik)</p>
    <ul className="mt-1 text-sm text-gray-800 dark:text-slate-200 print:text-black">
      {tablo.dikkat.map(d => <li key={d.id}>{d.full_name} — <span className="text-red-700 font-semibold">{d.toplam}</span> ({d.dersler})</li>)}
    </ul>
  </div>
)}
<div className="mt-6 grid grid-cols-2 gap-8 text-sm text-gray-700 print:text-black break-inside-avoid">
  <div><p className="font-medium">Not</p><div className="mt-8 border-b border-dashed border-gray-400" /></div>
  <div><p className="font-medium">Mentör öğretmen · İmza</p><div className="mt-8 border-b border-dashed border-gray-400" /></div>
</div>
<p className="mt-4 text-[10px] text-gray-500 text-center">myedudesk.com.tr</p>
```
`metadata = { title: yazdirmaBasligi('Mentör Grubu Ödev Durumu') }`.

- [ ] **Step 3: Doğrula (PDF ile)**

Dev sunucuda öğretmen hesabıyla en az 2 öğrenci listedeyken (e2e Task 10 yardımcısı ya da elle) `/mentorluk/yazdir` ve `/mentorluk/tablo` açılır; Playwright `page.emulateMedia({ media: 'print' })` + `page.pdf({ preferCSSPageSize: true })` ile: yazdır PDF sayfa sayısı = öğrenci sayısı; tablo PDF'inin ilk sayfası genişlik > yükseklik (yatay). Bu ölçüm Task 10'daki e2e'ye kalıcı yazılır.

- [ ] **Step 4: Commit + push**

```bash
git add "app/(dashboard)/mentorluk/yazdir" "app/(dashboard)/mentorluk/tablo"
git commit -m "feat(mentorluk): hepsini yazdır (öğrenci başına A4) ve yatay grup tablosu"
git push origin main
```

---

### Task 8: Sınıf sayfası mentör dağılımı + öğrenci sayfası "Mentörü"

**Files:**
- Create: `app/(dashboard)/siniflar/[id]/MentorDagilimiKarti.tsx`
- Modify: `app/(dashboard)/siniflar/[id]/page.tsx`
- Modify: `app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/page.tsx`

**Interfaces:**
- Consumes: action `assignMentors(classId, studentIds, mentorId|null)`; `MentorService.getMentorAdlari()`.

> Uygulama notu (spec'ten küçük sapma, kullanıcıya bildirildi): sınıf sayfasındaki öğrenci listesi kart tabanlı (`OgrenciKart`), tablo değil. "Mentör sütunu + seçim kutuları" ayrı, katlanır bir **"Mentör Dağılımı"** kartında sunulur (eski rehber kartının yerinde, yalnız müdür/MY). Kartlara dokunulmaz.

- [ ] **Step 1: MentorDagilimiKarti**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { assignMentors } from '@/app/actions/mentor'

type Ogrenci = { id: string; full_name: string; mentor: string | null }
type Ogretmen = { id: string; full_name: string }

/** İdare: sınıfın öğrencilerini mentörlere böler. Seçilenlere ata / mentörü kaldır. */
export default function MentorDagilimiKarti({ classId, ogrenciler, ogretmenler }: { classId: string; ogrenciler: Ogrenci[]; ogretmenler: Ogretmen[] }) {
  const [secili, setSecili] = useState<Set<string>>(new Set())
  const [mentor, setMentor] = useState('')
  const [mesaj, setMesaj] = useState<{ tur: 'hata' | 'ok'; metin: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const atanmis = ogrenciler.filter(o => o.mentor).length

  function degistir(id: string) {
    setSecili(s => { const y = new Set(s); if (y.has(id)) y.delete(id); else y.add(id); return y })
  }
  function uygula(mentorId: string | null) {
    setMesaj(null)
    startTransition(async () => {
      const r = await assignMentors(classId, [...secili], mentorId)
      if (r.error) setMesaj({ tur: 'hata', metin: r.error })
      else { setMesaj({ tur: 'ok', metin: mentorId ? 'Atandı' : 'Mentör kaldırıldı' }); setSecili(new Set()) }
    })
  }

  return (
    <details className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 mb-5">
      <summary className="cursor-pointer text-sm font-semibold text-gray-700 dark:text-slate-300">
        Mentör Dağılımı <span className="font-normal text-gray-500 dark:text-slate-400">({atanmis}/{ogrenciler.length} atanmış)</span>
      </summary>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="mentor-sec">Mentör</label>
        <select id="mentor-sec" value={mentor} onChange={e => setMentor(e.target.value)}
          className="px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg text-base bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100">
          <option value="">Mentör seç…</option>
          {ogretmenler.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
        </select>
        <button type="button" disabled={!mentor || secili.size === 0 || isPending} onClick={() => uygula(mentor)}
          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white disabled:opacity-50">
          Seçilenlere ata ({secili.size})
        </button>
        <button type="button" disabled={secili.size === 0 || isPending} onClick={() => uygula(null)}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 disabled:opacity-50">
          Mentörü kaldır
        </button>
        {mesaj && <span role="status" className={`text-sm ${mesaj.tur === 'hata' ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>{mesaj.metin}</span>}
      </div>
      <ul className="mt-3 divide-y divide-gray-100 dark:divide-slate-700">
        {ogrenciler.map(o => (
          <li key={o.id}>
            <label className="flex items-center gap-3 py-2 min-h-[44px] cursor-pointer">
              <input type="checkbox" checked={secili.has(o.id)} onChange={() => degistir(o.id)} className="w-4 h-4" />
              <span className="flex-1 text-sm text-gray-900 dark:text-slate-100">{o.full_name}</span>
              <span className="text-sm text-gray-500 dark:text-slate-400">{o.mentor ?? '—'}</span>
            </label>
          </li>
        ))}
      </ul>
    </details>
  )
}
```

- [ ] **Step 2: Sınıf sayfası**

`page.tsx`: `classes.select('name, mentor_teacher_id')` → `select('name')`; `teachersResult` sorgusu `.in('role', ['ogretmen', 'zumre_baskani'])` (mentörlük ekranı bu rollere açık); `canManage` ise `MentorService.getMentorAdlari()` çağrılır; `MentorAtamaKarti` yerine:
```tsx
{canManage && students.length > 0 && (
  <MentorDagilimiKarti
    classId={id}
    ogrenciler={students.map(s => ({ id: s.id, full_name: s.full_name, mentor: mentorAdlari.get(s.id)?.ad ?? null }))}
    ogretmenler={teachers}
  />
)}
```

- [ ] **Step 3: Öğrenci sayfası**

`ogrenciler/[studentId]/page.tsx`:
- `classes` select'inden `mentor_teacher_id` çıkar.
- Paralel okumalara `MentorService.getMentorAdlari()` ekle; `const mentor = mentorAdlari.get(studentId) ?? null`.
- Başlıkta öğrenci adının/sınıfın altına: `{mentor && <p className="text-sm text-gray-500 dark:text-slate-400">Mentörü: {mentor.ad}</p>}`.
- Rehberlik bloğu: `isManager/isClassMentor/canSeeMentorReports` yerine `const benMentorum = mentor?.mentor_id === currentProfile.id`; `mentorReports = benMentorum ? await MentorService.getMentorReportsByStudent(studentId) : []`; render `{benMentorum && <RehberlikRaporlariSection studentId={studentId} classId={classId} reports={mentorReports} canWrite />}` — "Bu sınıfa henüz rehber öğretmen atanmadı" bloğu SİLİNİR.

- [ ] **Step 4: Doğrula**

Run: `npx tsc --noEmit && npm run test:unit`. Dev sunucuda MY hesabıyla bir sınıfta 2 öğrenci seçilip e2e öğretmenine atanır → "Mentör Dağılımı (2/N)" ve satırlarda öğretmen adı; öğrenci sayfasında "Mentörü: …". Canlı DB'de SQL ile `select student_id, mentor_id, assigned_by from mentorships where student_id in (…)` → assigned_by = MY id. Sonra "Mentörü kaldır" ile temizlenir, SQL 0 satır.

- [ ] **Step 5: Commit + push**

```bash
git add "app/(dashboard)/siniflar/[id]"
git commit -m "feat(siniflar): idare için mentör dağılımı kartı; öğrenci sayfasında Mentörü satırı"
git push origin main
```

---

### Task 9: Menü — mentörü olan öğretmende Mentörlük günlük grupta

**Files:**
- Modify: `components/layout/navMath.ts`
- Modify: `components/layout/Sidebar.tsx`
- Modify: `app/(dashboard)/layout.tsx`
- Test: `tests/vitest/unit/layout/navMath.test.ts` (mevcut test dosyasının yolu farklıysa onu genişlet: `grep -rl "mobilNavSec" tests`)

**Interfaces:**
- Produces: `NavKayit.yalnizMentor?: boolean`; `gorunurNav(items, role, { mentorMu = false } = {})` — `yalnizMentor` girişler yalnız `mentorMu` true iken görünür. `Sidebar` prop `mentorMu: boolean`.

> Bağlam: Mentörlük 2026-09-30'da kullanıcı isteğiyle menüden gizlendi. Bu task o kararı bozmaz: mentörlüğü OLMAYAN öğretmende yine görünmez; olanda günlük grupta görünür.

- [ ] **Step 1: Failing test**

```ts
describe('gorunurNav — yalnizMentor', () => {
  const items = [
    { href: '/anasayfa', roles: null },
    { href: '/mentorluk', roles: ['ogretmen', 'zumre_baskani'] as Role[], yalnizMentor: true },
  ]
  it('mentörlüğü olmayan öğretmende gizli', () => {
    expect(gorunurNav(items, 'ogretmen').map(i => i.href)).toEqual(['/anasayfa'])
  })
  it('mentörlüğü olan öğretmende görünür', () => {
    expect(gorunurNav(items, 'ogretmen', { mentorMu: true }).map(i => i.href)).toEqual(['/anasayfa', '/mentorluk'])
  })
  it('rol uymuyorsa mentorMu yetmez', () => {
    expect(gorunurNav(items, 'mudur', { mentorMu: true }).map(i => i.href)).toEqual(['/anasayfa'])
  })
})
```
Run → FAIL.

- [ ] **Step 2: navMath**

```ts
export type NavKayit = { /* mevcut alanlar */ yalnizMentor?: boolean }

export function gorunurNav<T extends Pick<NavKayit, 'roles'> & { yalnizMentor?: boolean }>(
  items: T[],
  role: Role | undefined,
  { mentorMu = false }: { mentorMu?: boolean } = {},
): T[] {
  return items.filter(item =>
    (!item.roles || (!!role && item.roles.includes(role))) && (!item.yalnizMentor || mentorMu))
}
```
`mobilNavSec(items, role, secenek = {})` de üçüncü argümanı `gorunurNav`'a geçirir.

- [ ] **Step 3: Sidebar + layout**

`Sidebar.tsx` navItems'a (ponytail yorumunun hemen altına; yorumu "Veli Görüşmeleri gizli; Mentörlük yalnız mentörlüğü olana görünür (2026-10-07)" olarak güncelle):
```tsx
  {
    href: '/mentorluk',
    label: 'Mentörlük',
    mobile: false,
    roles: ['ogretmen', 'zumre_baskani'],
    grup: 'gunluk',
    yalnizMentor: true,
    icon: <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  },
```
Sidebar imzasına `mentorMu = false` prop'u; `gorunurNav(navItems, role, { mentorMu })` ve mobil bileşen `mobilNavSec(..., { mentorMu })` (Sidebar içinde mobilNavSec nerede çağrılıyorsa). `navItems` tip tanımına `yalnizMentor?: boolean` ekle.
`app/(dashboard)/layout.tsx`: profil okunduktan sonra
```ts
const { count: mentorSayisi } = await supabase.from('mentorships')
  .select('id', { count: 'exact', head: true }).eq('mentor_id', user.id)
```
ve `<Sidebar profile={profile} email={user.email ?? ''} mentorMu={(mentorSayisi ?? 0) > 0} />` (mobil menü bileşeni ayrıysa ona da aynı prop).

- [ ] **Step 4: Yeşil**

Run: `npx vitest run tests/vitest/unit/layout && npx tsc --noEmit` → PASS.

- [ ] **Step 5: Commit + push**

```bash
git add components/layout "app/(dashboard)/layout.tsx" tests/vitest/unit
git commit -m "feat(menu): Mentörlük yalnız mentörlüğü olan öğretmende, günlük grupta"
git push origin main
```

---

### Task 10: E2E + tam paket + break-then-revert

**Files:**
- Create: `tests/playwright/e2e/mentor-dagilimi.spec.ts`
- Modify: `tests/playwright/e2e/mentorluk.spec.ts` (ekleme akışı yeni ekranla uyumlu; "link" yerine tablo hücresi/ad bağlantısı)

**Interfaces:**
- Consumes: storageState `mudur_yardimcisi.json`, `ogretmen.json`; e2e test okulundaki seed sınıfı (sınıf sayfasında ilk sınıf).

- [ ] **Step 1: E2E senaryosu**

```ts
import { test, expect } from '@playwright/test'
import path from 'path'
const AUTH = (r: string) => path.join(process.cwd(), 'tests/playwright/.auth', `${r}.json`)

test.describe.serial('Mentör dağılımı', () => {
  let sinifUrl = ''
  let ogrenciAdlari: string[] = []
  let ogretmenAdi = ''

  test('MY iki öğrenciyi e2e öğretmenine atar', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH('mudur_yardimcisi') })
    const page = await ctx.newPage()
    await page.goto('/siniflar')
    await page.locator('a[href^="/siniflar/"]').first().click()
    sinifUrl = page.url()
    await page.getByText('Mentör Dağılımı').click()
    const kutular = page.locator('details input[type=checkbox]')
    for (const i of [0, 1]) await kutular.nth(i).check()
    ogrenciAdlari = await page.locator('details li span.flex-1').evaluateAll(els => els.slice(0, 2).map(e => e.textContent!.trim()))
    // e2e öğretmen hesabının adı ayarlardan değil select'ten seçilir: hesap adı test seed'inde sabit
    const secenek = page.locator('#mentor-sec option').filter({ hasText: /E2E Öğretmen|Test Öğretmen/ }).first()
    ogretmenAdi = (await secenek.textContent())!.trim()
    await page.selectOption('#mentor-sec', { label: ogretmenAdi })
    await page.getByRole('button', { name: /Seçilenlere ata/ }).click()
    await expect(page.getByRole('status')).toHaveText('Atandı')
    await expect(page.locator('details li').filter({ hasText: ogrenciAdlari[0] })).toContainText(ogretmenAdi)
    await ctx.close()
  })

  test('öğretmen tabloda iki öğrenciyi görür; idare atamasını kaldıramaz', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH('ogretmen') })
    const page = await ctx.newPage()
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/mentorluk')
    for (const ad of ogrenciAdlari) await expect(page.getByRole('link', { name: ad })).toBeVisible()
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Mentörlük' })).toBeVisible()
    await page.getByRole('link', { name: ogrenciAdlari[0] }).click()
    await expect(page.getByText('İdare atadı')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Listeden çıkar' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Ödev durumu' })).toBeVisible()
    await ctx.close()
  })

  test('bozuk ?bas= dönem başına düşer, sayfa açılır', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH('ogretmen') })
    const page = await ctx.newPage()
    const res = await page.goto('/mentorluk?bas=abc')
    expect(res?.status()).toBe(200)
    await expect(page.locator('input[name=bas]')).not.toHaveValue('abc')
    await ctx.close()
  })

  test('hepsini yazdır öğrenci başına bir sayfa; tablo yatay', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH('ogretmen') })
    const page = await ctx.newPage()
    await page.goto('/mentorluk/yazdir')
    const n = await page.locator('section[aria-label]').count()
    await page.emulateMedia({ media: 'print' })
    const pdf = await page.pdf({ preferCSSPageSize: true })
    const sayfa = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
    expect(sayfa).toBe(n)
    await page.goto('/mentorluk/tablo')
    await page.emulateMedia({ media: 'print' })
    const tpdf = (await page.pdf({ preferCSSPageSize: true })).toString('latin1')
    const [, w, h] = tpdf.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)/)!
    expect(Number(w)).toBeGreaterThan(Number(h))
    await ctx.close()
  })

  test('telefonda tablo yerine satır listesi, yatay taşma yok', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH('ogretmen'), viewport: { width: 375, height: 800 } })
    const page = await ctx.newPage()
    await page.goto('/mentorluk')
    const taşma = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(taşma).toBeLessThanOrEqual(0)
    await ctx.close()
  })

  test.afterAll(async ({ browser }) => {
    // Temizlik: canlı veride atama bırakma
    const ctx = await browser.newContext({ storageState: AUTH('mudur_yardimcisi') })
    const page = await ctx.newPage()
    await page.goto(sinifUrl)
    await page.getByText('Mentör Dağılımı').click()
    for (const ad of ogrenciAdlari) await page.locator('details li').filter({ hasText: ad }).locator('input').check()
    await page.getByRole('button', { name: 'Mentörü kaldır' }).click()
    await expect(page.getByRole('status')).toHaveText('Mentör kaldırıldı')
    await ctx.close()
  })
})
```
(e2e öğretmen hesabının görünen adını önce `tests/playwright/` global setup / seed dosyasından oku ve `filter({ hasText })` regex'ini ona göre yaz; tahmin etme.)

- [ ] **Step 2: Çalıştır**

Run: `npx playwright test tests/playwright/e2e/mentor-dagilimi.spec.ts tests/playwright/e2e/mentorluk.spec.ts`
Expected: PASS. Kırmızıysa hata ekranını (trace/screenshot) oku; "flaky" diye geçme.

- [ ] **Step 3: Break-then-revert (iki kilit iddia)**

1. `mentorTablosu.ts`'te `hucreMetni` paydasını `d.toplam` yap → `mentorTablosu.test.ts` kırmızı olmalı → geri al → yeşil.
2. Migration'daki `mentorships_delete` policy'sinden `and assigned_by = (select auth.uid())` koşulunu canlıda geçici kaldır (`execute_sql` ile policy'yi yeniden yarat) → `mentorluk-atama-rls.test.ts` "öğretmen idare atamasını silemez" kırmızı → policy'yi migration'daki haline geri yarat → yeşil. Geri alımı `select polname, pg_get_expr(polqual, polrelid) from pg_policy where polrelid='mentorships'::regclass` ile doğrula.

- [ ] **Step 4: Tam paket**

Run: `npx tsc --noEmit && npm run test:unit && npm run test:integration && npm run build && npx playwright test`
Expected: tsc 0; unit/integration sayıları raporlanır (öncesi: vitest 1446); build exit 0; e2e tamamı yeşil (öncesi 127). Sonucu OKU, sonra commit.

- [ ] **Step 5: Canlı iki katman doğrulama**

Deploy READY sonrası: SQL — `select count(*), count(*) filter (where assigned_by <> mentor_id) from mentorships;` (e2e temizliği sonrası yalnız gerçek kayıtlar); UI — öğretmen hesabıyla `/mentorluk` tablo, MY hesabıyla sınıf sayfasında Mentör Dağılımı kartı.

- [ ] **Step 6: Commit + push + memory**

```bash
git add tests/playwright
git commit -m "test(e2e): mentör dağılımı, tablo, yazdırma sayfa sayısı ve yatay sayfa"
git push origin main
```
Proje memory'sine (`project_zumre_takip.md` + MEMORY.md satırı) kanıt sayılarıyla yaz.
