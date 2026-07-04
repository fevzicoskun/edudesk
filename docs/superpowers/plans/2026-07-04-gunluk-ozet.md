# Günlük Özet (Sabah 07:30 Bildirimi) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mevcut 07:30 ders-özeti cron'unu zengin Günlük Özet'e evrilt: ders+nöbet gövdesine dün-eksik-yoklama, bugün-teslim-ödev ve bugünkü-veli-randevusu bölümleri eklenir; öğretmen sabah TEK bildirim (çan+push) alır.

**Architecture:** Saf format/tarih mantığı yeni `src/domains/notifications/gunlukOzetMath.ts`'te (TDD). `dersProgramiOzeti.ts` silinip yerine `gunlukOzet.ts` gelir (Inngest id `gunluk-ozet`, aynı cron `TZ=Europe/Istanbul 30 7 * * 1-5`); 6 toplu okul-geneli sorgu → öğretmen-başına bölümler → `formatGunlukOzet` → notifications insert + `sendPushToUser`. Migration/UI/yeni bağımlılık YOK.

**Tech Stack:** Inngest cron, Supabase service client (`createServiceClient`), web-push (`sendPushToUser`), Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-04-gunluk-ozet-design.md`
- Kitle: öğretmen + zümre başkanı (fiilen: kaynaklarda kaydı olan herkes — kaynaklar zaten öğretmen-bazlı). Müdür/MY özeti YOK.
- Kanal: `notifications` insert + `sendPushToUser`. E-posta YOK.
- Başlık kuralı (kesin): ders varsa "Bugünün dersleri"; yoksa nöbet varsa "Bugün nöbettesin"; ikisi de yoksa "Günlük özet".
- Boş bölüm satır üretmez; TÜM bölümler boşsa bildirim gitmez (`formatGunlukOzet` null döner).
- Tatil koruması: okulda dün okul genelinde 0 yoklama kaydı → o okul için eksik-yoklama bölümü atlanır.
- Tarihler İstanbul TZ: `new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' })`.
- Fail-quiet: bölüm sorgusu hata verirse bölüm boş sayılır + `logger.error`; push hataları `Promise.allSettled` + toplu `logger.error`.
- Bildirim URL'i: `/anasayfa`.
- `homeworkReminder` (08:00) ve `yoklamaHatirlatici` (10:00) cron'larına DOKUNMA.
- Commit mesajları Türkçe, `feat(bildirim):` öneki; her commit sonunda `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: gunlukOzetMath — saf format/tarih mantığı

**Files:**
- Create: `src/domains/notifications/gunlukOzetMath.ts`
- Test: `tests/vitest/unit/domains/notifications/gunlukOzetMath.test.ts`

**Interfaces:**
- Produces:
  `previousSchoolDayGap(dow: number): number` (Pzt(1)→3, Salı..Cuma(2-5)→1),
  `GunlukOzetInput { dersSatiri: string; nobetSatirlari: string[]; eksikYoklamaSiniflari: string[]; bugunTeslimOdevler: string[]; randevular: { period: number; studentName: string }[] }`,
  `formatGunlukOzet(i: GunlukOzetInput): { title: string; body: string } | null`

- [ ] **Step 1: Write the failing test**

```ts
// tests/vitest/unit/domains/notifications/gunlukOzetMath.test.ts
import { describe, it, expect } from 'vitest'
import { previousSchoolDayGap, formatGunlukOzet } from '@/src/domains/notifications/gunlukOzetMath'

const bos = {
  dersSatiri: '',
  nobetSatirlari: [] as string[],
  eksikYoklamaSiniflari: [] as string[],
  bugunTeslimOdevler: [] as string[],
  randevular: [] as { period: number; studentName: string }[],
}

describe('previousSchoolDayGap', () => {
  it('Pazartesi 3 gün geri (Cuma), diğer günler 1 gün', () => {
    expect(previousSchoolDayGap(1)).toBe(3)
    expect(previousSchoolDayGap(2)).toBe(1)
    expect(previousSchoolDayGap(5)).toBe(1)
  })
})

describe('formatGunlukOzet', () => {
  it('tüm bölümler boş → null (bildirim gitmez)', () => {
    expect(formatGunlukOzet(bos)).toBeNull()
  })

  it('başlık kuralı: ders > nöbet > genel', () => {
    expect(formatGunlukOzet({ ...bos, dersSatiri: '1. ders 9-A' })?.title).toBe('Bugünün dersleri')
    expect(formatGunlukOzet({ ...bos, nobetSatirlari: ['Bugün nöbettesin: 12:00 · Bahçe'] })?.title).toBe('Bugün nöbettesin')
    expect(formatGunlukOzet({ ...bos, bugunTeslimOdevler: ['Kesirler'] })?.title).toBe('Günlük özet')
  })

  it('tam gövde: satır sırası ders → nöbet → yoklama → ödev → randevu', () => {
    const r = formatGunlukOzet({
      dersSatiri: '1. ders 9-A',
      nobetSatirlari: ['Bugün nöbettesin: 12:00 · Bahçe'],
      eksikYoklamaSiniflari: ['9-A'],
      bugunTeslimOdevler: ['Kesirler'],
      randevular: [{ period: 3, studentName: 'Ayşe Yılmaz' }],
    })
    expect(r?.body.split('\n')).toEqual([
      '1. ders 9-A',
      '🔔 Bugün nöbettesin: 12:00 · Bahçe',
      '⚠️ Dün 9-A yoklaması alınmadı',
      '📚 Bugün teslim: "Kesirler"',
      '👤 Veli görüşmesi: 3. ders Ayşe Yılmaz',
    ])
  })

  it('eksik yoklama çoğul formatı', () => {
    const r = formatGunlukOzet({ ...bos, eksikYoklamaSiniflari: ['9-A', '10-B'] })
    expect(r?.body).toBe('⚠️ Dün 2 sınıfın yoklaması alınmadı: 9-A, 10-B')
  })

  it('ödev kısaltması: 2+ ödevde ilk başlık + sayaç', () => {
    const r = formatGunlukOzet({ ...bos, bugunTeslimOdevler: ['Kesirler', 'Üslü Sayılar', 'Denklemler'] })
    expect(r?.body).toBe('📚 Bugün teslim: "Kesirler" (+2 ödev)')
  })

  it('randevular period sırasına dizilir, her biri ayrı satır', () => {
    const r = formatGunlukOzet({
      ...bos,
      randevular: [
        { period: 5, studentName: 'Ali Kaya' },
        { period: 2, studentName: 'Ayşe Yılmaz' },
      ],
    })
    expect(r?.body.split('\n')).toEqual([
      '👤 Veli görüşmesi: 2. ders Ayşe Yılmaz',
      '👤 Veli görüşmesi: 5. ders Ali Kaya',
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/vitest/unit/domains/notifications/gunlukOzetMath.test.ts`
Expected: FAIL — "Failed to resolve import ... gunlukOzetMath"

- [ ] **Step 3: Write minimal implementation**

```ts
// src/domains/notifications/gunlukOzetMath.ts
// Günlük Özet: saf format/tarih mantığı (DB'siz, test edilebilir).
// Spec: docs/superpowers/specs/2026-07-04-gunluk-ozet-design.md

export interface GunlukOzetInput {
  dersSatiri: string // formatOzetBody çıktısı, '' = bugün ders yok
  nobetSatirlari: string[] // formatDutyReminder çıktıları (öneksiz)
  eksikYoklamaSiniflari: string[] // dün yoklaması alınmamış mentor sınıf adları
  bugunTeslimOdevler: string[] // bugün teslim ödev başlıkları
  randevular: { period: number; studentName: string }[]
}

// Önceki okul gününe kaç gün geri gidilir: Pazartesi(1) → 3 (Cuma), diğerleri → 1.
export function previousSchoolDayGap(dow: number): number {
  return dow === 1 ? 3 : 1
}

export function formatGunlukOzet(i: GunlukOzetInput): { title: string; body: string } | null {
  const lines: string[] = []

  if (i.dersSatiri) lines.push(i.dersSatiri)
  for (const n of i.nobetSatirlari) lines.push(`🔔 ${n}`)

  if (i.eksikYoklamaSiniflari.length === 1) {
    lines.push(`⚠️ Dün ${i.eksikYoklamaSiniflari[0]} yoklaması alınmadı`)
  } else if (i.eksikYoklamaSiniflari.length > 1) {
    lines.push(`⚠️ Dün ${i.eksikYoklamaSiniflari.length} sınıfın yoklaması alınmadı: ${i.eksikYoklamaSiniflari.join(', ')}`)
  }

  if (i.bugunTeslimOdevler.length === 1) {
    lines.push(`📚 Bugün teslim: "${i.bugunTeslimOdevler[0]}"`)
  } else if (i.bugunTeslimOdevler.length > 1) {
    lines.push(`📚 Bugün teslim: "${i.bugunTeslimOdevler[0]}" (+${i.bugunTeslimOdevler.length - 1} ödev)`)
  }

  for (const m of [...i.randevular].sort((a, b) => a.period - b.period)) {
    lines.push(`👤 Veli görüşmesi: ${m.period}. ders ${m.studentName}`)
  }

  if (!lines.length) return null
  const title = i.dersSatiri ? 'Bugünün dersleri' : i.nobetSatirlari.length ? 'Bugün nöbettesin' : 'Günlük özet'
  return { title, body: lines.join('\n') }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/vitest/unit/domains/notifications/gunlukOzetMath.test.ts`
Expected: PASS (6 test)

- [ ] **Step 5: Commit**

```bash
git add src/domains/notifications/gunlukOzetMath.ts tests/vitest/unit/domains/notifications/gunlukOzetMath.test.ts
git commit -m "feat(bildirim): Günlük Özet saf format/tarih mantığı (gunlukOzetMath)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: gunlukOzet cron — dersProgramiOzeti'nin yerine

**Files:**
- Create: `src/domains/notifications/functions/gunlukOzet.ts`
- Delete: `src/domains/notifications/functions/dersProgramiOzeti.ts`
- Modify: `app/api/inngest/route.ts:9,13` (import + functions listesi)

**Interfaces:**
- Consumes: Task 1'in `formatGunlukOzet`/`previousSchoolDayGap`/`GunlukOzetInput`; mevcut `todaysLessons`/`formatOzetBody` (`@/src/domains/schedule/scheduleMath`), `formatDutyReminder`/`DutyInput` (`@/src/domains/schedule/dutyMath`), `findMissingClasses` (`./yoklamaHatirlatici` — named export), `sendPushToUser`, `createServiceClient`, `logger`.
- Produces: `gunlukOzetFn` (Inngest function, `app/api/inngest/route.ts` register eder).

- [ ] **Step 1: Cron fonksiyonunu yaz**

```ts
// src/domains/notifications/functions/gunlukOzet.ts
// Günlük Özet: hafta içi 07:30'da öğretmene tek sabah bildirimi
// (dersler + nöbet + dün eksik yoklama + bugün teslim ödev + bugünkü veli randevuları).
// dersProgramiOzeti'nin evrimi. Spec: docs/superpowers/specs/2026-07-04-gunluk-ozet-design.md
import { inngest } from '@/src/infrastructure/inngest'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { sendPushToUser } from '@/src/infrastructure/push/webpush'
import { logger } from '@/src/infrastructure/observability/logger'
import { todaysLessons, formatOzetBody, type Period, type Slot } from '@/src/domains/schedule/scheduleMath'
import { formatDutyReminder, type DutyInput } from '@/src/domains/schedule/dutyMath'
import { findMissingClasses } from './yoklamaHatirlatici'
import { formatGunlukOzet, previousSchoolDayGap, type GunlukOzetInput } from '../gunlukOzetMath'

const DAY_MAP: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5 }
const istDate = (d: Date) => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(d)

export const gunlukOzetFn = inngest.createFunction(
  { id: 'gunluk-ozet', triggers: [{ cron: 'TZ=Europe/Istanbul 30 7 * * 1-5' }] },
  async ({ step }) => {
    const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Istanbul', weekday: 'short' }).format(new Date())
    const today = DAY_MAP[wd]
    if (!today) return { sent: 0 } // hafta sonu güvenlik freni

    const sent = await step.run('gunluk-ozetler', async () => {
      const db = createServiceClient()
      const todayISO = istDate(new Date())
      const dun = new Date()
      dun.setDate(dun.getDate() - previousSchoolDayGap(today))
      const dunISO = istDate(dun)

      // 6 toplu okul-geneli sorgu (RLS bypass). Fail-quiet: hatalı sorgunun bölümü boş kalır.
      const [schedules, classes, duties, attendance, homeworks, meetings] = await Promise.all([
        db.from('lesson_schedules').select('teacher_id, school_id, slots, periods').not('teacher_id', 'is', null),
        db.from('classes').select('id, name, school_id, mentor_teacher_id').is('deleted_at', null),
        db.from('teacher_duties').select('teacher_id, school_id, day_of_week, time_range, location, notes').eq('day_of_week', today),
        db.from('attendance').select('class_id, school_id').eq('date', dunISO),
        db.from('homeworks').select('teacher_id, school_id, title').eq('due_date', todayISO).is('deleted_at', null),
        db.from('parent_meetings').select('teacher_id, school_id, period, students(full_name)').eq('meet_date', todayISO).eq('status', 'planlandi'),
      ])
      for (const [name, r] of Object.entries({ schedules, classes, duties, attendance, homeworks, meetings })) {
        if (r.error) logger.error({ event: 'gunluk_ozet_query_failed', query: name, err: r.error.message }, 'Günlük özet sorgusu başarısız')
      }

      const nameById = new Map((classes.data ?? []).map(c => [c.id as string, c.name as string]))

      // Bölüm: dün eksik yoklama (mentor sınıfları). Tatil koruması: okulda dün 0 kayıt → okul atlanır.
      const schoolsWithAttendance = new Set((attendance.data ?? []).map(a => a.school_id as string))
      const mentorClasses = (classes.data ?? []).filter(
        c => c.mentor_teacher_id && schoolsWithAttendance.has(c.school_id as string),
      )
      const missingByMentor = new Map<string, { name: string; school_id: string }[]>()
      for (const c of findMissingClasses(mentorClasses as { id: string; name: string; school_id: string; mentor_teacher_id: string }[], (attendance.data ?? []) as { class_id: string }[])) {
        const list = missingByMentor.get(c.mentor_teacher_id) ?? []
        list.push({ name: c.name, school_id: c.school_id })
        missingByMentor.set(c.mentor_teacher_id, list)
      }

      // Bölüm: bugün teslim ödevler
      const hwByTeacher = new Map<string, { title: string; school_id: string }[]>()
      for (const h of homeworks.data ?? []) {
        const list = hwByTeacher.get(h.teacher_id as string) ?? []
        list.push({ title: h.title as string, school_id: h.school_id as string })
        hwByTeacher.set(h.teacher_id as string, list)
      }

      // Bölüm: bugünkü veli randevuları
      const meetingsByTeacher = new Map<string, { period: number; studentName: string; school_id: string }[]>()
      for (const m of meetings.data ?? []) {
        const student = m.students as unknown as { full_name: string } | null
        const list = meetingsByTeacher.get(m.teacher_id as string) ?? []
        list.push({ period: m.period as number, studentName: student?.full_name ?? '?', school_id: m.school_id as string })
        meetingsByTeacher.set(m.teacher_id as string, list)
      }

      // Bölüm: nöbetler
      const dutiesByTeacher = new Map<string, { school_id: string; lines: string[] }>()
      for (const d of duties.data ?? []) {
        const line = formatDutyReminder(d as unknown as DutyInput, today)
        if (!line) continue
        const cur = dutiesByTeacher.get(d.teacher_id as string) ?? { school_id: d.school_id as string, lines: [] }
        cur.lines.push(line)
        dutiesByTeacher.set(d.teacher_id as string, cur)
      }

      // Bölüm: bugünün dersleri
      const dersByTeacher = new Map<string, { school_id: string; satir: string }>()
      for (const r of schedules.data ?? []) {
        const lessons = todaysLessons((r.slots ?? []) as unknown as Slot[], (r.periods ?? []) as unknown as Period[], today)
        if (!lessons.length) continue
        const satir = formatOzetBody(lessons.map(l => ({ period: l.period, className: nameById.get(l.classId) ?? '?' })))
        dersByTeacher.set(r.teacher_id as string, { school_id: r.school_id as string, satir })
      }

      // Alıcı kümesi = tüm kaynakların birleşimi; school_id ilk bulunan kaynaktan.
      const teacherIds = new Set<string>([
        ...dersByTeacher.keys(), ...dutiesByTeacher.keys(), ...missingByMentor.keys(),
        ...hwByTeacher.keys(), ...meetingsByTeacher.keys(),
      ])

      const notifs: { user_id: string; school_id: string; title: string; body: string }[] = []
      const pushes: Promise<unknown>[] = []

      for (const tid of teacherIds) {
        const input: GunlukOzetInput = {
          dersSatiri: dersByTeacher.get(tid)?.satir ?? '',
          nobetSatirlari: dutiesByTeacher.get(tid)?.lines ?? [],
          eksikYoklamaSiniflari: (missingByMentor.get(tid) ?? []).map(x => x.name),
          bugunTeslimOdevler: (hwByTeacher.get(tid) ?? []).map(x => x.title),
          randevular: (meetingsByTeacher.get(tid) ?? []).map(x => ({ period: x.period, studentName: x.studentName })),
        }
        const ozet = formatGunlukOzet(input)
        if (!ozet) continue

        const schoolId =
          dersByTeacher.get(tid)?.school_id ?? dutiesByTeacher.get(tid)?.school_id ??
          missingByMentor.get(tid)?.[0]?.school_id ?? hwByTeacher.get(tid)?.[0]?.school_id ??
          meetingsByTeacher.get(tid)?.[0]?.school_id ?? ''
        if (!schoolId) continue

        notifs.push({ user_id: tid, school_id: schoolId, title: ozet.title, body: ozet.body })
        pushes.push(sendPushToUser(tid, { title: ozet.title, body: ozet.body, url: '/anasayfa' }))
      }

      if (notifs.length) await db.from('notifications').insert(notifs)
      const results = await Promise.allSettled(pushes)
      const failed = results.filter(x => x.status === 'rejected').length
      if (failed) logger.error({ event: 'gunluk_ozet_push_failed', failed }, 'Günlük özet push hatası')
      return notifs.length
    })

    return { sent }
  },
)
```

- [ ] **Step 2: Eski dosyayı sil, route.ts'i güncelle**

```bash
git rm src/domains/notifications/functions/dersProgramiOzeti.ts
```

`app/api/inngest/route.ts` — iki değişiklik:

```ts
// ESKİ (satır 9):
import { dersProgramiOzetiFn } from '@/src/domains/notifications/functions/dersProgramiOzeti'
// YENİ:
import { gunlukOzetFn } from '@/src/domains/notifications/functions/gunlukOzet'
```

```ts
// ESKİ (satır 13):
  functions: [homeworkReminderFn, veliAbsenceNotifierFn, aylikBultenFn, odevSonrasiVeliNotifierFn, homeworkCreatedNotifierFn, yoklamaHatirlaticiFn, dersProgramiOzetiFn],
// YENİ:
  functions: [homeworkReminderFn, veliAbsenceNotifierFn, aylikBultenFn, odevSonrasiVeliNotifierFn, homeworkCreatedNotifierFn, yoklamaHatirlaticiFn, gunlukOzetFn],
```

- [ ] **Step 3: Tip kontrolü + tüm birim testler**

Run: `npx tsc --noEmit && npm run test:unit`
Expected: her ikisi de temiz (`lint` script'i bu repoda YOK — çalıştırma)

- [ ] **Step 4: Commit**

```bash
git add src/domains/notifications/functions/gunlukOzet.ts app/api/inngest/route.ts
git commit -m "feat(bildirim): Günlük Özet cron'u (dersProgramiOzeti -> gunlukOzet)

Sabah 07:30 bildirimi artık ders+nöbete ek dün eksik yoklama (mentor
sınıfları, tatil korumalı), bugün teslim ödevler ve bugünkü veli
randevularını içerir. Bugün dersi olmayan ama randevusu/ödevi olan
öğretmen de özet alır.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Final doğrulama + push

**Files:**
- Yok (yalnız doğrulama + push)

**Interfaces:**
- Consumes: Task 1-2'nin tamamı.

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: exit 0 (route'lar listelenir, hata yok)

- [ ] **Step 2: e2e GEREKMEZ — gerekçe**

Bu iş UI/route yüzeyine dokunmuyor (yalnız cron + saf mantık); e2e suite kapsamı dışında. Çalıştırma. (Çalıştırılacaksa dev server `--webpack` ile — turbopack bu projede sunucuyu çökertiyor, bkz playwright.config.ts notu.)

- [ ] **Step 3: Push**

```bash
git push origin main
```

Expected: main güncellenir; Vercel otomatik deploy alır. Inngest dashboard'da eski `ders-programi-ozeti` fonksiyonu arşivlenir, `gunluk-ozet` görünür (ilk gerçek koşu bir sonraki hafta-içi 07:30).
