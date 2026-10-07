'use client'

import { useState, useTransition } from 'react'
import { assignMentors } from '@/app/actions/mentor'

type Ogrenci = { id: string; full_name: string; mentor: string | null }
type Ogretmen = { id: string; full_name: string }

/** İdare: sınıfın öğrencilerini mentörlere böler. Seçilenlere ata / mentörü kaldır. */
export default function MentorDagilimiKarti({ classId, ogrenciler, ogretmenler }: { classId: string; ogrenciler: Ogrenci[]; ogretmenler: Ogretmen[] }) {
  const [secili, setSecili] = useState<Set<string>>(new Set())
  const [mentor, setMentor] = useState('')
  const [mesaj, setMesaj] = useState<{ tur: 'hata' | 'ok'; metin: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const atanmis = ogrenciler.filter(o => o.mentor).length

  function degistir(id: string) {
    setSecili(s => { const y = new Set(s); if (y.has(id)) y.delete(id); else y.add(id); return y })
  }
  function uygula(mentorId: string | null) {
    setMesaj(null)
    startTransition(async () => {
      const r = await assignMentors(classId, [...secili], mentorId)
      if (r.error) setMesaj({ tur: 'hata', metin: r.error })
      else { setMesaj({ tur: 'ok', metin: mentorId ? 'Atandı' : 'Mentör kaldırıldı' }); setSecili(new Set()) }
    })
  }

  return (
    <details className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 mb-5">
      <summary className="cursor-pointer text-sm font-semibold text-gray-700 dark:text-slate-300">
        Mentör Dağılımı <span className="font-normal text-gray-500 dark:text-slate-400">({atanmis}/{ogrenciler.length} atanmış)</span>
      </summary>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="mentor-sec">Mentör</label>
        <select id="mentor-sec" value={mentor} onChange={e => setMentor(e.target.value)}
          className="px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg text-base bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100">
          <option value="">Mentör seç…</option>
          {ogretmenler.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
        </select>
        <button type="button" disabled={!mentor || secili.size === 0 || isPending} onClick={() => uygula(mentor)}
          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white disabled:opacity-50">
          Seçilenlere ata ({secili.size})
        </button>
        <button type="button" disabled={secili.size === 0 || isPending} onClick={() => uygula(null)}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 disabled:opacity-50">
          Mentörü kaldır
        </button>
        {mesaj && <span role="status" className={`text-sm ${mesaj.tur === 'hata' ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>{mesaj.metin}</span>}
      </div>
      <ul className="mt-3 divide-y divide-gray-100 dark:divide-slate-700">
        {ogrenciler.map(o => (
          <li key={o.id}>
            <label className="flex items-center gap-3 py-2 min-h-[44px] cursor-pointer">
              <input type="checkbox" checked={secili.has(o.id)} onChange={() => degistir(o.id)} className="w-4 h-4" />
              <span className="flex-1 text-sm text-gray-900 dark:text-slate-100">{o.full_name}</span>
              <span className="text-sm text-gray-500 dark:text-slate-400">{o.mentor ?? '—'}</span>
            </label>
          </li>
        ))}
      </ul>
    </details>
  )
}
