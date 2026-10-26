import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { OdevlerGorseli, OzetGorseli, OgrenciGorseli } from '@/src/domains/mentor/lib/bultenGorselleri'
import type { BultenOgrencisi } from '@/src/domains/mentor/services/BultenService'

// Yükseklik içerikten ölçülür (bulten-gorsel-cizim.test.ts): ödev başlığı kesilmeden tam yazılır ve kayar
// (veliye giden sayfa bilgisi başlığın sonunda). Öğrenci adı başlık bloğunda tek satır kalır.
const UZUN = 'Başarıyorum Fasikül 3 sayfa 38-57 arası tekrar'
const UZUN_AD = 'Ayşe Nur Gülşah Karamanoğlu Değirmencioğlu'
const sinif = { class_id: 'c', class_name: '9-A', ozet: [{ id: 'o', subject: 'Din Kültürü ve Ahlak Bilgisi', title: UZUN, due_date: '2026-10-07', toplam: 3, yapildi: 1, eksik: 1, yapilmadi: 1 }],
  gunler: [{ gun: '2026-10-12', etiket: 'Pazartesi', odevler: [{ id: 'h', subject: 'Matematik', title: UZUN, teacher_id: 't', ogretmen: 'Öğretmen' }] }] }
const ogrenci = { student_id: 's', full_name: UZUN_AD, class_id: 'c', class_name: '9-A', telefon: null, mesaj: '', gecenHafta: { toplam: 3, yapildi: 2, eksik: 0, yapilmadi: 1 },
  eksikler: [{ id: 'h', subject: 'Din Kültürü ve Ahlak Bilgisi', title: UZUN, due_date: '2026-10-07', durum: 'yapılmadı' as const }] }
const bulten = { hafta: '2026-10-12', okulAdi: 'Okul', mentorAdi: 'M', mentorUnvani: 'Matematik Öğretmeni M', siniflar: [sinif], ogrenciler: [ogrenci] }

/** metni içeren en içteki elemanın style'ı tek satır kuralını taşıyor mu */
function tekSatir(html: string, metin: string) {
  const i = html.indexOf(metin.slice(0, 20))
  const acilis = html.lastIndexOf('<', i)
  const etiket = html.slice(acilis, html.indexOf('>', acilis))
  return etiket.includes('white-space:nowrap') && etiket.includes('text-overflow:ellipsis') && etiket.includes('overflow:hidden')
}

describe('görsellerde ödev başlığı tam ve kayan, öğrenci adı tek satır', () => {
  it('ödevler görseli: ödev başlığı', () => {
    const html = renderToStaticMarkup(h(OdevlerGorseli, { sinif, bulten }))
    expect(html).toContain(UZUN); expect(tekSatir(html, UZUN)).toBe(false)
  })
  it('özet görseli: ödev başlığı', () => {
    const html = renderToStaticMarkup(h(OzetGorseli, { sinif, bulten }))
    expect(html).toContain(UZUN); expect(tekSatir(html, UZUN)).toBe(false)
  })
  it('öğrenci kartı: eksik başlığı kayar, öğrenci adı tek satır', () => {
    const html = renderToStaticMarkup(h(OgrenciGorseli, { ogrenci, sinif, bulten, girinti: () => '' }))
    expect(html).toContain(UZUN); expect(tekSatir(html, UZUN)).toBe(false)
    expect(tekSatir(html, UZUN_AD)).toBe(true)
  })
})

describe('öğrenci kartı (2026-10-26 yeni görünüm)', () => {
  const kart = (o: Partial<BultenOgrencisi>) =>
    renderToStaticMarkup(h(OgrenciGorseli, { ogrenci: { ...ogrenci, ...o }, sinif, bulten, girinti: () => '' }))
  const eksik = { id: 'k', subject: 'Kimya', title: 'Syf 48', due_date: '2026-10-08', durum: 'eksik' as const }

  it('özet kutusu gerçek sayılarla; "yapılmadı" etiketi yok, not kutusu ve mentör satırı var', () => {
    const html = kart({ gecenHafta: { toplam: 10, yapildi: 4, eksik: 1, yapilmadi: 5 }, eksikler: [...ogrenci.eksikler, eksik] })
    expect(html).toContain('4/10')
    expect(html).toContain('Geçen hafta 10 ödevden')
    expect(html).toContain("4&#x27;ü tamamlandı"); expect(html).toContain("6&#x27;sı tamamlanmadı")
    expect(html).not.toMatch(/>yapılmadı</)
    expect(html.match(/>eksik</g)).toHaveLength(1)
    expect(html).toContain('Geçen hafta tamamlanmayanlar')
    expect(html).toContain('Eksik ödevlerin tamamlanması için desteğinizi rica ederiz.')
    expect(html).toContain('· 9-A Mentör Öğretmeni')
    // noktalar: 4 yeşil, 1 sarı, 5 kırmızı (bu sırayla)
    const renkler = [...html.matchAll(/width:20px;height:20px;border-radius:10px;background:(#[0-9A-F]+);margin:0 8px 8px 0/g)].map(m => m[1])
    expect(renkler).toEqual([...Array(4).fill('#2E9E6B'), '#F2B233', ...Array(5).fill('#D9534F')])
  })
  it('hiç eksik yok → yeşil "tümü tamamlandı"; tamamlanmayanlar bölümü ve not kutusu yok', () => {
    const html = kart({ gecenHafta: { toplam: 8, yapildi: 8, eksik: 0, yapilmadi: 0 }, eksikler: [] })
    expect(html).toContain('8/8'); expect(html).toContain('Geçen haftanın tüm ödevleri tamamlandı.')
    expect(html).not.toContain('Geçen hafta tamamlanmayanlar'); expect(html).not.toContain('desteğinizi rica')
  })
  it('kontrol edilen ödev yok → 0/0 yazılmaz', () => {
    const html = kart({ gecenHafta: { toplam: 0, yapildi: 0, eksik: 0, yapilmadi: 0 }, eksikler: [] })
    expect(html).toContain('Geçen hafta kontrol edilen ödev yok.'); expect(html).not.toContain('0/0')
  })
  it('ödev metni en çok 2 satır, ders adı kadar girintili tek metin', () => {
    const html = renderToStaticMarkup(h(OgrenciGorseli, { ogrenci, sinif, bulten, girinti: d => `[${d}]` }))
    expect(html).toContain(`[Din Kültürü]${UZUN}`)
    expect(html).toMatch(/line-clamp:2[^>]*>\[Din Kültürü\]/)
  })
})
