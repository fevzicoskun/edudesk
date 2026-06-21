'use client'

import { createDoc } from '@/src/lib/createPdf'
import { format } from '@/src/shared/date'
import type { KarneData } from '@/src/domains/dashboard/lib/karne'

const METRIC_LABEL = {
  devamsizlik: 'Devamsızlık',
  kapsama:     'Yoklama kapsama',
  aktivite:    'Öğretmen aktivitesi',
} as const

export async function buildKarnePdf(data: KarneData): Promise<void> {
  // autotable dinamik import — MatrisClient deseni (bundle'a girmez)
  const { default: autoTable } = await import('jspdf-autotable')
  // jsPDF constructor overload tipi TS'de string olarak çözümlendiğinden unknown cast gerekli
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = await createDoc({ unit: 'pt', format: 'a4' } as any)
  const pct = (n: number) => (n > 0 ? `%${n}` : '—')

  // Başlık
  doc.setFontSize(16)
  doc.text(data.schoolName, 40, 50)
  doc.setFontSize(12)
  doc.text('Okul Karnesi', 40, 70)
  doc.setFontSize(9)
  const donem = `${format(new Date(data.donemStart), 'd MMM yyyy')} – ${format(new Date(data.generatedAt), 'd MMM yyyy')}`
  doc.text(`Dönem: ${donem}`, 40, 86)

  // 1) Metrik tablosu
  autoTable(doc, {
    startY: 100,
    head: [['Metrik', 'Son hafta', 'Dönem ort.']],
    body: (['devamsizlik', 'kapsama', 'aktivite'] as const).map(k => [
      METRIC_LABEL[k], pct(data.metrics[k].sonHafta), pct(data.metrics[k].donemOrt),
    ]),
    styles: { font: 'Roboto', fontSize: 10 },
    headStyles: { font: 'Roboto', fillColor: [37, 99, 235] },
  })

  // 2) Sınıf karşılaştırması
  let y = (doc.lastAutoTable?.finalY ?? 100) + 24
  doc.setFontSize(12)
  doc.text('Sınıf Karşılaştırması — Devamsızlık', 40, y)
  autoTable(doc, {
    startY: y + 8,
    head: [['Sınıf', 'Devamsızlık']],
    body: data.classAbsence.length
      ? data.classAbsence.map(c => [c.name, `%${c.rate}`])
      : [['Yoklama verisi yok', '']],
    styles: { font: 'Roboto', fontSize: 10 },
    headStyles: { font: 'Roboto', fillColor: [37, 99, 235] },
  })

  // 3) Erken uyarılar
  y = (doc.lastAutoTable?.finalY ?? y) + 24
  doc.setFontSize(12)
  doc.text('Erken Uyarılar', 40, y)
  autoTable(doc, {
    startY: y + 8,
    head: [['Şiddet', 'Uyarı', 'Detay']],
    body: data.warnings.length
      ? data.warnings.map(w => [w.severity === 'yuksek' ? 'Yüksek' : 'Dikkat', w.title, w.detail])
      : [['', 'Aktif uyarı yok', '']],
    styles: { font: 'Roboto', fontSize: 9 },
    headStyles: { font: 'Roboto', fillColor: [37, 99, 235] },
  })

  doc.save(`okul-karnesi-${format(new Date(data.generatedAt), 'yyyy-MM-dd')}.pdf`)
}
