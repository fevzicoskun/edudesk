'use client'

import { useTransition, useState } from 'react'
import { toggleDosyaItemAction } from '@/app/actions/ogretmen-dosyasi'

export type ChecklistGroup = {
  label: string
  icon: string
  items: { key: string; label: string }[]
}

export const DOSYA_GRUPLARI: ChecklistGroup[] = [
  {
    label: 'Planlar',
    icon: '📋',
    items: [
      { key: 'yillik_plan',        label: 'Yıllık Çalışma Planı' },
      { key: 'unite_planlari',     label: 'Ünite / Modül Planları' },
      { key: 'gunluk_planlar',     label: 'Günlük Ders Planları' },
    ],
  },
  {
    label: 'Sınavlar ve Değerlendirme',
    icon: '📝',
    items: [
      { key: 'yazili_soru_kagitlari', label: 'Yazılı Sınav Soruları' },
      { key: 'cevap_anahtarlari',     label: 'Cevap Anahtarları' },
      { key: 'not_cizelgesi',         label: 'Not / Puan Çizelgesi' },
    ],
  },
  {
    label: 'Toplantı Tutanakları',
    icon: '📑',
    items: [
      { key: 'zumre_tutanagi',       label: 'Zümre Toplantısı Tutanağı' },
      { key: 'subk_tutanagi',        label: 'Şube Öğretmenler Kurulu Tutanağı' },
      { key: 'ogretmenler_kurulu',   label: 'Öğretmenler Kurulu Tutanağı' },
    ],
  },
  {
    label: 'Öğrenci Takip',
    icon: '👥',
    items: [
      { key: 'devamsizlik_cizelgesi', label: 'Devamsızlık Çizelgesi' },
      { key: 'defter_kontrolu',       label: 'Defter / Çalışma Kitabı Kontrolü' },
      { key: 'ogrenci_gozlem',        label: 'Öğrenci Gözlem / Görüşme Formu' },
    ],
  },
  {
    label: 'Diğer Belgeler',
    icon: '📂',
    items: [
      { key: 'proje_performans',    label: 'Proje / Performans Ödevi Kağıtları' },
      { key: 'ders_kitabi_dagitim', label: 'Ders Kitabı Dağıtım Tutanağı' },
      { key: 'donem_sonu_ozeti',    label: 'Dönem Sonu Notu / Karne Özeti' },
    ],
  },
]

const TOTAL = DOSYA_GRUPLARI.reduce((n, g) => n + g.items.length, 0)

export default function ChecklistClient({
  initialChecked,
  academicYear,
}: {
  initialChecked: string[]
  academicYear: string
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set(initialChecked))
  const [pending, startTransition] = useTransition()

  function toggle(key: string) {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
    startTransition(async () => {
      await toggleDosyaItemAction(key)
    })
  }

  const score = Math.round((checked.size / TOTAL) * 100)

  return (
    <div>
      {/* İlerleme başlığı */}
      <div className="bg-gradient-to-r from-indigo-900 to-indigo-700 rounded-xl p-5 text-white mb-5">
        <div className="flex items-end justify-between mb-2">
          <div>
            <div className="text-xs opacity-75">{academicYear} Öğretmen Dosyası</div>
            <div className="text-2xl font-extrabold mt-0.5">%{score}</div>
            <div className="text-xs opacity-75">tamamlandı · {checked.size}/{TOTAL} belge</div>
          </div>
          {score === 100 && (
            <span className="text-sm bg-emerald-400 text-emerald-900 font-bold px-3 py-1 rounded-full">
              ✓ Dosya Tam
            </span>
          )}
        </div>
        <div className="bg-white/20 rounded h-1.5">
          <div
            className="bg-emerald-400 h-1.5 rounded transition-all duration-300"
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      {/* Gruplar */}
      <div className="flex flex-col gap-4">
        {DOSYA_GRUPLARI.map(group => {
          const groupDone = group.items.filter(i => checked.has(i.key)).length
          return (
            <div key={group.label} className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
                <span>{group.icon}</span>
                <span className="text-sm font-semibold text-gray-700 dark:text-slate-200 flex-1">{group.label}</span>
                <span className="text-xs text-gray-400 dark:text-slate-500">{groupDone}/{group.items.length}</span>
              </div>
              <ul className="divide-y divide-gray-100 dark:divide-slate-700/50">
                {group.items.map(item => {
                  const done = checked.has(item.key)
                  return (
                    <li key={item.key}>
                      <button
                        type="button"
                        onClick={() => toggle(item.key)}
                        disabled={pending}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                          ${done
                            ? 'bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-950/40'
                            : 'bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800'
                          }
                          disabled:opacity-60`}
                      >
                        <span className={`w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center transition-colors
                          ${done
                            ? 'bg-emerald-500 border-emerald-500'
                            : 'border-gray-300 dark:border-slate-600'
                          }`}
                        >
                          {done && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        <span className={`text-sm ${done ? 'line-through text-gray-400 dark:text-slate-500' : 'text-gray-700 dark:text-slate-200'}`}>
                          {item.label}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
