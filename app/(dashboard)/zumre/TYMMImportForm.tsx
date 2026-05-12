'use client'

import { useActionState, useState } from 'react'
import { importFromTYMM } from '@/app/actions/zumre'
import { TYMM_DATA, TYMM_SUBJECTS } from '@/lib/tymm-data'

type ImportState = { imported?: number; skipped?: number; error?: string } | null

export default function TYMMImportForm({
  classes,
}: {
  classes: { id: string; name: string; grade: number }[]
}) {
  const [state, action, pending] = useActionState(importFromTYMM, null)
  const [subject, setSubject] = useState('')
  const [classId, setClassId] = useState('')

  const selectedClass = classes.find((c) => c.id === classId)
  const grade = selectedClass?.grade ?? null
  const gradeHasData = grade !== null && TYMM_DATA[subject]?.[grade] !== undefined
  const preview = subject && grade ? (TYMM_DATA[subject]?.[grade] ?? []) : []

  // Group classes by grade for the optgroup display
  const allGrades = [...new Set(classes.map((c) => c.grade))].sort((a, b) => a - b)

  return (
    <div className="bg-white dark:bg-slate-800 border border-blue-100 dark:border-blue-900/40 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">
          TYMM Şablonundan Yükle
        </h2>
      </div>
      <p className="text-xs text-gray-400 dark:text-slate-500 mb-4 ml-4">
        Türkiye Yüzyılı Maarif Modeli müfredatından hazır konuları ekleyin
      </p>

      <form action={action} className="space-y-3">
        {/* Ders seçimi */}
        <select
          name="subject"
          required
          value={subject}
          onChange={(e) => { setSubject(e.target.value); setClassId('') }}
          className="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Ders seçin</option>
          {TYMM_SUBJECTS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Sınıf seçimi — tüm sınıflar gösterilir */}
        <select
          name="class_id"
          required
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          disabled={!subject}
          className="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <option value="">{subject ? 'Sınıf seçin' : 'Önce ders seçin'}</option>
          {classes.length === 0 && <option disabled>Henüz sınıf eklenmemiş</option>}
          {allGrades.map((g) => {
            const gc = classes.filter((c) => c.grade === g)
            if (!gc.length) return null
            return (
              <optgroup key={g} label={`${g}. Sınıf`}>
                {gc.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </optgroup>
            )
          })}
        </select>

        {/* Uyarı: seçilen sınıf için TYMM verisi yok */}
        {subject && classId && !gradeHasData && (
          <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
            Bu ders için {grade}. sınıf verisi bulunmuyor. TYMM kapsamı 9–12. sınıflardır.
          </p>
        )}

        {/* Önizleme */}
        {preview.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 rounded-lg p-3 max-h-64 overflow-y-auto">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">
              {preview.length} konu eklenecek:
            </p>
            <ul className="space-y-1">
              {preview.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <span className="shrink-0 font-mono text-blue-400 dark:text-blue-500 bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded text-[10px]">
                    {t.code}
                  </span>
                  <span className="text-blue-700 dark:text-blue-300">{t.topic}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="submit"
          disabled={pending || preview.length === 0}
          className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending
            ? 'Ekleniyor...'
            : preview.length > 0
            ? `${preview.length} Konuyu Müfredatıma Ekle`
            : 'Ders ve Sınıf Seçin'}
        </button>

        {state?.imported != null && (
          <div className="text-center">
            <p className="text-sm text-green-600 dark:text-green-400 font-medium">
              ✓ {state.imported} konu eklendi
              {(state.skipped ?? 0) > 0 && (
                <span className="text-gray-400 font-normal"> · {state.skipped} zaten vardı, atlandı</span>
              )}
            </p>
          </div>
        )}
        {state?.error && (
          <p className="text-sm text-red-600 dark:text-red-400 text-center">{state.error}</p>
        )}
      </form>
    </div>
  )
}
