import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { OdevlerGorseli, OzetGorseli, OgrenciGorseli } from '@/src/domains/mentor/lib/bultenGorselleri'

// Satori metni kaydırırsa satır uzar ama yükseklik formülü bunu bilmez → PNG'nin altı kesilir.
// Bu yüzden değişken uzunluktaki metinler (ödev başlığı, öğrenci adı) tek satıra zorlanmalı.
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

describe('görsellerde değişken metin tek satır', () => {
  it('ödevler görseli: ödev başlığı', () => {
    expect(tekSatir(renderToStaticMarkup(h(OdevlerGorseli, { sinif, bulten })), UZUN)).toBe(true)
  })
  it('özet görseli: ödev başlığı', () => {
    expect(tekSatir(renderToStaticMarkup(h(OzetGorseli, { sinif, bulten })), UZUN)).toBe(true)
  })
  it('öğrenci kartı: eksik başlığı ve öğrenci adı', () => {
    const html = renderToStaticMarkup(h(OgrenciGorseli, { ogrenci, sinif, bulten }))
    expect(tekSatir(html, UZUN)).toBe(true)
    expect(tekSatir(html, UZUN_AD)).toBe(true)
  })
})
