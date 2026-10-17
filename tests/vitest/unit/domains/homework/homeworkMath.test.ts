import { describe, it, expect } from 'vitest'
import { kategorizeOdev, hicIsaretlenmedi, ayniKaynak, kaynakSec, kaynakAdiDuzelt, onerilenBaslik, basHarfleriBuyut, gunEkle, dersEslestir, type KategoriGirdi } from '@/src/domains/homework/homeworkMath'

const BUGUN = new Date('2026-09-19T12:00:00+03:00')

function girdi(over: Partial<KategoriGirdi> = {}): KategoriGirdi {
  return { dueDate: '2026-09-17', isaretliSayisi: 0, ogrenciSayisi: 15, ...over }
}

describe('kategorizeOdev', () => {
  it('teslim tarihi yoksa aktif sayar', () => {
    expect(kategorizeOdev(girdi({ dueDate: null }), BUGUN)).toBe('aktif')
  })

  it('teslim tarihi gelecekteyse aktif sayar', () => {
    expect(kategorizeOdev(girdi({ dueDate: '2026-09-25' }), BUGUN)).toBe('aktif')
  })

  it('teslim günü henüz bitmemişse aktif sayar (gün sonuna kadar)', () => {
    expect(kategorizeOdev(girdi({ dueDate: '2026-09-19' }), BUGUN)).toBe('aktif')
  })

  // Kök bulgu (2026-09-19): submission satırları ödevle birlikte otomatik yaratılıyor.
  // "satır var" ≠ "öğretmen işaretledi" — ayrım yalnız marked_at ile yapılır.
  it('satırlar dolu ama hiçbiri işaretlenmemişse kontrol bekler', () => {
    expect(kategorizeOdev(girdi({ isaretliSayisi: 0, ogrenciSayisi: 22 }), BUGUN)).toBe('kontrolBekliyor')
  })

  it('yarıdan azı işaretliyse kontrol bekler', () => {
    // canlı örnek: 12-B "Başarıyorum", 5/15 işaretli, teslim 17 Eylül
    expect(kategorizeOdev(girdi({ isaretliSayisi: 5, ogrenciSayisi: 15 }), BUGUN)).toBe('kontrolBekliyor')
  })

  it('tam yarısı işaretliyse geçmiş sayar', () => {
    expect(kategorizeOdev(girdi({ isaretliSayisi: 8, ogrenciSayisi: 15 }), BUGUN)).toBe('gecmis')
  })

  it('hepsi işaretliyse geçmiş sayar', () => {
    expect(kategorizeOdev(girdi({ isaretliSayisi: 15, ogrenciSayisi: 15 }), BUGUN)).toBe('gecmis')
  })

  it('kontrol penceresi (30 gün) dolmuşsa artık geçmiş sayar', () => {
    expect(kategorizeOdev(girdi({ dueDate: '2026-08-01', isaretliSayisi: 0 }), BUGUN)).toBe('gecmis')
  })

  it('sınıf mevcudu bilinmiyorsa tek işaret bile yeter', () => {
    expect(kategorizeOdev(girdi({ ogrenciSayisi: 0, isaretliSayisi: 1 }), BUGUN)).toBe('gecmis')
    expect(kategorizeOdev(girdi({ ogrenciSayisi: 0, isaretliSayisi: 0 }), BUGUN)).toBe('kontrolBekliyor')
  })
})

describe('hicIsaretlenmedi', () => {
  it('satırlar dolu ama marked_at boşsa true (otomatik yaratılmış satırlar)', () => {
    expect(hicIsaretlenmedi([{ marked_at: null }, { marked_at: null }])).toBe(true)
  })

  it('tek bir işaret bile varsa false', () => {
    expect(hicIsaretlenmedi([{ marked_at: null }, { marked_at: '2026-09-18T10:00:00Z' }])).toBe(false)
  })

  it('hiç satır yoksa true', () => {
    expect(hicIsaretlenmedi([])).toBe(true)
  })
})

describe('ayniKaynak', () => {
  it('büyük/küçük harf farkını yok sayar', () => {
    expect(ayniKaynak('Başarıyorum', 'başarıyorum')).toBe(true)
  })

  it('Türkçe I/İ çiftini doğru eşler', () => {
    expect(ayniKaynak('İLKE YAYINLARI', 'ilke yayınları')).toBe(true)
    expect(ayniKaynak('TYT KAMPI', 'tyt kampı')).toBe(true)
  })

  it('baştaki/sondaki boşluğu yok sayar', () => {
    expect(ayniKaynak('  Toprak TYT ', 'Toprak TYT')).toBe(true)
  })

  it('farklı kaynakları ayırır', () => {
    expect(ayniKaynak('Toprak TYT', 'Toprak AYT')).toBe(false)
  })
})

describe('onerilenBaslik', () => {
  it('kaynak ve sayfadan başlık kurar', () => {
    expect(onerilenBaslik('Başarıyorum', '39-47')).toBe('Başarıyorum · s.39-47')
  })

  it('yalnız kaynak varsa kaynağı döndürür', () => {
    expect(onerilenBaslik('Başarıyorum', '')).toBe('Başarıyorum')
  })

  it('yalnız sayfa varsa sayfayı döndürür', () => {
    expect(onerilenBaslik('', '52-55')).toBe('s.52-55')
  })

  it('ikisi de boşsa boş döndürür', () => {
    expect(onerilenBaslik('  ', '')).toBe('')
  })
})

describe('ayniKaynak — kelime arası boşluk (2026-09-28)', () => {
  it('kelime arasındaki fazla boşluk ayrı kaynak yapmaz', () => {
    expect(ayniKaynak('Mikro  Orjinal', 'mikro orjinal')).toBe(true)
    expect(ayniKaynak(' MİKRO	ORJİNAL ', 'mikro orjinal')).toBe(true)
  })
  it('yazım farkı ayrı kaynaktır (tahmin edilmez)', () => {
    expect(ayniKaynak('Mikro Orjinal', 'Mikro Orijinal')).toBe(false)
  })
})

describe('kaynakAdiDuzelt — kaydedilen ad', () => {
  it('baş/son boşluk atılır, kelime arası tek boşluğa iner; harfler korunur', () => {
    expect(kaynakAdiDuzelt('  Mikro   Orjinal ')).toBe('Mikro Orjinal')
  })
})

describe('kaynakSec — aynı adlı birden çok kitap (ör. Mikro Orjinal Matematik / Geometri)', () => {
  // liste veritabanından ad + oluşturma sırasıyla gelir: ilk = en eski
  const mat  = { id: 'mat', name: 'Mikro Orjinal', subject: 'Matematik' }
  const geo  = { id: 'geo', name: 'Mikro Orjinal', subject: 'Geometri' }
  const gen  = { id: 'gen', name: 'Mikro Orjinal', subject: null }
  const baska = { id: 'bas', name: 'Başarıyorum', subject: null }

  it('adı eşleşen yoksa null (yeni kaynak açılır)', () => {
    expect(kaynakSec([mat, baska], 'Palme', 'Matematik')).toBeNull()
  })
  it('tek eşleşme varsa ders ne olursa olsun o (eski davranış korunur)', () => {
    expect(kaynakSec([mat, baska], 'mikro orjinal', 'Fizik')?.id).toBe('mat')
  })
  it('birden çok eşleşmede ödevin dersiyle eşleşen kitap seçilir (harf/boşluk farkı önemsiz)', () => {
    expect(kaynakSec([mat, geo], 'Mikro Orjinal', 'Geometri')?.id).toBe('geo')
    expect(kaynakSec([mat, geo], 'Mikro Orjinal', ' geometri ')?.id).toBe('geo')
    expect(kaynakSec([geo, mat], 'Mikro Orjinal', 'Matematik')?.id).toBe('mat')
  })
  it('ders eşleşmezse dersi boş (genel) kitap, o da yoksa en eski — rastgele değil', () => {
    expect(kaynakSec([mat, gen, geo], 'Mikro Orjinal', 'Fizik')?.id).toBe('gen')
    expect(kaynakSec([mat, geo], 'Mikro Orjinal', 'Fizik')?.id).toBe('mat')
    expect(kaynakSec([mat, geo], 'Mikro Orjinal', null)?.id).toBe('mat')
  })
})

describe('basHarfleriBuyut', () => {
  it('her kelimenin baş harfi büyük, kalanı küçük (Türkçe i/ı)', () => {
    expect(basHarfleriBuyut('başarıyorum SAYFA 39-47')).toBe('Başarıyorum Sayfa 39-47')
    expect(basHarfleriBuyut('ıSPARTA iLKE ÇALIŞMA')).toBe('Isparta İlke Çalışma')
  })
  it('kesme işaretinden sonrası küçük, rakam/noktalamadan sonra büyük', () => {
    expect(basHarfleriBuyut("TÜRKİYE'NİN coğrafyası")).toBe("Türkiye'nin Coğrafyası")
    expect(basHarfleriBuyut('5.ünite (ek) a-b')).toBe('5.Ünite (Ek) A-B')
  })
  it('Romen rakamı büyük kalır (Türkçe küçültme III → ııı bozardı)', () => {
    expect(basHarfleriBuyut('ünite III · sayfa 1000')).toBe('Ünite III · Sayfa 1000')
    expect(basHarfleriBuyut('IV. bölüm XII test')).toBe('IV. Bölüm XII Test')
    expect(basHarfleriBuyut('TYT ve İLK')).toBe('Tyt Ve İlk') // yalnız I/V/X'ten oluşan kelime istisna
  })
  it('satır sonları ve boşluklar korunur', () => {
    expect(basHarfleriBuyut('sayfa 1\n  test 2')).toBe('Sayfa 1\n  Test 2')
  })
})

describe('gunEkle', () => {
  it('ISO tarihe gün ekler, ay ve yıl sınırını geçer', () => {
    expect(gunEkle('2026-10-14', 1)).toBe('2026-10-15')
    expect(gunEkle('2026-10-28', 10)).toBe('2026-11-07')
    expect(gunEkle('2026-12-25', 14)).toBe('2027-01-08')
  })
  it('yaz saati / saat dilimi kayması yapmaz', () => {
    expect(gunEkle('2026-03-28', 1)).toBe('2026-03-29')
  })
})

describe('dersEslestir', () => {
  const liste = ['Matematik', 'İngilizce']
  it('harf/boşluk farkı okulun yazımına çevrilir', () => {
    expect(dersEslestir('MATEMATİK', liste)).toBe('Matematik')
    expect(dersEslestir('  ingilizce ', liste)).toBe('İngilizce')
  })
  it('eşleşme yoksa yazılan kalır', () => {
    expect(dersEslestir('Matematik 1.Aşama', liste)).toBe('Matematik 1.Aşama')
  })
})
