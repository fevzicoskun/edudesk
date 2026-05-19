'use client'

import { useState } from 'react'

const STORAGE_KEY = 'dosya_checklist_v1'

const BELGELER = [
  {
    kategori: 'Temel Belgeler',
    belgeler: [
      { id: 'kapak', ad: 'Dosya kapak sayfası' },
      { id: 'bayrak', ad: 'Türk Bayrağı' },
      { id: 'ataturk_portre', ad: 'Atatürk Portresi' },
      { id: 'istiklal_marsi', ad: 'İstiklal Marşı metni' },
      { id: 'genclige_hitabe', ad: "Atatürk'ün Gençliğe Hitabesi" },
      { id: 'ozgecmis', ad: 'Öğretmen Özgeçmişi (CV)' },
    ],
  },
  {
    kategori: 'Yasal Dayanak',
    belgeler: [
      { id: 'mufredat', ad: 'Branşa ait öğretim programı (müfredat)' },
      { id: 'meb_kanun', ad: '1739 Sayılı Millî Eğitim Temel Kanunu' },
      { id: 'calisma_takvimi', ad: '2025–2026 Yıllık Çalışma Takvimi (okul takvimi)' },
    ],
  },
  {
    kategori: 'Planlama Belgeleri',
    belgeler: [
      { id: 'yillik_plan', ad: 'Yıllık plan (ünitelendirilmiş)' },
      { id: 'gunluk_plan', ad: 'Günlük / ders planları' },
      { id: 'haftalik_program', ad: 'Haftalık ders programı (okul yönetimince tasdikli)' },
    ],
  },
  {
    kategori: 'Kurul & Zümre Belgeleri',
    belgeler: [
      { id: 'zumre_1', ad: 'Zümre öğretmenler kurulu toplantı tutanağı — 1. dönem' },
      { id: 'zumre_2', ad: 'Zümre öğretmenler kurulu toplantı tutanağı — 2. dönem' },
      { id: 'il_zumre', ad: 'İl / İlçe zümre toplantı tutanakları' },
      { id: 'sube_kurulu', ad: 'Şube öğretmenler kurulu kararları' },
      { id: 'ogretmenler_kurulu', ad: 'Öğretmenler kurulu kararları' },
    ],
  },
  {
    kategori: 'Değerlendirme Belgeleri',
    belgeler: [
      { id: 'sinif_listesi', ad: 'Sınıf listesi / yoklama çizelgesi' },
      { id: 'performans', ad: 'Öğrenci performans / proje değerlendirme çizelgesi' },
      { id: 'yazili_sorular', ad: 'Yazılı sınav soruları ve cevap anahtarları (puanlama ile)' },
      { id: 'proje_rubrigi', ad: 'Proje değerlendirme formu / rubriği' },
      { id: 'sozlu_form', ad: 'Sözlü değerlendirme formu' },
    ],
  },
  {
    kategori: 'Mesleki Gelişim',
    belgeler: [
      { id: 'hizmetici', ad: 'Hizmetiçi eğitim katılım belgeleri' },
      { id: 'sertifikalar', ad: 'Kurs ve seminer sertifikaları' },
      { id: 'gelisim_plani', ad: 'Mesleki gelişim planı' },
    ],
  },
  {
    kategori: 'Veli İletişimi',
    belgeler: [
      { id: 'veli_gorusme', ad: 'Veli görüşme tutanakları' },
      { id: 'veli_bilgi', ad: 'Veli bilgilendirme yazıları' },
    ],
  },
  {
    kategori: 'Kulüp & Sosyal Etkinlik',
    belgeler: [
      { id: 'kulup_yonerge', ad: 'Kulüp yönergesi / yıllık çalışma planı' },
      { id: 'kulup_uye', ad: 'Kulüp üye listesi' },
      { id: 'kulup_tutanak', ad: 'Kulüp etkinlik toplantı tutanakları' },
      { id: 'belirli_gunler', ad: 'Belirli gün ve haftalar çizelgesi' },
    ],
  },
]

export default function DosyaPdfButton() {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      let checked: Record<string, boolean> = {}
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) checked = JSON.parse(saved) as Record<string, boolean>
      } catch { /* ignore */ }

      const { createDoc } = await import('@/src/lib/createPdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = await createDoc({ orientation: 'portrait', unit: 'mm', format: 'a4' })

      const date = new Date().toLocaleDateString('tr-TR')
      const total = BELGELER.reduce((s, k) => s + k.belgeler.length, 0)
      const done = Object.values(checked).filter(Boolean).length

      // Başlık
      doc.setFontSize(16)
      doc.text('Öğretmen Dosyası Kontrol Listesi', 14, 18)
      doc.setFontSize(10)
      doc.setTextColor(100)
      doc.text(`Oluşturulma: ${date}   |   Tamamlanan: ${done}/${total} belge`, 14, 26)
      doc.setTextColor(0)

      let yStart = 32

      for (const { kategori, belgeler } of BELGELER) {
        const rows = belgeler.map(b => [
          checked[b.id] ? 'Tamam' : 'Eksik',
          b.ad,
        ])

        autoTable(doc, {
          head: [[{ content: kategori, colSpan: 2, styles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' } }]],
          body: rows,
          startY: yStart,
          columnStyles: {
            0: { cellWidth: 20, halign: 'center' },
            1: { cellWidth: 'auto' },
          },
          bodyStyles: { fontSize: 9 },
          headStyles: { fontSize: 10 },
          margin: { left: 14, right: 14 },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 0) {
              const val = data.cell.raw as string
              data.cell.styles.textColor = val === 'Tamam' ? [22, 163, 74] : [220, 38, 38]
            }
          },
        })

        const finalY = doc.lastAutoTable?.finalY ?? yStart
        yStart = finalY + 6
      }

      doc.save(`ogretmen-dosyasi-${new Date().toISOString().split('T')[0]}.pdf`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 min-h-[44px]"
    >
      <svg className="w-3.5 h-3.5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
      {loading ? 'Hazırlanıyor…' : 'PDF İndir'}
    </button>
  )
}
