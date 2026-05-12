'use client'

import { useRef, useState } from 'react'

const TEMPLATES = [
  {
    label: 'Dönem Başı',
    title: 'Dönem Başı Zümre Toplantısı',
    notes: `GÜNDEM MADDELERİ

1. Açılış ve yoklama
2. Geçen dönem/yılın genel değerlendirilmesi
3. Öğretim programlarının (TYMM) incelenmesi ve yıllık plan hazırlığı
4. Ölçme-değerlendirme yöntemleri ve ortak sınav takviminin belirlenmesi
5. Ödev ve proje politikasının belirlenmesi
6. Araç-gereç ve kaynak ihtiyacının tespiti
7. Destekleme ve Yetiştirme Kursu (DYK) planlaması
8. Bireysel farklılıkları olan öğrencilerin değerlendirilmesi
9. Dilek, öneri ve kapanış

ALINAN KARARLAR
-
-

Toplantı saat ___'de sona erdi.`,
  },
  {
    label: 'Ölçme-Değerlendirme',
    title: 'Ölçme ve Değerlendirme Zümre Toplantısı',
    notes: `GÜNDEM MADDELERİ

1. Açılış ve yoklama
2. Yapılan sınavların sınıf/şube bazında sonuçlarının değerlendirilmesi
3. Başarı düzeyi düşük konuların tespiti ve analizi
4. Telafi ve ek çalışma planlaması
5. Soru tipleri ve sınav formatının gözden geçirilmesi
6. Bir sonraki ölçme-değerlendirme takviminin belirlenmesi
7. Dilek, öneri ve kapanış

ALINAN KARARLAR
-
-

Toplantı saat ___'de sona erdi.`,
  },
  {
    label: 'Müfredat',
    title: 'Müfredat Değerlendirme Zümre Toplantısı',
    notes: `GÜNDEM MADDELERİ

1. Açılış ve yoklama
2. İşlenen konuların ve TYMM kazanımlarının değerlendirilmesi
3. Müfredat aksaklıklarının ve eksik kalan konuların tespiti
4. Telafi planı ve konu dağılımının güncellenmesi
5. Öğrencilerin konu bazlı başarı durumlarının değerlendirilmesi
6. Bir sonraki dönem müfredat dağılımının belirlenmesi
7. Dilek, öneri ve kapanış

ALINAN KARARLAR
-
-

Toplantı saat ___'de sona erdi.`,
  },
  {
    label: 'Dönem Sonu',
    title: 'Dönem Sonu Zümre Toplantısı',
    notes: `GÜNDEM MADDELERİ

1. Açılış ve yoklama
2. Dönemin genel değerlendirmesi; işlenen konu ve kazanım başarı oranları
3. Sınıf ve şube başarılarının karşılaştırılması
4. Genel sınav başarı oranları ve analizi
5. Bir sonraki döneme yönelik öneri ve hedefler
6. Gelecek dönem ortak sınav takvimi
7. Dilek, öneri ve kapanış

ALINAN KARARLAR
-
-

Toplantı saat ___'de sona erdi.`,
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
