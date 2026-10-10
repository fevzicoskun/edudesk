import { describe, it, expect } from 'vitest'
import { aktifHref, gorunurNav, gruplaNav, mobilNavSec, type NavKayit } from '@/components/layout/navMath'

const item = (href: string, over: Partial<NavKayit> = {}): NavKayit => ({
  href,
  label: href.slice(1),
  mobile: false,
  roles: null,
  grup: 'diger',
  ...over,
})

describe('gorunurNav()', () => {
  it('roles null olan herkese görünür', () => {
    const liste = gorunurNav([item('/takvim')], 'ogretmen')
    expect(liste.map(i => i.href)).toEqual(['/takvim'])
  })

  it('rol listesinde olmayan kullanıcıya gösterilmez', () => {
    const liste = gorunurNav([item('/kullanicilar', { roles: ['mudur'] })], 'ogretmen')
    expect(liste).toEqual([])
  })

  it('rol tanımsızsa yalnız herkese açık girişler kalır', () => {
    const liste = gorunurNav(
      [item('/takvim'), item('/kullanicilar', { roles: ['mudur'] })],
      undefined,
    )
    expect(liste.map(i => i.href)).toEqual(['/takvim'])
  })
})

describe('gruplaNav()', () => {
  it('günlük ve diğer olarak ayırır, sıra korunur', () => {
    const { gunluk, diger } = gruplaNav([
      item('/anasayfa', { grup: 'gunluk' }),
      item('/takvim'),
      item('/odevler', { grup: 'gunluk' }),
    ])
    expect(gunluk.map(i => i.href)).toEqual(['/anasayfa', '/odevler'])
    expect(diger.map(i => i.href)).toEqual(['/takvim'])
  })
})

describe('mobilNavSec()', () => {
  // Bu testin koruduğu gerçek hata: Sınıflar (en çok kullanılan ekran) alt bardan
  // düşüp "Daha Fazla" altında kalıyordu, yerinde Takvim duruyordu.
  it('mobil işaretli girişler alt bara, kalanlar çekmeceye gider', () => {
    const { altBar, drawer } = mobilNavSec([
      item('/anasayfa', { mobile: true }),
      item('/profil'),
    ], 'ogretmen')
    expect(altBar.map(i => i.href)).toEqual(['/anasayfa'])
    expect(drawer.map(i => i.href)).toEqual(['/profil'])
  })

  it('çekmece varken alt barda en fazla 4 giriş kalır — 5. yuva "Daha Fazla" içindir', () => {
    const { altBar } = mobilNavSec([
      item('/a', { mobile: true }), item('/b', { mobile: true }),
      item('/c', { mobile: true }), item('/d', { mobile: true }),
      item('/e', { mobile: true }),
      item('/gizli'),
    ], 'ogretmen')
    expect(altBar).toHaveLength(4)
  })

  it('çekmece yoksa alt bar 5 girişe kadar çıkar', () => {
    const { altBar, drawer } = mobilNavSec([
      item('/a', { mobile: true }), item('/b', { mobile: true }),
      item('/c', { mobile: true }), item('/d', { mobile: true }),
      item('/e', { mobile: true }),
    ], 'ogretmen')
    expect(drawer).toEqual([])
    expect(altBar).toHaveLength(5)
  })

  it('alt bara sığmayan mobil giriş çekmeceye düşer — sessizce kaybolmaz', () => {
    const { altBar, drawer } = mobilNavSec([
      item('/a', { mobile: true }), item('/b', { mobile: true }),
      item('/c', { mobile: true }), item('/d', { mobile: true }),
      item('/tasan', { mobile: true }),
      item('/gizli'),
    ], 'ogretmen')
    expect(altBar.map(i => i.href)).not.toContain('/tasan')
    expect(drawer.map(i => i.href)).toContain('/tasan')
  })

  it('rol filtresi alt bara da uygulanır', () => {
    const { altBar } = mobilNavSec([
      item('/odevler', { mobile: true, roles: ['ogretmen'] }),
    ], 'mudur')
    expect(altBar).toEqual([])
  })
})

describe('aktifHref — iç içe menü bağlantılarında en uzun eşleşen kazanır', () => {
  const hrefs = ['/anasayfa', '/yonetim', '/yonetim/odevler', '/odevler']

  it('alt sayfada yalnız alt bağlantı aktif (üst bağlantı değil)', () => {
    expect(aktifHref('/yonetim/odevler', hrefs)).toBe('/yonetim/odevler')
  })
  it('üst sayfanın menüde olmayan alt sayfası üst bağlantıyı yakar', () => {
    expect(aktifHref('/yonetim/ogrenciler', hrefs)).toBe('/yonetim')
    expect(aktifHref('/odevler/123', hrefs)).toBe('/odevler')
  })
  it('yalnız tam segment eşleşir; hiç eşleşme yoksa null', () => {
    expect(aktifHref('/odevlerx', hrefs)).toBeNull()
    expect(aktifHref('/profil', hrefs)).toBeNull()
  })
})

describe('gorunurNav — yalnizMentor (Mentörlük yalnız mentörlüğü olana, 2026-10-07)', () => {
  const items = [
    item('/anasayfa'),
    item('/mentorluk', { roles: ['ogretmen', 'zumre_baskani'], yalnizMentor: true }),
  ]
  it('mentörlüğü olmayan öğretmende gizli', () => {
    expect(gorunurNav(items, 'ogretmen').map(i => i.href)).toEqual(['/anasayfa'])
  })
  it('mentörlüğü olan öğretmende görünür', () => {
    expect(gorunurNav(items, 'ogretmen', { mentorMu: true }).map(i => i.href)).toEqual(['/anasayfa', '/mentorluk'])
  })
  it('rol uymuyorsa mentorMu yetmez', () => {
    expect(gorunurNav(items, 'mudur', { mentorMu: true }).map(i => i.href)).toEqual(['/anasayfa'])
  })
  it('mobil seçim de aynı koşulu uygular', () => {
    const mob = items.map(i => ({ ...i, mobile: true }))
    expect(mobilNavSec(mob, 'ogretmen').altBar.map(i => i.href)).toEqual(['/anasayfa'])
    expect(mobilNavSec(mob, 'ogretmen', { mentorMu: true }).altBar.map(i => i.href)).toEqual(['/anasayfa', '/mentorluk'])
  })
})

describe('gorunurNav — yalnizYoklama (yoklama anahtarı, 2026-10-10)', () => {
  const items = [
    item('/anasayfa'),
    item('/yoklama', { roles: ['ogretmen', 'zumre_baskani'], yalnizYoklama: true }),
    item('/rapor/devamsizlik', { roles: ['mudur', 'mudur_yardimcisi'], yalnizYoklama: true }),
  ]
  it('varsayılan (okul ayarı bilinmiyorsa) açık sayılır', () => {
    expect(gorunurNav(items, 'ogretmen').map(i => i.href)).toEqual(['/anasayfa', '/yoklama'])
  })
  it('yoklama kapalıyken öğretmende Yoklama, idarede Devamsızlık Raporu gizli', () => {
    expect(gorunurNav(items, 'ogretmen', { yoklamaAktif: false }).map(i => i.href)).toEqual(['/anasayfa'])
    expect(gorunurNav(items, 'mudur', { yoklamaAktif: false }).map(i => i.href)).toEqual(['/anasayfa'])
  })
  it('açıkken rolüne göre görünür', () => {
    expect(gorunurNav(items, 'mudur', { yoklamaAktif: true }).map(i => i.href)).toEqual(['/anasayfa', '/rapor/devamsizlik'])
  })
  it('mobil seçim de aynı koşulu uygular', () => {
    const mob = items.map(i => ({ ...i, mobile: true }))
    expect(mobilNavSec(mob, 'ogretmen', { yoklamaAktif: false }).altBar.map(i => i.href)).toEqual(['/anasayfa'])
  })
})
