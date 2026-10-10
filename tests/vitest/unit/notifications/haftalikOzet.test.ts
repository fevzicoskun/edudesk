import { describe, it, expect } from 'vitest'
import { haftalikOzetMaili, HAFTALIK_OZET_BASLANGIC, type OzetGirdi } from '@/src/domains/notifications/haftalikOzetMath'
import type { RiskAlert } from '@/src/domains/dashboard/types'
import type { HwRow } from '@/src/domains/dashboard/lib/riskEngine'

const PZT = '2026-10-19'
const hw = (id: string, due: string, title = `Ödev ${id}`): HwRow =>
  ({ id, title, subject: 'Matematik', due_date: due, class_id: 'c1', classes: { name: '9-A', grade: 9 } })
const risk = (ad: string, riskLevel: RiskAlert['riskLevel']): RiskAlert =>
  ({ studentId: `s-${ad}`, studentName: ad, classId: 'c1', className: '9-A', riskLevel, reasons: ['Son 5 ödevde 3 eksik'], hwMisses: 3, absences: 0 })
const girdi = (g: Partial<OzetGirdi>): OzetGirdi =>
  ({ ad: 'Ayşe <Öğretmen>', bugun: PZT, baseUrl: 'https://x.test', riskler: [], odevler: [], kontrolEdilenIds: new Set(), ...g })

describe('haftalikOzetMaili', () => {
  it('söyleyecek bir şey yoksa null (boş mail atılmaz)', () => {
    expect(haftalikOzetMaili(girdi({}))).toBeNull()
    // yalnız düşük risk + kontrol edilmiş geçmiş ödev + 7 gün sonrası ödev → yine boş
    expect(haftalikOzetMaili(girdi({
      riskler: [risk('Ali', 'low')],
      odevler: [hw('a', '2026-10-15'), hw('b', '2026-10-26')],
      kontrolEdilenIds: new Set(['a']),
    }))).toBeNull()
  })

  it('yalnız orta/yüksek riskli öğrenciler, en ağır 5 + kalan sayısı; konu öğrenci saymaz', () => {
    const riskler = ['A', 'B', 'C', 'D', 'E', 'F'].map(a => risk(a, 'high'))
      .concat({ ...risk('Ağır', 'high'), hwMisses: 5, absences: 2 }, risk('Düşük', 'low'))
    const m = haftalikOzetMaili(girdi({ riskler }))!
    expect(m.html.indexOf('>Ağır<')).toBeGreaterThan(-1)
    expect(m.html.indexOf('>Ağır<')).toBeLessThan(m.html.indexOf('>A<')) // en ağır en üstte
    expect(m.html).toContain('href="https://x.test/siniflar/c1/ogrenciler/s-A"')
    expect(m.html).not.toContain('>F<')
    expect(m.html).toContain('+2 öğrenci daha')
    expect(m.html).not.toContain('Düşük')
    expect(m.subject).toBe('EduDesk haftalık özet')
  })

  it('kontrol bekleyen = teslimi geçmiş ve işaretlenmemiş; bu hafta = bugün..+6', () => {
    const m = haftalikOzetMaili(girdi({
      odevler: [hw('gecmis', '2026-10-16', 'Bekleyen'), hw('kontrol', '2026-10-14', 'Kontrollü'),
        hw('bugun', PZT, 'Bugünkü'), hw('pazar', '2026-10-25', 'Pazar'), hw('sonra', '2026-10-26', 'Sonraki')],
      kontrolEdilenIds: new Set(['kontrol']),
    }))!
    expect(m.html).toContain('Bekleyen')
    expect(m.html).not.toContain('Kontrollü')
    expect(m.html).toContain('Bugünkü')
    expect(m.html).toContain('Pazar')
    expect(m.html).not.toContain('Sonraki')
    expect(m.subject).toContain('1 kontrol bekleyen ödev')
  })

  it('kullanıcı içeriği kaçışlanır', () => {
    const m = haftalikOzetMaili(girdi({ odevler: [hw('x', PZT, '<script>')] }))!
    expect(m.html).not.toContain('<script>')
    expect(m.html).toContain('Ayşe &lt;Öğretmen&gt;')
  })

  it('ilk gönderim 19 Ekim 2026', () => {
    expect(HAFTALIK_OZET_BASLANGIC).toBe('2026-10-19')
  })
})
