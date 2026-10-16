import { describe, it, expect } from 'vitest'
import { takipVeliMesaji } from '@/src/domains/mentor/takip/veliMesaji'
import { yeniHafta, BOS_GORUSME } from '@/src/domains/mentor/takip/takipMath'

const temel = () => {
  const veri = yeniHafta(null, 9)
  veri.icerik.gorevler = veri.icerik.gorevler.slice(0, 4).map((g, i) => ({ ...g, yapti: i < 3, soruSatiri: i === 1, soru: i === 1 ? 100 : null, dogru: i === 1 ? 80 : null }))
  return { ogrenciAdi: 'Ali Yılmaz', pazartesi: '2026-10-19', veri, onceki: null, konular: { oturan: [] as string[], calisilan: [] as string[] }, mentorAdi: 'Fevzi Coşkun' }
}

describe('takipVeliMesaji', () => {
  it('temel satırlar ve imza', () => {
    const m = takipVeliMesaji(temel())
    expect(m).toContain('Sayın Veli, Ali Yılmaz için 19–23 Ekim haftasının özeti:')
    expect(m).toContain('• Program: 4 görevin 3 tanesini tamamladı (%75).')
    expect(m).toContain('• Soru: 100 soru çözdü (hedef 120), doğruluk %80.')
    expect(m.trim().endsWith('Fevzi Coşkun')).toBe(true)
  })
  it('boş alanlar atlanır', () => {
    const m = takipVeliMesaji(temel())
    for (const s of ['Ekstra', 'Oturan', 'İyi giden', 'Zorlandığı', 'Evde sizden ricam', 'Okuma']) expect(m).not.toContain(s)
  })
  it('fark, okuma, görüşme, konular', () => {
    const g = temel()
    g.veri.icerik.okuma = { kitap: 'Kürk Mantolu Madonna', sayfa: 120, bitti: true }
    g.veri.gorusme = { ...BOS_GORUSME, iyi: 'Düzenli', evde: 'Telefonu akşam alın' }
    g.konular = { oturan: ['Türev'], calisilan: ['İntegral'] }
    const m = takipVeliMesaji({ ...g, onceki: { gorev_toplam: 1, gorev_yapilan: 1, soru: 100, dogru: 70, okuma_sayfa: 0, islendi: true } })
    expect(m).toContain('doğruluk %80, geçen haftaya göre 10 puan arttı.')
    expect(m).toContain('• Okuma: Kürk Mantolu Madonna kitabını bitirdi (bu hafta 120 sayfa).')
    expect(m).toContain('• Oturan konular: Türev')
    expect(m).toContain('• İyi giden: Düzenli')
    expect(m).toContain('Evde sizden ricam: Telefonu akşam alın')
  })
  it('görev listesi boş → program satırı yok', () => {
    const g = temel(); g.veri.icerik.gorevler = []
    expect(takipVeliMesaji(g)).not.toContain('• Program')
  })
  it('işlenmemiş hafta (hiç ✓/soru yok) → "0 tanesini (%0)" yazmaz', () => {
    const g = temel(); g.veri.icerik.gorevler = g.veri.icerik.gorevler.map(x => ({ ...x, yapti: false, soru: null, dogru: null }))
    expect(takipVeliMesaji(g)).not.toContain('• Program')
  })
  it('program yüzdesi mentör ödevlerini de sayar (veli raporu kutusuyla aynı)', () => {
    const g = temel()
    g.veri.icerik.mentorOdevleri = [
      { id: 'm1', kitapId: null, kitapAdi: 'K', konu: '', sayfalar: '', yapti: true },
      { id: 'm2', kitapId: null, kitapAdi: 'K', konu: '', sayfalar: '', yapti: true },
    ]
    expect(takipVeliMesaji(g)).toContain('• Program: 6 görevin 5 tanesini tamamladı (%83).')
  })
})

describe('konuAdlari', () => {
  it('oturdu=2 → oturan, çalışılıyor=1 → çalışılan, durumsuz/0 → hiçbiri', async () => {
    const { konuAdlari } = await import('@/src/domains/mentor/takip/veliMesaji')
    const konular = [{ id: 'a', ad: 'Türev' }, { id: 'b', ad: 'İntegral' }, { id: 'c', ad: 'Limit' }, { id: 'd', ad: 'Dizi' }]
    expect(konuAdlari(konular, { a: 2, b: 1, c: 0 })).toEqual({ oturan: ['Türev'], calisilan: ['İntegral'] })
  })
})
