// tests/vitest/unit/mentor/bultenMath.test.ts
import { describe, it, expect } from 'vitest'
import type { HomeworkRecord } from '@/src/domains/homework/lib/stats'
import {
  haftaSec, pazartesiMi, haftaEtiketi, gunAy, gunAdi, ogrenciEksikleri, haftaOdevleri, grupOzeti,
  veliMesaji, telefonNormalize, whatsappLink, dersKisa, dersRengi, kisalt,
} from '@/src/domains/mentor/lib/bultenMath'

const P = '2026-10-12' // pazartesi
const kayit = (o: Partial<HomeworkRecord>): HomeworkRecord => ({
  id: 'h1', title: 'Başarıyorum s.1-5', subject: 'Matematik', due_date: '2026-10-07', status: null,
  note: null, teacher_id: 't1', bekliyor: false, ...o,
})

describe('haftaSec', () => {
  it('Perşembe → bu haftanın pazartesisi', () => expect(haftaSec('2026-10-08')).toBe('2026-10-05'))
  it('Cuma → gelecek pazartesi', () => expect(haftaSec('2026-10-09')).toBe('2026-10-12'))
  it('Cumartesi → gelecek pazartesi', () => expect(haftaSec('2026-10-10')).toBe('2026-10-12'))
  it('Pazar → gelecek pazartesi', () => expect(haftaSec('2026-10-11')).toBe('2026-10-12'))
  it('Pazartesi → aynı gün', () => expect(haftaSec('2026-10-12')).toBe('2026-10-12'))
  it('ay geçişi', () => expect(haftaSec('2026-10-30')).toBe('2026-11-02'))
})

describe('tarih etiketleri', () => {
  it('pazartesiMi', () => { expect(pazartesiMi('2026-10-12')).toBe(true); expect(pazartesiMi('2026-10-13')).toBe(false); expect(pazartesiMi('abc')).toBe(false) })
  it('aynı ay', () => expect(haftaEtiketi('2026-10-12')).toBe('12–16 Ekim'))
  it('ay geçen hafta', () => expect(haftaEtiketi('2026-09-28')).toBe('28 Eylül – 2 Ekim'))
  it('gunAy / gunAdi', () => { expect(gunAy('2026-10-14')).toBe('14 Ekim'); expect(gunAdi('2026-10-14')).toBe('Çarşamba') })
})

describe('ogrenciEksikleri', () => {
  it('yalnız geçen haftanın işaretli eksik/yapılmadı ödevleri, tarihe göre', () => {
    const k = [
      kayit({ id: 'a', due_date: '2026-10-08', status: 'yapilmadi' }),
      kayit({ id: 'b', due_date: '2026-10-05', status: 'eksik' }),
      kayit({ id: 'c', due_date: '2026-10-06', status: 'mazeretli' }),
      kayit({ id: 'd', due_date: '2026-10-07', status: null }),          // işaretsiz
      kayit({ id: 'e', due_date: '2026-10-07', status: 'gec' }),         // geç yapıldı
      kayit({ id: 'f', due_date: '2026-10-04', status: 'yapilmadi' }),   // önceki hafta
      kayit({ id: 'g', due_date: '2026-10-12', status: 'yapilmadi' }),   // bu hafta
      kayit({ id: 'h', due_date: null, status: 'yapilmadi' }),
    ]
    expect(ogrenciEksikleri(k, P).map(e => [e.id, e.durum])).toEqual([['b', 'eksik'], ['a', 'yapılmadı']])
  })
  it('pazar kontrollü ödev geçen haftaya dahil', () => {
    expect(ogrenciEksikleri([kayit({ due_date: '2026-10-11', status: 'eksik' })], P)).toHaveLength(1)
  })
})

describe('haftaOdevleri', () => {
  it('Pzt–Cuma 5 gün, boş gün dahil; ödevler kontrol gününe göre', () => {
    const g = haftaOdevleri([
      kayit({ id: 'x', due_date: '2026-10-14', subject: 'Fizik' }),
      kayit({ id: 'y', due_date: '2026-10-12' }),
      kayit({ id: 'z', due_date: '2026-10-20' }),   // sonraki hafta
    ], P)
    expect(g.map(d => d.etiket)).toEqual(['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'])
    expect(g[0].odevler.map(o => o.id)).toEqual(['y'])
    expect(g[2].odevler.map(o => o.id)).toEqual(['x'])
    expect(g[1].odevler).toEqual([])
  })
  it('hafta sonu kontrolü varsa ayrı "Hafta sonu" satırı', () => {
    const g = haftaOdevleri([kayit({ id: 's', due_date: '2026-10-17' })], P)
    expect(g).toHaveLength(6)
    expect(g[5]).toMatchObject({ etiket: 'Hafta sonu', odevler: [{ id: 's' }] })
  })
})

describe('grupOzeti', () => {
  it('ödev başına sayım; mazeretli/işaretsiz paydaya girmez; gec = yapıldı; hiç işaretlenmemiş ödev yok', () => {
    const ali = [kayit({ id: 'a', status: 'yapildi' }), kayit({ id: 'b', due_date: '2026-10-09', status: 'mazeretli' }), kayit({ id: 'n', status: null })]
    const ayse = [kayit({ id: 'a', status: 'eksik' }), kayit({ id: 'b', due_date: '2026-10-09', status: 'gec' }), kayit({ id: 'n', status: null })]
    const veli = [kayit({ id: 'a', status: 'yapilmadi' }), kayit({ id: 'b', due_date: '2026-10-09', status: 'yapilmadi' }), kayit({ id: 'n', status: null })]
    const o = grupOzeti([ali, ayse, veli], P)
    expect(o.map(x => [x.id, x.toplam, x.yapildi, x.eksik, x.yapilmadi])).toEqual([['a', 3, 1, 1, 1], ['b', 2, 1, 0, 1]])
  })
  it('iki grubun toplamı tüm sınıfın toplamına eşit', () => {
    const s = (st: HomeworkRecord['status']) => [kayit({ id: 'a', status: st })]
    const hepsi = grupOzeti([s('yapildi'), s('eksik'), s('yapilmadi')], P)[0]
    const g1 = grupOzeti([s('yapildi')], P)[0], g2 = grupOzeti([s('eksik'), s('yapilmadi')], P)[0]
    expect(g1.toplam + g2.toplam).toBe(hepsi.toplam)
    expect(g1.yapildi + g2.yapildi).toBe(hepsi.yapildi)
  })
})

describe('veliMesaji', () => {
  const gunler = haftaOdevleri([kayit({ id: 'y', due_date: '2026-10-12', title: 'Başarıyorum 38-40' })], P)
  it('eksikli öğrenci', () => {
    const m = veliMesaji({ ogrenciAdi: 'Ali Veli', sinif: '9-A', pazartesi: P, mentorAdi: 'Fevzi Coşkun', gunler,
      eksikler: [{ id: 'a', subject: 'Türk Dili ve Edebiyatı', title: 'PRG 38-57', due_date: '2026-10-07', durum: 'yapılmadı' }] })
    expect(m).toBe([
      'Sayın Velimiz,',
      '*Ali Veli* (9-A) için haftalık ödev bilgilendirmesi:',
      '',
      '*Geçen hafta (5–9 Ekim) tamamlanmayan ödevler:*',
      '• Edebiyat – PRG 38-57 (7 Ekim): yapılmadı',
      '',
      '*Bu hafta (12–16 Ekim) kontrol edilecek ödevler:*',
      '• Pazartesi 12 Ekim – Matematik: Başarıyorum 38-40',
      '',
      'Eksik ödevlerin tamamlanması için desteğinizi rica ederiz.',
      '',
      'Saygılarımızla,',
      'Fevzi Coşkun',
      '9-A Mentör Öğretmeni',
    ].join('\n'))
  })
  it('eksiksiz öğrenci tebrik alır, rica cümlesi olmaz; ödevsiz hafta', () => {
    const m = veliMesaji({ ogrenciAdi: 'Ali', sinif: '9-A', pazartesi: P, mentorAdi: 'X', eksikler: [], gunler: haftaOdevleri([], P) })
    expect(m).toContain('Kontrol edilen ödevlerin tamamını yaptı. Tebrikler! 👏')
    expect(m).toContain('Kontrol edilecek ödev yok.')
    expect(m).not.toContain('desteğinizi rica')
  })
})

describe('telefon ve WhatsApp', () => {
  it.each([
    ['0532 123 45 67', '905321234567'], ['532-123-4567', '905321234567'], ['+90 532 123 45 67', '905321234567'],
    ['905321234567', '905321234567'], ['', null], [null, null], ['12345', null],
  ])('telefonNormalize(%s) = %s', (girdi, beklenen) => expect(telefonNormalize(girdi)).toBe(beklenen))
  it('numarasız link kişi seçtirir, metin kodlanır', () => {
    expect(whatsappLink('a b&c\n*x*', null)).toBe('https://wa.me/?text=a%20b%26c%0A*x*')
  })
  it('numaralı link', () => expect(whatsappLink('hi', '0532 123 45 67')).toBe('https://wa.me/905321234567?text=hi'))
})

describe('ders adı, renk, kısaltma', () => {
  it('dersKisa', () => { expect(dersKisa('Türk Dili ve Edebiyatı')).toBe('Edebiyat'); expect(dersKisa('Fizik')).toBe('Fizik') })
  it('dersRengi bilinmeyen için gri', () => { expect(dersRengi('Fizik')).toBe('#E0662E'); expect(dersRengi('Resim')).toBe('#7A7F8C') })
  it('kisalt', () => { expect(kisalt('abcdef', 4)).toBe('abc…'); expect(kisalt('abc', 4)).toBe('abc') })
})
