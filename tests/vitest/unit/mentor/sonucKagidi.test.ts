import { describe, it, expect } from 'vitest'
import { sayiEk, gorevGrubu, aksayanlar, aksayanMetni, durumOf, ozetCumlesi } from '@/app/(dashboard)/mentorluk/[studentId]/takip/SonucKagidi'

describe('sayiEk', () => {
  it('sayının okunuşuna uyar', () => {
    expect([72, 70, 73, 80, 100, 9, 6, 40, 50, 0].map(n => sayiEk(n, 'sini')))
      .toEqual(["72'sini", "70'ini", "73'ünü", "80'ini", "100'ünü", "9'unu", "6'sını", "40'ını", "50'sini", "0'ını"])
    expect([27, 3, 9, 10, 6, 40, 1].map(n => sayiEk(n, 'si'))).toEqual(["27'si", "3'ü", "9'u", "10'u", "6'sı", "40'ı", "1'i"])
    expect([3, 2, 6, 9, 5, 4].map(n => sayiEk(n, 'sinde'))).toEqual(["3'ünde", "2'sinde", "6'sında", "9'unda", "5'inde", "4'ünde"])
  })
})

describe('gorevGrubu', () => {
  it('parantez, Tatil: öneki, — ve : sonrası atılır', () => {
    expect(gorevGrubu('Kitap okuma (en az 20 sayfa)')).toBe('Kitap okuma')
    expect(gorevGrubu('Tatil: Kitap okuma')).toBe('Kitap okuma')
    expect(gorevGrubu('TATİL: Kitap okuma (20 sayfa)')).toBe('Kitap okuma')
    expect(gorevGrubu('İngilizce — Workbook Sayfa 18')).toBe('İngilizce')
    expect(gorevGrubu('Matematik: konu testi')).toBe('Matematik')
    expect(gorevGrubu('  Fen   tekrarı  ')).toBe('Fen tekrarı')
  })
})

describe('aksayanlar', () => {
  const hafta = (ad: string, yapilan: number[]) => Array.from({ length: 7 }, (_, gun) => ({ ad, yapti: yapilan.includes(gun), gun }))
  it('farklı yazılışlar tek grupta, oran en düşük ilk 3', () => {
    const isler = [
      ...hafta('Kitap okuma (en az 20 sayfa)', [0, 1, 2]).map((x, i) => (i === 4 ? { ...x, ad: 'KİTAP  OKUMA' } : x)),
      ...hafta('Matematik: test', [0, 1, 2, 3, 4, 5]),
      ...hafta('İngilizce — Workbook', []),
      ...hafta('Fen', [0]),
      ...hafta('Türkçe', [0, 1, 2, 3, 4, 5, 6]),
    ]
    const a = aksayanlar(isler)
    expect(a.map(x => x.ad)).toEqual(['İngilizce', 'Fen', 'Kitap okuma'])
    expect(a[2]).toMatchObject({ toplam: 7, yapilan: 3, gunler: 7 })
    expect(aksayanMetni(a[2])).toBe("7 günün 3'ünde yapıldı")
    expect(aksayanMetni(a[0])).toBe('7 günün hiçbirinde yapılmadı')
  })
  it('gün olmayan iş görev sayısıyla yazılır; hepsi yapıldıysa boş', () => {
    const a = aksayanlar([{ ad: 'Mentör ödevleri', yapti: true }, { ad: 'Mentör ödevleri', yapti: false }, { ad: 'Mentör ödevleri', yapti: false }])
    expect(aksayanMetni(a[0])).toBe("3 görevin 1'i yapıldı")
    expect(aksayanlar([{ ad: 'X', yapti: true, gun: 0 }])).toEqual([])
  })
})

describe('durum ve özet', () => {
  it('eşikler: 80 iyi, 50–79 orta, altı düşük', () => {
    expect([100, 80, 79, 50, 49, 0].map(durumOf)).toEqual(['iyi', 'iyi', 'orta', 'orta', 'dusuk', 'dusuk'])
  })
  it('tek cümle; doğruluk varsa eklenir', () => {
    expect(ozetCumlesi('Beren', 72, 96, 120, null)).toBe("Beren bu hafta programın %72'sini tamamladı ve 96 soru çözdü (hedef 120).")
    expect(ozetCumlesi('Beren', 70, 96, 120, 78)).toBe("Beren bu hafta programın %70'ini tamamladı ve 96 soru çözdü (hedef 120), doğruluk %78.")
    expect(ozetCumlesi('Ali', null, 10, 0, null)).toBe('Ali bu hafta 10 soru çözdü.')
  })
})
