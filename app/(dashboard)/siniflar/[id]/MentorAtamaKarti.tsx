'use client'

import { useState, useTransition } from 'react'
import { assignClassMentor } from '@/app/actions/mentor'

type Teacher = { id: string; full_name: string }

export default function MentorAtamaKarti({
  classId,
  teachers,
  currentMentorId,
}: {
  classId: string
  teachers: Teacher[]
  currentMentorId: string | null
}) {
  const [selected, setSelected] = useState(currentMentorId ?? '')
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Seçim mevcut atamadan farklıysa kaydet aktif (boş = atanmadı)
  const dirty = (selected || null) !== (currentMentorId || null)

  function save() {
    setMsg(null)
    startTransition(async () => {
      const result = await assignClassMentor(classId, selected || null)
      if (result.error) setMsg({ type: 'err', text: result.error })
      else setMsg({ type: 'ok', text: 'Rehber öğretmen güncellendi' })
    })
  }

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5 mb-5">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Rehber Öğretmen</h2>
      <div className="flex gap-2 flex-wrap items-center">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-base bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— Atanmadı —</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>{t.full_name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={save}
          disabled={isPending || !dirty}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
      {msg && (
        <p className={`text-xs mt-2 ${msg.type === 'ok' ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
          {msg.text}
        </p>
      )}
      <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-2">
        Rehber öğretmen, sınıf öğrencileri için görüşme/gözlem raporu yazabilir; günlük yoklama hatırlatması da bu kişiye gider.
      </p>
    </div>
  )
}
