'use client'

import { createDoc, type PdfDoc } from '@/src/lib/createPdf'
import { format } from '@/src/shared/date'
import { odevKarnesiBolumleri } from '@/src/domains/homework/lib/odevKarnesi'
import { RISK_ORANI, RISK_EN_AZ_ODEV, GECIKME_GUNU } from '@/src/domains/homework/lib/odev-takibi'
import type { OkulKarnesi } from '@/app/actions/karne'

const SOL = 40
const MAVI: [number, number, number] = [37, 99, 235]
const GRI: [number, number, number] = [90, 90, 90]

const METRIC_LABEL = {
  devamsizlik: 'Devamsızlık',
  kapsama:     'Yoklama kapsama',
  aktivite:    'Öğretmen aktivitesi',
} as const

/** Sayfa sonuna yakınsa yeni sayfa açar; yazılacak y'yi döner */
function yer(doc: PdfDoc, y: number, gereken = 60): number {
  const alt = doc.internal.pageSize.getHeight() - 40
  if (y + gereken > alt) { doc.addPage(); return 50 }
  return y
}

/** Paragrafı sayfa genişliğine kırar, son y'yi döner */
function paragraf(doc: PdfDoc, metin: string, y: number, boyut = 9): number {
  doc.setFontSize(boyut)
  doc.setTextColor(...GRI)
  const satirlar = doc.splitTextToSize(metin, doc.internal.pageSize.getWidth() - SOL * 2) as string[]
  doc.text(satirlar, SOL, y)
  doc.setTextColor(0, 0, 0)
  return y + satirlar.length * (boyut + 3)
}

export async function buildKarnePdf(data: OkulKarnesi): Promise<void> {
  // autotable dinamik import — MatrisClient deseni (bundle'a girmez)
  const { default: autoTable } = await import('jspdf-autotable')
  const doc = await createDoc({ unit: 'pt', format: 'a4' })
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
  const bolumBasligi = (baslik: string, y: number) => {
    y = yer(doc, y)
    doc.setFontSize(12)
    doc.text(baslik, SOL, y)
    return y + 8
  }

  // Başlık
  doc.setFontSize(16)
  doc.text(data.schoolName, SOL, 50)
  doc.setFontSize(12)
  doc.text('Okul Karnesi — Ödev Takibi', SOL, 70)
  doc.setFontSize(9)
  doc.setTextColor(...GRI)
  doc.text(`Dönem: ${format(new Date(data.donemStart), 'd MMM yyyy')} – ${format(new Date(data.generatedAt), 'd MMM yyyy')}`, SOL, 86)
  doc.setTextColor(0, 0, 0)

  // Okuma rehberi
  let y = paragraf(doc,
    'Bu rapor nasıl okunur: Tamamlanma, öğretmenin kontrol ettiği teslimlerden "yapıldı" olanların payıdır '
    + '(mazeretliler hesaba katılmaz; kontrol edilmemiş öğrenci "yapmadı" sayılmaz). '
    + 'Kontrol bekleyen, teslim günü geçtiği hâlde hiç işaretlenmemiş ödevdir; '
    + `${GECIKME_GUNU} günden uzun bekleyenler gecikmiş sayılır. `
    + `Riskli öğrenci: kontrol edilen ödevlerinin en az %${RISK_ORANI}'u yapılmadı veya eksik olan öğrenci `
    + `(en az ${RISK_EN_AZ_ODEV} kontrol edilmiş ödevi olan). Rakamlar EduDesk "Ödev Takibi" ekranıyla aynıdır.`,
    106)

  for (const b of odevKarnesiBolumleri(data.odev)) {
    y = bolumBasligi(b.baslik, y + 8)
    if (b.not) y = paragraf(doc, b.not, y + 6, 8) - 4
    y = tablo(y + 4, b.head, b.body)
  }

  // Yoklama bölümleri yalnız okul yoklamayı EduDesk'te alıyorsa
  const k = data.yoklama
  if (k) {
    y = bolumBasligi('Yoklama ve öğretmen aktivitesi', y)
    y = tablo(y + 4, ['Metrik', 'Son hafta', 'Dönem ort.'],
      (['devamsizlik', 'kapsama', 'aktivite'] as const).map(m => {
        const pct = (n: number) => (n > 0 ? `%${n}` : '—')
        return [METRIC_LABEL[m], pct(k.metrics[m].sonHafta), pct(k.metrics[m].donemOrt)]
      }))
    y = bolumBasligi('Sınıf karşılaştırması — devamsızlık', y)
    y = tablo(y + 4, ['Sınıf', 'Devamsızlık'],
      k.classAbsence.length ? k.classAbsence.map(c => [c.name, `%${c.rate}`]) : [['Yoklama verisi yok', '']])
    y = bolumBasligi('Erken uyarılar', y)
    tablo(y + 4, ['Şiddet', 'Uyarı', 'Detay'],
      k.warnings.length
        ? k.warnings.map(w => [w.severity === 'yuksek' ? 'Yüksek' : 'Dikkat', w.title, w.detail])
        : [['', 'Aktif uyarı yok', '']])
  }

  // Sayfa numarası
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(...GRI)
    doc.text(`${i} / ${n}`, doc.internal.pageSize.getWidth() - SOL, doc.internal.pageSize.getHeight() - 20, { align: 'right' })
  }

  doc.save(`okul-karnesi-${format(new Date(data.generatedAt), 'yyyy-MM-dd')}.pdf`)
}
