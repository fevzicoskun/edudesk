import { describe, it, expect } from 'vitest'
import { kategorizeOdev, hicIsaretlenmedi, ayniKaynak, onerilenBaslik, type KategoriGirdi } from '@/src/domains/homework/homeworkMath'

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
