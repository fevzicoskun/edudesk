'use client'

import { createDoc, filigranEkle } from '@/src/lib/createPdf'
import { format, parseISO } from '@/src/shared/date'
import type { AylikRaporPdf } from '@/app/actions/karne'

const SOL = 40
const MAVI: [number, number, number] = [37, 99, 235]
const GRI: [number, number, number] = [90, 90, 90]

export const ayAdi = (ay: string) => format(parseISO(`${ay}-01`), 'MMMM yyyy')

const deger = (v: number | null, yuzde?: boolean) => (v === null ? '—' : yuzde ? `%${v}` : String(v))
function degisim(bu: number | null, gecen: number | null, yuzde?: boolean): string {
  if (bu === null || gecen === null) return '—'
  const f = bu - gecen
  return f === 0 ? '=' : `${f > 0 ? '+' : ''}${f}${yuzde ? ' puan' : ''}`
}

export async function buildAylikRaporPdf(r: AylikRaporPdf): Promise<void> {
  const { default: autoTable } = await import('jspdf-autotable')
  const doc = await createDoc({ unit: 'pt', format: 'a4' })
  const genislik = doc.internal.pageSize.getWidth() - SOL * 2
  const tablo = (startY: number, head: string[], body: string[][]) => {
    autoTable(doc, {
      startY, head: [head], body,
      styles: { font: 'Roboto', fontSize: 9, cellPadding: 4 },
      headStyles: { font: 'Roboto', fillColor: MAVI },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: SOL, right: SOL },
    })
    return (doc.lastAutoTable?.finalY ?? startY) + 22
  }
  const baslik = (metin: string, y: number) => { doc.setFontSize(12); doc.text(metin, SOL, y); return y + 8 }
  const maddeler = (liste: string[], y: number) => {
    doc.setFontSize(9)
    for (const m of liste.length ? liste : ['Belirgin bir değişim yok']) {
      const satirlar = doc.splitTextToSize(`•  ${m}`, genislik) as string[]
      doc.text(satirlar, SOL, y + 10)
      y += satirlar.length * 12
    }
    return y + 24
  }

  doc.setFontSize(16)
  doc.text(r.schoolName, SOL, 50)
  doc.setFontSize(12)
  doc.text(`${ayAdi(r.ay)} Aylık Raporu`, SOL, 70)
  doc.setFontSize(9)
  doc.setTextColor(...GRI)
  doc.text(`Karşılaştırma: ${ayAdi(r.gecenAy)} · Oluşturulma: ${format(new Date(), 'd MMMM yyyy')} · Rakamlar "Ödev Takibi" ile aynı hesaptır.`, SOL, 86)
  doc.setTextColor(0, 0, 0)

  const bu = format(parseISO(`${r.ay}-01`), 'MMMM'), gecen = format(parseISO(`${r.gecenAy}-01`), 'MMMM')
  let y = tablo(100, ['Gösterge', bu, gecen, 'Değişim'],
    r.ozet.map(s => [s.ad, deger(s.bu, s.yuzde), deger(s.gecen, s.yuzde), degisim(s.bu, s.gecen, s.yuzde)]))

  y = maddeler(r.iyi, baslik('Bu ay iyi giden', y))
  y = maddeler(r.dikkat, baslik('Dikkat edilecek', y))

  y = baslik('Sınıflara göre ödev tamamlanma', y)
  tablo(y + 4, ['Sınıf', bu, gecen, 'Değişim'],
    r.siniflar.length
      ? r.siniflar.map(c => [c.ad, deger(c.bu, true), deger(c.gecen, true), degisim(c.bu, c.gecen, true)])
      : [['Bu iki ayda ödev yok', '', '', '']])

  doc.setFontSize(8)
  doc.setTextColor(...GRI)
  doc.text('Tamamlanma: kontrol edilen teslimlerden "yapıldı" olanların payı (mazeretliler hariç). Ödevler teslim gününe göre aya ayrılır.',
    SOL, doc.internal.pageSize.getHeight() - 24)

  await filigranEkle(doc, r.schoolName)
  doc.save(`aylik-rapor-${r.ay}.pdf`)
}
