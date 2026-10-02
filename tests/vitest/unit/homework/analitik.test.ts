import { describe, it, expect } from 'vitest'
import {
  computeClassStats,
  computeRiskyStudents,
  computeWeeklyTrend,
  computeKpiCards,
  computeClassWeekHeatmap,
  heatLevel,
} from '@/src/domains/homework/lib/analitik'
import type { AnalitikHomework, AnalitikSubmission, AnalitikStudent } from '@/src/domains/homework/lib/analitik'

function hw(id: string, classId: string, dueDate: string | null = '2026-05-01', teacherId = 't1'): AnalitikHomework {
  return { id, class_id: classId, teacher_id: teacherId, due_date: dueDate, title: `Ödev ${id}` }
}
function sub(homeworkId: string, studentId: string, status: AnalitikSubmission['status']): AnalitikSubmission {
  return { homework_id: homeworkId, student_id: studentId, status }
}
function student(id: string, classId: string): AnalitikStudent {
  return { id, class_id: classId, full_name: `Öğrenci ${id}`, student_number: id }
}

// --- computeClassStats ---
describe('computeClassStats()', () => {
  it('ödev yok → oran yok (null), sayılar sıfır', () => {
    expect(computeClassStats('c1', [], [], 5)).toEqual({
      classId: 'c1', completionPct: null, totalHomeworks: 0, studentCount: 5, pendingReview: 0,
    })
  })

  it('öğrenci yok → completionPct=null, crash yok', () => {
    expect(computeClassStats('c1', [hw('h1', 'c1')], [], 0).completionPct).toBeNull()
  })

  it('tüm yapıldı → 100%', () => {
    const homeworks = [hw('h1', 'c1'), hw('h2', 'c1')]
    const submissions = [
      sub('h1', 's1', 'yapildi'), sub('h1', 's2', 'yapildi'),
      sub('h2', 's1', 'yapildi'), sub('h2', 's2', 'yapildi'),
    ]
    expect(computeClassStats('c1', homeworks, submissions, 2).completionPct).toBe(100)
  })

  it('mazeretli paydadan çıkar: 1 yapıldı + 1 mazeretli / 2 öğrenci 1 ödev → 100%', () => {
    const homeworks = [hw('h1', 'c1')]
    const submissions = [sub('h1', 's1', 'yapildi'), sub('h1', 's2', 'mazeretli')]
    expect(computeClassStats('c1', homeworks, submissions, 2).completionPct).toBe(100)
  })

  it('pendingReview: tarihi geçmiş + submission yok → 1, tarihi gelmemiş → sayılmaz', () => {
    const homeworks = [hw('h1', 'c1', '2020-01-01'), hw('h2', 'c1', '2030-01-01')]
    expect(computeClassStats('c1', homeworks, [], 2).pendingReview).toBe(1)
  })

  it('pendingReview: kısmi işaretleme (1/2 öğrenci) → hâlâ pending', () => {
    const homeworks = [hw('h1', 'c1', '2020-01-01')]
    const submissions = [sub('h1', 's1', 'yapildi')]
    expect(computeClassStats('c1', homeworks, submissions, 2).pendingReview).toBe(1)
  })

  it('pendingReview: tüm öğrenciler işaretlendi → pending değil', () => {
    const homeworks = [hw('h1', 'c1', '2020-01-01')]
    const submissions = [sub('h1', 's1', 'yapildi'), sub('h1', 's2', 'eksik')]
    expect(computeClassStats('c1', homeworks, submissions, 2).pendingReview).toBe(0)
  })

  it('başka sınıfın ödevleri sayılmaz', () => {
    const homeworks = [hw('h1', 'c1'), hw('h2', 'c2')]
    expect(computeClassStats('c1', homeworks, [], 5).totalHomeworks).toBe(1)
  })
})

// --- computeRiskyStudents ---
describe('computeRiskyStudents()', () => {
  it('2 eksik → listeye girmez (eşik: >= 3)', () => {
    const students = [student('s1', 'c1')]
    const homeworks = [hw('h1', 'c1'), hw('h2', 'c1')]
    const submissions = [sub('h1', 's1', 'yapilmadi'), sub('h2', 's1', 'eksik')]
    expect(computeRiskyStudents(students, homeworks, submissions)).toHaveLength(0)
  })

  it('3 eksik/yapılmadı → listeye girer', () => {
    const students = [student('s1', 'c1')]
    const homeworks = [hw('h1', 'c1'), hw('h2', 'c1'), hw('h3', 'c1')]
    const submissions = [
      sub('h1', 's1', 'yapilmadi'), sub('h2', 's1', 'eksik'), sub('h3', 's1', 'yapilmadi'),
    ]
    const result = computeRiskyStudents(students, homeworks, submissions)
    expect(result).toHaveLength(1)
    expect(result[0].missedCount).toBe(3)
    expect(result[0].totalHomeworks).toBe(3)
  })

  it('azalan missedCount sırası', () => {
    const students = [student('s1', 'c1'), student('s2', 'c1')]
    const homeworks = [hw('h1','c1'), hw('h2','c1'), hw('h3','c1'), hw('h4','c1')]
    const submissions = [
      sub('h1','s1','yapilmadi'), sub('h2','s1','eksik'), sub('h3','s1','yapilmadi'),
      sub('h1','s2','yapilmadi'), sub('h2','s2','eksik'), sub('h3','s2','yapilmadi'), sub('h4','s2','eksik'),
    ]
    const result = computeRiskyStudents(students, homeworks, submissions)
    expect(result[0].student_id).toBe('s2')
    expect(result[1].student_id).toBe('s1')
  })

  it('başka sınıfın ödevleri sayılmaz — missedCount=0 → listeye girmez', () => {
    const students = [student('s1', 'c1')]
    const homeworks = [hw('h1','c2'), hw('h2','c2'), hw('h3','c2')]
    const submissions = [
      sub('h1','s1','yapilmadi'), sub('h2','s1','eksik'), sub('h3','s1','yapilmadi'),
    ]
    expect(computeRiskyStudents(students, homeworks, submissions)).toHaveLength(0)
  })
})

// --- computeWeeklyTrend ---
describe('computeWeeklyTrend()', () => {
  it('ödev yok → boş dizi', () => {
    expect(computeWeeklyTrend([], [])).toEqual([])
  })

  it('hafta anahtarı haftanın pazartesisidir (sunucu saat diliminden bağımsız)', () => {
    // 2026-05-01 Cuma → hafta 2026-04-27 Pazartesi. Eski kod toISOString() ile UTC'ye
    // çevirdiği için TR saat dilimli makinede 2026-04-26 (Pazar) üretiyordu.
    const [bucket] = computeWeeklyTrend([hw('h1', 'c1', '2026-05-01')], [sub('h1', 's1', 'yapildi')])
    expect(bucket.weekKey).toBe('2026-04-27')
  })

  it('due_date null → atlanır', () => {
    expect(computeWeeklyTrend([hw('h1', 'c1', null)], [])).toEqual([])
  })

  it('aynı haftaki iki ödev → tek bucket', () => {
    const homeworks = [hw('h1','c1','2026-06-02'), hw('h2','c1','2026-06-03')]
    expect(computeWeeklyTrend(homeworks, [sub('h1', 's1', 'yapildi'), sub('h2', 's1', 'eksik')])).toHaveLength(1)
  })

  it('tamamlanma oranı doğru: 1/2 yapıldı → pct=50', () => {
    const homeworks = [hw('h1','c1','2026-06-02')]
    const submissions = [sub('h1','s1','yapildi'), sub('h1','s2','yapilmadi')]
    const students = [student('s1','c1'), student('s2','c1')]
    const result = computeWeeklyTrend(homeworks, submissions)
    expect(result).toHaveLength(1)
    expect(result[0].pct).toBe(50)
  })

  it('en fazla 8 hafta döner', () => {
    const homeworks = Array.from({ length: 10 }, (_, i) => {
      const d = new Date('2026-01-05')
      d.setDate(d.getDate() + i * 7)
      return hw(`h${i}`, 'c1', d.toISOString().slice(0, 10))
    })
    const subs = homeworks.map(h => sub(h.id, 's1', 'yapildi'))
    expect(computeWeeklyTrend(homeworks, subs)).toHaveLength(8)
  })
})

// --- computeKpiCards ---
describe('computeKpiCards()', () => {
  it('boş veri → sıfır döner, crash yok', () => {
    expect(computeKpiCards([], [], [], 0)).toEqual({
      totalHomeworks: 0, avgCompletionPct: 0, riskyStudentCount: 0, pendingReviewCount: 0,
    })
  })

  it('toplam ödev sayısı doğru', () => {
    expect(computeKpiCards([hw('h1','c1'), hw('h2','c1')], [], [], 0).totalHomeworks).toBe(2)
  })

  it('pendingReview: tarihi geçmiş + submission yok', () => {
    const homeworks = [hw('h1','c1','2020-01-01'), hw('h2','c1','2030-12-31')]
    expect(computeKpiCards(homeworks, [], [student('s1','c1')], 0).pendingReviewCount).toBe(1)
  })

  it('pendingReview: kısmi işaretleme (1/2 öğrenci) → hâlâ pending', () => {
    const homeworks = [hw('h1','c1','2020-01-01')]
    const students  = [student('s1','c1'), student('s2','c1')]
    const submissions = [sub('h1','s1','yapildi')]
    expect(computeKpiCards(homeworks, submissions, students, 0).pendingReviewCount).toBe(1)
  })

  it('pendingReview: tüm öğrenciler işaretlendi → pending değil', () => {
    const homeworks = [hw('h1','c1','2020-01-01')]
    const students  = [student('s1','c1'), student('s2','c1')]
    const submissions = [sub('h1','s1','yapildi'), sub('h1','s2','eksik')]
    expect(computeKpiCards(homeworks, submissions, students, 0).pendingReviewCount).toBe(0)
  })

  it('riskyStudentCount dışarıdan geçirilir', () => {
    const students = [student('s1','c1')]
    const homeworks = [hw('h1','c1'), hw('h2','c1'), hw('h3','c1')]
    const submissions = [
      sub('h1','s1','yapilmadi'), sub('h2','s1','eksik'), sub('h3','s1','yapilmadi'),
    ]
    const risky = computeRiskyStudents(students, homeworks, submissions)
    expect(computeKpiCards(homeworks, submissions, students, risky.length).riskyStudentCount).toBe(1)
  })
})

// --- heatLevel ---
describe('heatLevel()', () => {
  it('>=75 yüksek, 50-74 orta, <50 düşük', () => {
    expect(heatLevel(90)).toBe('high')
    expect(heatLevel(75)).toBe('high')
    expect(heatLevel(74)).toBe('mid')
    expect(heatLevel(50)).toBe('mid')
    expect(heatLevel(49)).toBe('low')
    expect(heatLevel(0)).toBe('low')
  })
})

// --- computeClassWeekHeatmap ---
describe('computeClassWeekHeatmap()', () => {
  const classes = [{ id: 'c1', name: '9-A' }, { id: 'c2', name: '9-B' }]

  it('boş veri → satır yok, hafta yok', () => {
    const res = computeClassWeekHeatmap([], [], classes)
    expect(res.weeks).toEqual([])
    expect(res.rows).toEqual([])
  })

  it('tek sınıf tek hafta: tüm yapıldı → hücre %100, level high', () => {
    const homeworks = [hw('h1', 'c1', '2026-05-04')] // Pazartesi
    const submissions = [sub('h1', 's1', 'yapildi'), sub('h1', 's2', 'yapildi')]
    const students = [student('s1', 'c1'), student('s2', 'c1')]
    const res = computeClassWeekHeatmap(homeworks, submissions, classes)
    expect(res.weeks).toHaveLength(1)
    const row = res.rows.find(r => r.classId === 'c1')!
    expect(row.className).toBe('9-A')
    expect(row.cells[0]).toEqual({ pct: 100, level: 'high' })
  })

  it('o hafta ödevi olmayan sınıf hücresi null (başka haftada ödevi olan sınıf)', () => {
    // c1 hafta-1'de, c2 hafta-2'de ödev verir → her sınıf diğerinin haftasında null.
    const homeworks = [hw('h1', 'c1', '2026-05-04'), hw('h2', 'c2', '2026-05-11')]
    const submissions = [sub('h1', 's1', 'yapildi'), sub('h2', 's2', 'yapildi')]
    const students = [student('s1', 'c1'), student('s2', 'c2')]
    const res = computeClassWeekHeatmap(homeworks, submissions, classes)
    expect(res.weeks).toHaveLength(2)
    const rowC2 = res.rows.find(r => r.classId === 'c2')!
    expect(rowC2.cells[0]).toBeNull()        // hafta-1: c2'nin ödevi yok
    expect(rowC2.cells[1]).not.toBeNull()    // hafta-2: c2'nin ödevi var
  })

  it('mazeretli paydadan çıkar: 1 yapıldı + 1 mazeretli / 2 öğrenci → %100', () => {
    const homeworks = [hw('h1', 'c1', '2026-05-04')]
    const submissions = [sub('h1', 's1', 'yapildi'), sub('h1', 's2', 'mazeretli')]
    const students = [student('s1', 'c1'), student('s2', 'c1')]
    const res = computeClassWeekHeatmap(homeworks, submissions, classes)
    expect(res.rows.find(r => r.classId === 'c1')!.cells[0]).toEqual({ pct: 100, level: 'high' })
  })

  it('due_date null ödevler atlanır', () => {
    const homeworks = [hw('h1', 'c1', null)]
    const submissions = [sub('h1', 's1', 'yapildi')]
    const students = [student('s1', 'c1')]
    const res = computeClassWeekHeatmap(homeworks, submissions, classes)
    expect(res.weeks).toEqual([])
  })

  it('hiç ödevi olmayan sınıf satırı dahil edilmez', () => {
    const homeworks = [hw('h1', 'c1', '2026-05-04')]
    const submissions = [sub('h1', 's1', 'yapildi')]
    const students = [student('s1', 'c1')]
    const res = computeClassWeekHeatmap(homeworks, submissions, classes)
    expect(res.rows.some(r => r.classId === 'c2')).toBe(false)
  })

  it('en fazla son 8 hafta', () => {
    // 10 farklı haftada ödev — hepsi c1
    const homeworks: AnalitikHomework[] = []
    const submissions: AnalitikSubmission[] = []
    for (let w = 0; w < 10; w++) {
      const day = String(3 + w * 7).padStart(2, '0') // her hafta ~7 gün ileri (Mart 2026 içinde)
      const id = `h${w}`
      homeworks.push(hw(id, 'c1', `2026-03-${day > '31' ? '31' : day}`))
      submissions.push(sub(id, 's1', 'yapildi'))
    }
    const students = [student('s1', 'c1')]
    const res = computeClassWeekHeatmap(homeworks, submissions, classes)
    expect(res.weeks.length).toBeLessThanOrEqual(8)
  })
})

// --- işaretsiz ≠ yapılmadı (2026-10-02) ---
// Girdi yalnız İŞARETLİ gönderilerdir. Payda sınıf mevcudu değil işaretli (mazeretsiz) gönderi sayısıdır:
// kontrol edilmemiş ödev ya da yarım kontrol oranı düşürmez (stats.ts completionRate ile aynı tanım).
describe('tamamlanma paydası: kontrol edilmemiş öğrenci sayılmaz', () => {
  const students = [student('s1', 'c1'), student('s2', 'c1'), student('s3', 'c1'), student('s4', 'c1')]
  // h1: 4 öğrenciden 2'si işaretli, ikisi de yapmış · h2: hiç kontrol edilmemiş
  const homeworks = [hw('h1', 'c1', '2026-05-04'), hw('h2', 'c1', '2026-05-05')]
  const submissions = [sub('h1', 's1', 'yapildi'), sub('h1', 's2', 'yapildi')]

  it('computeClassStats → %100 (eskiden 2/8 = %25)', () => {
    expect(computeClassStats('c1', homeworks, submissions, 4).completionPct).toBe(100)
  })
  it('computeClassStats: hiç kontrol edilmemiş sınıf → null (%0 değil)', () => {
    expect(computeClassStats('c1', homeworks, [], 4).completionPct).toBeNull()
  })
  it('computeKpiCards → kontrol edilmemiş ödev ortalamaya girmez: %100', () => {
    expect(computeKpiCards(homeworks, submissions, students, 0).avgCompletionPct).toBe(100)
  })
  it('computeWeeklyTrend → %100; hiç kontrol edilmemiş hafta listede yok', () => {
    expect(computeWeeklyTrend(homeworks, submissions)).toEqual([{ weekKey: '2026-05-04', pct: 100 }])
    expect(computeWeeklyTrend(homeworks, [])).toEqual([])
  })
  it('computeClassWeekHeatmap → %100; hiç kontrol edilmemiş hücre null', () => {
    const sinif = [{ id: 'c1', name: '9-A' }]
    expect(computeClassWeekHeatmap(homeworks, submissions, sinif).rows[0].cells[0]).toEqual({ pct: 100, level: 'high' })
    expect(computeClassWeekHeatmap(homeworks, [], sinif).rows[0].cells[0]).toBeNull()
  })
})
