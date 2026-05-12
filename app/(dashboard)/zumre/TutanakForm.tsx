'use client'

import { useRef, useState } from 'react'

const TEMPLATES = [
  {
    label: 'Dönem Başı',
    title: 'Dönem Başı Zümre Toplantısı',
    notes: 'Dönem hedefleri ve takvim belirlendi. Ortak sınav tarihleri kararlaştırıldı. Ödev takip sistemi gözden geçirildi. Müfredat uyum planı yapıldı.',
  },
  {
    label: 'Ölçme-Değerlendirme',
    title: 'Ölçme ve Değerlendirme Toplantısı',
    notes: 'Sınav sonuçları analiz edildi. Sınıf bazlı başarı yüzdeleri değerlendirildi. Yetersiz kalan konular için ek çalışma planlandı. Bir sonraki sınav takvimi belirlendi.',
  },
  {
    label: 'Müfredat',
    title: 'Müfredat Değerlendirme Toplantısı',
    notes: 'İşlenen konular ve kazanımlar değerlendirildi. Eksik kalan konular için telafi planı oluşturuldu. Bir sonraki dönem müfredat dağılımı belirlendi.',
  },
  {
    label: 'Rehberlik',
    title: 'Öğrenci Rehberlik ve Veli Toplantısı',
    notes: 'Başarı durumu düşük öğrenciler görüşüldü. Veli bilgilendirme planı yapıldı. Destekleme ve yetiştirme kursu ihtiyacı değerlendirildi.',
  },
]

export default function TutanakForm({
  action,
  inputCls,
}: {
  action: (formData: FormData) => Promise<void>
  inputCls: string
}) {
  const titleRef = useRef<HTMLInputElement>(null)
  const notesRef = useRef<HTMLTextAreaElement>(null)
  const [active, setActive] = useState<number | null>(null)

  const applyTemplate = (i: number) => {
    const tpl = TEMPLATES[i]
    if (titleRef.current) titleRef.current.value = tpl.title
    if (notesRef.current) notesRef.current.value = tpl.notes
    setActive(i)
  }

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Yeni Toplantı</h2>
      </div>

      {/* Şablon butonları */}
      <div className="mb-3">
        <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">Şablon seç:</p>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATES.map((tpl, i) => (
            <button
              key={i}
              type="button"
              onClick={() => applyTemplate(i)}
              className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                active === i
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-400 hover:border-blue-400 hover:text-blue-600'
              }`}
            >
              {tpl.label}
            </button>
          ))}
        </div>
      </div>

      <form action={action} className="space-y-3">
        <input ref={titleRef} name="title" type="text" required placeholder="Toplantı başlığı" className={inputCls} />
        <input name="meeting_date" type="date" required className={inputCls} />
        <textarea ref={notesRef} name="notes" rows={4} placeholder="Toplantı notları..." className={inputCls + ' resize-none'} />
        <button type="submit" className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          Ekle
        </button>
      </form>
    </div>
  )
}
