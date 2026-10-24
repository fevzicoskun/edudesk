import { describe, it, expect } from 'vitest'
import {
  mondayOf,
  buildHwMissMap,
  buildAbsenceMap,
  computeAlerts,
} from '@/src/domains/dashboard/services/TeacherDashboardService'

// ─── mondayOf ────────────────────────────────────────────────
// Haftanın Pazartesisini döndürür; Pazar için önceki Pazartesi.

describe('mondayOf()', () => {
  it('Pazartesi girişi → aynı tarihi döndürür', () => {
    expect(mondayOf('2026-06-01')).toBe('2026-06-01') // 2026-06-01 Pazartesi
  })

  it('Çarşamba girişi → o haftanın Pazartesini döndürür', () => {
    expect(mondayOf('2026-06-03')).toBe('2026-06-01') // 2026-06-03 Çarşamba
  })

  it('Pazar girişi → önceki Pazartesiyi döndürür (diff = -6)', () => {
    expect(mondayOf('2026-06-07')).toBe('2026-06-01') // 2026-06-07 Pazar
  })

  it('Cuma girişi → o haftanın Pazartesini döndürür', () => {
    expect(mondayOf('2026-06-05')).toBe('2026-06-01') // 2026-06-05 Cuma
  })

  it('Ay sınırını doğru geçer — Mayıs sonu / Haziran başı', () => {
    expect(mondayOf('2026-06-02')).toBe('2026-06-01') // Salı → Pazartesi aynı hafta
    expect(mondayOf('2026-05-31')).toBe('2026-05-25') // Pazar → önceki Pazartesi
  })

  it('YYYY-MM-DD formatını döndürür (zero-pad)', () => {
    const result = mondayOf('2026-03-04') // Çarşamba
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result).toBe('2026-03-02')
  })
})

// ─── buildHwMissMap ──────────────────────────────────────────
// eksik / yapilmadi / gec → miss olarak sayılır; yapildi / mazeretli sayılmaz.

describe('buildHwMissMap()', () => {
  it('eksik statüs sayılır', () => {
    const map = buildHwMissMap([
      { homework_id: 'hw1', student_id: 'stu1', status: 'eksik' },
    ])
    expect(map.get('stu1')).toBe(1)
  })

  it('yapilmadi statüs sayılır', () => {
    const map = buildHwMissMap([
      { homework_id: 'hw1', student_id: 'stu1', status: 'yapilmadi' },
    ])
    expect(map.get('stu1')).toBe(1)
  })

  it('gec statüs sayılır', () => {
    const map = buildHwMissMap([
      { homework_id: 'hw1', student_id: 'stu1', status: 'gec' },
    ])
    expect(map.get('stu1')).toBe(1)
  })

  it('yapildi ve mazeretli sayılmaz', () => {
    const map = buildHwMissMap([
      { homework_id: 'hw1', student_id: 'stu1', status: 'yapildi' },
      { homework_id: 'hw2', student_id: 'stu1', status: 'mazeretli' },
    ])
    expect(map.get('stu1')).toBeUndefined()
  })

  it('aynı öğrencinin birden fazla eksiki toplanır', () => {
    const map = buildHwMissMap([
      { homework_id: 'hw1', student_id: 'stu1', status: 'eksik' },
      { homework_id: 'hw2', student_id: 'stu1', status: 'yapilmadi' },
      { homework_id: 'hw3', student_id: 'stu1', status: 'gec' },
    ])
    expect(map.get('stu1')).toBe(3)
  })

  it('limitToHwIds: sadece verilen ödev id\'lerindeki eksikler sayılır', () => {
    const limit = new Set(['hw1'])
    const map = buildHwMissMap([
      { homework_id: 'hw1', student_id: 'stu1', status: 'eksik' },
      { homework_id: 'hw2', student_id: 'stu1', status: 'eksik' }, // limit dışı
    ], limit)
    expect(map.get('stu1')).toBe(1)
  })

  it('limitToHwIds boş set → tüm eksikler filtrelenir', () => {
    const map = buildHwMissMap([
      { homework_id: 'hw1', student_id: 'stu1', status: 'eksik' },
    ], new Set())
    expect(map.get('stu1')).toBeUndefined()
  })

  it('farklı öğrenciler bağımsız sayılır', () => {
    const map = buildHwMissMap([
      { homework_id: 'hw1', student_id: 'stu1', status: 'eksik' },
      { homework_id: 'hw1', student_id: 'stu2', status: 'eksik' },
      { homework_id: 'hw2', student_id: 'stu2', status: 'eksik' },
    ])
    expect(map.get('stu1')).toBe(1)
    expect(map.get('stu2')).toBe(2)
  })
})

// ─── buildAbsenceMap ─────────────────────────────────────────
// Sadece 'absent' sayılır; 'present' ve 'late' sayılmaz.

describe('buildAbsenceMap()', () => {
  it('absent sayılır', () => {
    const map = buildAbsenceMap([{ student_id: 'stu1', status: 'absent' }])
    expect(map.get('stu1')).toBe(1)
  })

  it('present sayılmaz', () => {
    const map = buildAbsenceMap([{ student_id: 'stu1', status: 'present' }])
    expect(map.get('stu1')).toBeUndefined()
  })

  it('late sayılmaz', () => {
    const map = buildAbsenceMap([{ student_id: 'stu1', status: 'late' }])
    expect(map.get('stu1')).toBeUndefined()
  })

  it('birden fazla absent toplanır', () => {
    const map = buildAbsenceMap([
      { student_id: 'stu1', status: 'absent' },
      { student_id: 'stu1', status: 'absent' },
      { student_id: 'stu1', status: 'present' },
    ])
    expect(map.get('stu1')).toBe(2)
  })
})

// ─── computeAlerts ───────────────────────────────────────────
// Kural: öğrencinin İŞARETLİ son 5 ödevi; 4-5 "yapılmadı" = yüksek, 3 = orta, daha azı listede yok.

describe('computeAlerts()', () => {
  const makeStudent = (id: string, classId = 'cls1') => ({
    id, full_name: `Öğrenci ${id}`, class_id: classId, classes: { name: 'Test Sınıfı' },
  })
  // repo ödevleri teslim tarihi YENİDEN eskiye verir: hw1 en yeni
  const odevler = (n: number) => Array.from({ length: n }, (_, i) => ({
    id: `hw${i + 1}`, title: '', subject: '', due_date: `2026-10-${String(30 - i).padStart(2, '0')}`, class_id: 'cls1', classes: null,
  }))
  const durumlar = (stu: string, liste: string[]) =>
    liste.map((status, i) => ({ homework_id: `hw${i + 1}`, student_id: stu, status }))

  it('2 yapmadı listeye girmez', () => {
    const alerts = computeAlerts(odevler(5), durumlar('s', ['yapilmadi', 'yapilmadi', 'yapildi', 'yapildi', 'yapildi']), [], [makeStudent('s')])
    expect(alerts).toHaveLength(0)
  })

  it('3 yapmadı = orta, 4 = yüksek, 5 = yüksek', () => {
    const alerts = computeAlerts(odevler(5), [
      ...durumlar('uc',   ['yapilmadi', 'yapilmadi', 'yapilmadi', 'yapildi', 'yapildi']),
      ...durumlar('dort', ['yapilmadi', 'yapilmadi', 'yapilmadi', 'yapilmadi', 'yapildi']),
      ...durumlar('bes',  ['yapilmadi', 'yapilmadi', 'yapilmadi', 'yapilmadi', 'yapilmadi']),
    ], [], [makeStudent('uc'), makeStudent('dort'), makeStudent('bes')])
    expect(alerts.map(a => [a.studentId, a.riskLevel])).toEqual([['bes', 'high'], ['dort', 'high'], ['uc', 'medium']])
    expect(alerts[2].reasons[0]).toBe('Son 5 ödevden 3 yapılmadı')
  })

  it('eksik ve geç "yapılmadı" sayılmaz', () => {
    const alerts = computeAlerts(odevler(5), durumlar('s', ['eksik', 'gec', 'eksik', 'gec', 'eksik']), [], [makeStudent('s')])
    expect(alerts).toHaveLength(0)
  })

  it('işaretlenmemiş ödev pencereyi doldurmaz: işaretli en yeni 5 sayılır', () => {
    // hw1-hw2 işaretlenmedi (satır yok); hw3-hw7 işaretli → 4 yapmadı
    const subs = [
      { homework_id: 'hw3', student_id: 's', status: 'yapilmadi' },
      { homework_id: 'hw4', student_id: 's', status: 'yapilmadi' },
      { homework_id: 'hw5', student_id: 's', status: 'yapilmadi' },
      { homework_id: 'hw6', student_id: 's', status: 'yapilmadi' },
      { homework_id: 'hw7', student_id: 's', status: 'yapildi' },
    ]
    const alerts = computeAlerts(odevler(7), subs, [], [makeStudent('s')])
    expect(alerts[0].riskLevel).toBe('high')
  })

  it('6. (en eski) işaretli ödev pencere dışında', () => {
    // en yeni 5'te 2 yapmadı, en eski ödevde 1 daha → yine 2 sayılır, listede yok
    const alerts = computeAlerts(odevler(6), durumlar('s', ['yapilmadi', 'yapilmadi', 'yapildi', 'yapildi', 'yapildi', 'yapilmadi']), [], [makeStudent('s')])
    expect(alerts).toHaveLength(0)
  })

  it('mazeretli pencereye girmez', () => {
    const alerts = computeAlerts(odevler(6), durumlar('s', ['mazeretli', 'yapilmadi', 'yapilmadi', 'yapilmadi', 'yapilmadi', 'yapildi']), [], [makeStudent('s')])
    expect(alerts[0].riskLevel).toBe('high')
    expect(alerts[0].hwMisses).toBe(4)
  })

  it('yalnız devamsızlık listeye sokmaz; listedeyse sebep olarak eklenir', () => {
    const alerts = computeAlerts(odevler(5), durumlar('s', ['yapilmadi', 'yapilmadi', 'yapilmadi', 'yapildi', 'yapildi']),
      [{ student_id: 's', status: 'absent' }, { student_id: 'd', status: 'absent' }, { student_id: 'd', status: 'absent' }],
      [makeStudent('s'), makeStudent('d')])
    expect(alerts.map(a => a.studentId)).toEqual(['s'])
    expect(alerts[0].reasons).toEqual(['Son 5 ödevden 3 yapılmadı', 'Son 14 günde 1 gün devamsız'])
  })
})
