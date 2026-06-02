'use client'

import { useState } from 'react'
export interface DosyamPdfData {
  teacherName:   string
  schoolName:    string
  subject:       string
  academicYear:  string
  dailyPlans:    { plan_date: string; topic: string; className: string }[]
  zumreMeetings: { title: string; meeting_date: string }[]
  sokReports:    { meeting_date: string; term: number; academic_year: string; className: string }[]
  notebookChecks:{ check_date: string; className: string }[]
}

export default function DosyamPdfButton({ data }: { data: DosyamPdfData }) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      const { createDoc } = await import('@/src/lib/createPdf')
      const autoTable = (await import('jspdf-autotable')).default
      const doc = await createDoc()

      const pageW = doc.internal.pageSize.getWidth()
      const margin = 14

      function addSectionHeader(title: string) {
        doc.addPage()
        doc.setFontSize(13)
        doc.setFont('Roboto', 'bold')
        doc.text(title, margin, 18)
        doc.setFont('Roboto', 'normal')
      }

      function getY(): number {
        return (doc as any).lastAutoTable?.finalY ?? 30
      }

      // ── Kapak sayfası ────────────────────────────────────────────────────────
      doc.setFontSize(18)
      doc.setFont('Roboto', 'bold')
      doc.text('ÖĞRETMEN DOSYASI', pageW / 2, 50, { align: 'center' })

      doc.setFontSize(11)
      doc.setFont('Roboto', 'normal')
      const coverLines = [
        `Öğretmen : ${data.teacherName}`,
        `Okul       : ${data.schoolName}`,
        `Branş      : ${data.subject}`,
        `Dönem      : ${data.academicYear}`,
        `Oluşturma  : ${new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}`,
      ]
      coverLines.forEach((line, i) => doc.text(line, margin, 80 + i * 10))

      // İçindekiler
      doc.setFontSize(10)
      doc.setFont('Roboto', 'bold')
      doc.text('İÇİNDEKİLER', margin, 140)
      doc.setFont('Roboto', 'normal')
      const sections = [
        ['1.', 'Günlük Ders Planları'],
        ['2.', 'Zümre Toplantı Raporları'],
        ['3.', 'ŞÖK Tutanakları'],
        ['4.', 'Defter Kontrolleri'],
      ]
      sections.forEach(([num, title], i) => {
        doc.text(`${num} ${title}`, margin + 4, 152 + i * 8)
      })

      // ── 1. Günlük Planlar ────────────────────────────────────────────────────
      addSectionHeader('1. Günlük Ders Planları')
      if (data.dailyPlans.length > 0) {
        autoTable(doc, {
          startY: 25,
          head: [['Tarih', 'Sınıf', 'Konu']],
          body: data.dailyPlans.map(p => [
            new Date(p.plan_date).toLocaleDateString('tr-TR'),
            p.className,
            p.topic,
          ]),
          styles:     { font: 'Roboto', fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
          margin: { left: margin, right: margin },
        })
      } else {
        doc.setFontSize(9)
        doc.text('Bu dönem günlük plan kaydı bulunmuyor.', margin, 30)
      }

      // ── 2. Zümre Toplantıları ────────────────────────────────────────────────
      addSectionHeader('2. Zümre Toplantı Raporları')
      if (data.zumreMeetings.length > 0) {
        autoTable(doc, {
          startY: 25,
          head: [['Tarih', 'Konu Başlığı']],
          body: data.zumreMeetings.map(m => [
            new Date(m.meeting_date).toLocaleDateString('tr-TR'),
            m.title,
          ]),
          styles:     { font: 'Roboto', fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
          margin: { left: margin, right: margin },
        })
      } else {
        doc.setFontSize(9)
        doc.text('Bu dönem zümre toplantı kaydı bulunmuyor.', margin, 30)
      }

      // ── 3. ŞÖK Tutanakları ───────────────────────────────────────────────────
      addSectionHeader('3. ŞÖK Tutanakları')
      if (data.sokReports.length > 0) {
        autoTable(doc, {
          startY: 25,
          head: [['Tarih', 'Sınıf', 'Dönem', 'Eğitim Yılı']],
          body: data.sokReports.map(s => [
            new Date(s.meeting_date).toLocaleDateString('tr-TR'),
            s.className,
            `${s.term}. Dönem`,
            s.academic_year,
          ]),
          styles:     { font: 'Roboto', fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
          margin: { left: margin, right: margin },
        })
      } else {
        doc.setFontSize(9)
        doc.text('Bu dönem ŞÖK tutanağı bulunmuyor.', margin, 30)
      }

      // ── 4. Defter Kontrolleri ────────────────────────────────────────────────
      addSectionHeader('4. Defter Kontrolleri')
      if (data.notebookChecks.length > 0) {
        autoTable(doc, {
          startY: 25,
          head: [['Tarih', 'Sınıf']],
          body: data.notebookChecks.map(n => [
            new Date(n.check_date).toLocaleDateString('tr-TR'),
            n.className,
          ]),
          styles:     { font: 'Roboto', fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
          margin: { left: margin, right: margin },
        })
      } else {
        doc.setFontSize(9)
        doc.text('Bu dönem defter kontrol kaydı bulunmuyor.', margin, 30)
      }

      const safeTeacher = data.teacherName.replace(/\s+/g, '_')
      doc.save(`OgretmenDosyasi_${safeTeacher}_${data.academicYear}.pdf`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="text-xs bg-gray-800 text-white rounded-lg px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50 hover:bg-gray-700 transition-colors"
    >
      {loading ? (
        <>
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Hazırlanıyor...
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          PDF İndir
        </>
      )}
    </button>
  )
}
