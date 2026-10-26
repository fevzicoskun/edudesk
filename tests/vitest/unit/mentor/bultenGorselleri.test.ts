import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { OdevlerGorseli, OzetGorseli, OgrenciGorseli } from '@/src/domains/mentor/lib/bultenGorselleri'

// Yükseklik içerikten ölçülür (bulten-gorsel-cizim.test.ts): ödev başlığı kesilmeden tam yazılır ve kayar
// (veliye giden sayfa bilgisi başlığın sonunda). Öğrenci adı başlık bloğunda tek satır kalır.
const UZUN = 'Başarıyorum Fasikül 3 sayfa 38-57 arası tekrar'
const UZUN_AD = 'Ayşe Nur Gülşah Karamanoğlu Değirmencioğlu'
const sinif = { class_id: 'c', class_name: '9-A', ozet: [{ id: 'o', subject: 'Din Kültürü ve Ahlak Bilgisi', title: UZUN, due_date: '2026-10-07', toplam: 3, yapildi: 1, eksik: 1, yapilmadi: 1 }],
  gunler: [{ gun: '2026-10-12', etiket: 'Pazartesi', odevler: [{ id: 'h', subject: 'Matematik', title: UZUN, teacher_id: 't', ogretmen: 'Öğretmen' }] }] }
const ogrenci = { student_id: 's', full_name: UZUN_AD, class_id: 'c', class_name: '9-A', telefon: null, mesaj: '',
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
    const html = renderToStaticMarkup(h(OgrenciGorseli, { ogrenci, sinif, bulten }))
    expect(html).toContain(UZUN); expect(tekSatir(html, UZUN)).toBe(false)
    expect(tekSatir(html, UZUN_AD)).toBe(true)
  })
})
