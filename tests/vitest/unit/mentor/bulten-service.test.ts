// tests/vitest/unit/mentor/bulten-service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { HomeworkRecord } from '@/src/domains/homework/lib/stats'

vi.mock('@/src/shared/authorization/server', () => ({ requireAbility: vi.fn().mockResolvedValue({ userId: 'm1', schoolId: 's1' }) }))
vi.mock('@/src/shared/auth', () => ({ getCurrentProfile: vi.fn() }))
vi.mock('@/src/domains/mentor/services/MentorService', () => ({ MentorService: { getMyMentorships: vi.fn() } }))
vi.mock('@/src/domains/homework/services/HomeworkService', () => ({ HomeworkService: { getMentorHomeworkProfiles: vi.fn() } }))
vi.mock('@/src/domains/mentor/repositories/BultenRepository', () => ({ BultenRepository: { ekBilgi: vi.fn() } }))

const { getCurrentProfile } = await import('@/src/shared/auth')
const { MentorService } = await import('@/src/domains/mentor/services/MentorService')
const { HomeworkService } = await import('@/src/domains/homework/services/HomeworkService')
const { BultenRepository } = await import('@/src/domains/mentor/repositories/BultenRepository')
const { BultenService } = await import('@/src/domains/mentor/services/BultenService')

const k = (o: Partial<HomeworkRecord>): HomeworkRecord => ({ id: 'h', title: 'T', subject: 'Fizik', due_date: '2026-10-07', status: null, note: null, teacher_id: 't1', bekliyor: false, ...o })

beforeEach(() => {
  vi.mocked(getCurrentProfile).mockResolvedValue({ id: 'm1', full_name: 'Fevzi Coşkun', subject: 'Matematik', school_id: 's1', role: 'ogretmen' } as never)
  vi.mocked(MentorService.getMyMentorships).mockResolvedValue([
    { student_id: 'a', full_name: 'Ali', class_name: '9-A', last_report_date: null, idare_atadi: false },
    { student_id: 'b', full_name: 'Ayşe', class_name: '9-A', last_report_date: null, idare_atadi: false },
    { student_id: 'c', full_name: 'Can', class_name: '10-A', last_report_date: null, idare_atadi: false },
  ])
  vi.mocked(HomeworkService.getMentorHomeworkProfiles).mockResolvedValue({ ogrenciler: [
    // eski verilmiş (28 Eyl), geçen hafta kontrol (7 Ekim) — bas filtresi olsaydı düşerdi
    { id: 'a', full_name: 'Ali', student_number: null, class_id: 'c9', class_name: '9-A', stats: {} as never,
      homeworks: [k({ id: 'f1', status: 'yapilmadi' }), k({ id: 'n1', due_date: '2026-10-14', subject: 'Kimya' })] },
    { id: 'b', full_name: 'Ayşe', student_number: null, class_id: 'c9', class_name: '9-A', stats: {} as never,
      homeworks: [k({ id: 'f1', status: 'yapildi' }), k({ id: 'n1', due_date: '2026-10-14', subject: 'Kimya' })] },
    { id: 'c', full_name: 'Can', student_number: null, class_id: 'c10', class_name: '10-A', stats: {} as never,
      homeworks: [k({ id: 'g1', due_date: '2026-10-08', status: 'eksik', teacher_id: 't2' })] },
  ] })
  vi.mocked(BultenRepository.ekBilgi).mockResolvedValue({
    telefonlar: new Map([['a', '0532 123 45 67'], ['b', null], ['c', null]]),
    okulAdi: 'Bahçeşehir Koleji Denizli',
    ogretmenAdlari: new Map([['t1', 'Esra Ergün'], ['t2', 'Pınar Çaprak']]),
  })
})

describe('BultenService.getBulten', () => {
  it('pazartesi olmayan hafta reddedilir', async () => {
    await expect(BultenService.getBulten('2026-10-13')).rejects.toThrow('Geçersiz hafta')
  })

  it('ödev profilleri bas filtresi OLMADAN istenir (eski verilmiş ödev kaçmasın)', async () => {
    await BultenService.getBulten('2026-10-12')
    expect(HomeworkService.getMentorHomeworkProfiles).toHaveBeenCalledWith(['a', 'b', 'c'])
  })

  it('sınıf başına grup verisi, öğrenci başına mesaj', async () => {
    const b = await BultenService.getBulten('2026-10-12')
    expect(b.mentorUnvani).toBe('Matematik Öğretmeni Fevzi Coşkun')
    expect(b.okulAdi).toBe('Bahçeşehir Koleji Denizli')
    expect(b.siniflar.map(s => s.class_name)).toEqual(['9-A', '10-A'])   // numeric sıralama
    const s9 = b.siniflar.find(s => s.class_id === 'c9')!
    expect(s9.ozet).toEqual([expect.objectContaining({ id: 'f1', toplam: 2, yapildi: 1, yapilmadi: 1 })])
    expect(s9.gunler[2].odevler).toEqual([expect.objectContaining({ id: 'n1', ogretmen: 'Esra Ergün' })])
    const ali = b.ogrenciler.find(o => o.student_id === 'a')!
    expect(ali.eksikler.map(e => e.id)).toEqual(['f1'])
    expect(ali.telefon).toBe('0532 123 45 67')
    expect(ali.mesaj).toContain('*Ali* (9-A)')
    expect(b.ogrenciler.find(o => o.student_id === 'b')!.mesaj).toContain('Tebrikler')
  })

  it('mentörlükte öğrenci yoksa boş bülten, ödev servisi çağrılmaz', async () => {
    vi.mocked(MentorService.getMyMentorships).mockResolvedValue([])
    vi.mocked(HomeworkService.getMentorHomeworkProfiles).mockClear()
    const b = await BultenService.getBulten('2026-10-12')
    expect(b.ogrenciler).toEqual([]); expect(b.siniflar).toEqual([])
    expect(HomeworkService.getMentorHomeworkProfiles).not.toHaveBeenCalled()
  })

  it('ödev servisi hata dönerse fırlatır (sessiz boş bülten yok)', async () => {
    vi.mocked(HomeworkService.getMentorHomeworkProfiles).mockResolvedValue({ error: 'Bu işlem için yetkiniz yok.' })
    await expect(BultenService.getBulten('2026-10-12')).rejects.toThrow('yetkiniz yok')
  })
})
