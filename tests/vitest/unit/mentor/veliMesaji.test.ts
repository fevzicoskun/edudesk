import { describe, it, expect } from 'vitest'
import { takipVeliMesaji } from '@/src/domains/mentor/takip/veliMesaji'
import { yeniHafta, BOS_GORUSME, type OkulOdevBolumleri, type OkulOdevi } from '@/src/domains/mentor/takip/takipMath'

const odev = (id: string, subject: string, status: string | null): OkulOdevi => ({ id, subject, title: `Ödev ${id}`, due_date: '2026-10-20', status, bekliyor: false })
const BOS: OkulOdevBolumleri = { tamamlanmamis: [], buHafta: [], gelecek: [] }

const temel = () => {
  const veri = yeniHafta(null, 9)
  veri.icerik.gorevler = veri.icerik.gorevler.slice(0, 4).map((g, i) => ({ ...g, yapti: i < 3 }))
  return { ogrenciAdi: 'Ali Yılmaz', pazartesi: '2026-10-19', veri, onceki: null, okul: BOS, kitaplar: [], mentorAdi: 'Fevzi Coşkun' }
}

describe('takipVeliMesaji — haftanın verisinden otomatik (2026-10-17)', () => {
  it('başlık, program ve imza; WhatsApp\'a uygun madde işaretli', () => {
    const m = takipVeliMesaji(temel())
    expect(m.split('\n')[0]).toBe('Sayın Veli, Ali Yılmaz için 19–25 Ekim haftasının özeti:')
    expect(m).toContain('• Program: %75 (3/4 görev)')
    expect(m.trim().endsWith('Fevzi Coşkun')).toBe(true)
  })
  it('okul ödevleri X/Y yapıldı + yapılmayanların adı; işaretsizler ayrıca belirtilir; eski tamamlanmamışlar', () => {
    const g = temel()
    g.okul = {
      tamamlanmamis: [odev('e1', 'Kimya', 'yapilmadi')],
      buHafta: [odev('1', 'Fizik', 'yapildi'), odev('2', 'Matematik', 'gec'), odev('3', 'Türkçe', 'yapilmadi'), odev('4', 'Tarih', null)],
      gelecek: [],
    }
    const m = takipVeliMesaji(g)
    expect(m).toContain('• Okul ödevleri: 2/4 yapıldı, 1 tanesi henüz kontrol edilmedi. Yapılmayan: Türkçe – Ödev 3')
    expect(m).toContain('• Önceki haftalardan tamamlanmamış: Kimya – Ödev e1')
  })
  it('soru, doğruluk (geçen haftaya göre) ve ders bazında kısa özet', () => {
    const g = temel()
    g.veri.icerik.sonuclar = [
      { anahtar: 'd:Matematik', ad: 'Matematik', ders: 'Matematik', sayfa: '', cozulen: 100, dogru: 70, yanlis: 20, bos: 10 },
      { anahtar: 'd:Türkçe', ad: 'Türkçe', ders: 'Türkçe', sayfa: '', cozulen: 50, dogru: 45, yanlis: 5, bos: 0 },
    ]
    const m = takipVeliMesaji({ ...g, onceki: { gorev_toplam: 1, gorev_yapilan: 1, soru: 100, dogru: 70, okuma_sayfa: 0, islendi: true } })
    expect(m).toContain('• Soru: 150 soru, doğruluk %77 (geçen hafta %70)')
    expect(m).toContain('• Ders bazında: Matematik %70 · Türkçe %90')
  })
  it('öğretmen notu ve veliden ricam; boş alanlar ve işlenmemiş hafta satırı yazılmaz', () => {
    const g = temel()
    g.veri.icerik.gorevler = g.veri.icerik.gorevler.map(x => ({ ...x, yapti: false }))
    g.veri.gorusme = { ...BOS_GORUSME, not: 'Düzenli çalıştı', rica: 'Telefonu akşam alın' }
    const m = takipVeliMesaji(g)
    expect(m).toContain('• Öğretmen notu: Düzenli çalıştı')
    expect(m).toContain('• Sizden ricam: Telefonu akşam alın')
    for (const s of ['• Program', '• Soru', '• Okul ödevleri', '• Önceki haftalardan', '• Ders bazında']) expect(m).not.toContain(s)
  })
  it('öğrenci planın gerisinde kaldıysa kaynak satırı: planlanan / kaldığı sayfa', () => {
    const g = temel()
    g.veri.icerik.gorevler = [{ ...g.veri.icerik.gorevler[0], soruSatiri: true, kitapId: 'k1', kitapAdi: 'Acil Mat', sayfaBas: 45, sayfaSon: 60 }]
    g.veri.icerik.sonuclar = [{ anahtar: 'k:k1', ad: 'Acil Mat', ders: 'Matematik', sayfa: 's. 45–60', cozulen: 10, dogru: 8, yanlis: 2, bos: 0, kaldigi: 55 }]
    expect(takipVeliMesaji(g)).toContain('• Kaynaklar: Acil Mat planlanan s. 60, kaldığı s. 55')
    g.veri.icerik.sonuclar[0].kaldigi = 60
    expect(takipVeliMesaji(g)).not.toContain('• Kaynaklar')
  })
  it('uzun listeler kısalır, mesaj ~10 satırı geçmez', () => {
    const g = temel()
    g.okul = { tamamlanmamis: Array.from({ length: 6 }, (_, i) => odev(`e${i}`, 'Kimya', 'yapilmadi')),
      buHafta: Array.from({ length: 8 }, (_, i) => odev(`${i}`, 'Fizik', 'yapilmadi')), gelecek: [] }
    g.veri.icerik.sonuclar = [{ anahtar: 'd:M', ad: 'M', ders: 'Matematik', sayfa: '', cozulen: 10, dogru: 5, yanlis: 5, bos: 0 }]
    g.veri.gorusme = { ...BOS_GORUSME, not: 'N', rica: 'R' }
    const m = takipVeliMesaji(g)
    expect(m).toContain('ve 5 ödev daha')
    expect(m.split('\n').filter(s => s.trim()).length).toBeLessThanOrEqual(11)
  })
})
