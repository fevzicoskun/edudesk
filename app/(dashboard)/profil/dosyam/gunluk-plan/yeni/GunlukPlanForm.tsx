'use client'

import { useActionState, useState, useEffect } from 'react'
import { useRouter }     from 'next/navigation'
import { createDailyPlanAction, updateDailyPlanAction } from '@/app/actions/inspection'
import {
  DEFAULT_INTRO_TEXT,
  DEFAULT_DEVELOPMENT_TEXT,
  DEFAULT_CONCLUSION_TEXT,
  LESSON_METHODS,
  LESSON_MATERIALS,
} from '@/src/domains/inspection/types'

interface Props {
  classes: { id: string; name: string; grade: number }[]
  defaultValues?: {
    class_id:         string
    plan_date:        string
    lesson_hour:      number
    unit:             string
    topic:            string
    objectives:       string[]
    methods:          string[]
    materials:        string[]
    intro_text:       string
    development_text: string
    conclusion_text:  string
  }
  planId?: string
}

export default function GunlukPlanForm({ classes, defaultValues, planId }: Props) {
  const boundAction = defaultValues && planId
    ? updateDailyPlanAction.bind(null, planId)
    : createDailyPlanAction
  const [state, action, pending] = useActionState(boundAction, null)
  const router = useRouter()

  const [selectedMethods,   setSelectedMethods]   = useState<string[]>(defaultValues?.methods   ?? [])
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>(defaultValues?.materials ?? [])

  useEffect(() => {
    if (state && 'id' in state && state.id) {
      router.push('/profil/dosyam/gunluk-plan')
    }
  }, [state, router])

  const toggleMethod = (m: string) =>
    setSelectedMethods(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])

  const toggleMaterial = (m: string) =>
    setSelectedMaterials(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])

  return (
    <form action={action} className="flex flex-col gap-4 max-w-2xl">
      <h1 className="text-lg font-bold">{planId ? 'Planı Düzenle' : 'Yeni Günlük Plan'}</h1>

      {state?.error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
          {state.error}
        </div>
      )}

      {/* Controlled hidden inputs */}
      <input type="hidden" name="methods"   value={selectedMethods.join(',')} />
      <input type="hidden" name="materials" value={selectedMaterials.join(',')} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-700">Sınıf *</label>
          <select name="class_id" required defaultValue={defaultValues?.class_id ?? ''}
            className="w-full mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
            <option value="">Seç...</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-700">Tarih *</label>
          <input type="date" name="plan_date" required
            defaultValue={defaultValues?.plan_date ?? new Date().toISOString().split('T')[0]}
            className="w-full mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-700">Ders Saati *</label>
          <select name="lesson_hour" required defaultValue={String(defaultValues?.lesson_hour ?? 1)}
            className="w-full mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
            {[1,2,3,4,5,6,7,8].map(h => (
              <option key={h} value={h}>{h}. Saat</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-700">Ünite *</label>
          <input type="text" name="unit" required defaultValue={defaultValues?.unit ?? ''}
            placeholder="ör: Fonksiyonlar"
            className="w-full mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-700">Konu *</label>
        <input type="text" name="topic" required defaultValue={defaultValues?.topic ?? ''}
          placeholder="ör: Bileşke Fonksiyon"
          className="w-full mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-700 block mb-1">Öğretim Yöntemleri</label>
        <div className="flex flex-wrap gap-2">
          {LESSON_METHODS.map(m => (
            <button
              key={m}
              type="button"
              onClick={() => toggleMethod(m)}
              className={`text-xs rounded-full px-3 py-1 border transition-colors ${
                selectedMethods.includes(m)
                  ? 'bg-blue-100 border-blue-300 text-blue-800'
                  : 'bg-gray-50 border-gray-200 text-gray-600'
              }`}
            >
              {selectedMethods.includes(m) ? '✓ ' : ''}{m}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-700 block mb-1">Araç-Gereçler</label>
        <div className="flex flex-wrap gap-2">
          {LESSON_MATERIALS.map(m => (
            <button
              key={m}
              type="button"
              onClick={() => toggleMaterial(m)}
              className={`text-xs rounded-full px-3 py-1 border transition-colors ${
                selectedMaterials.includes(m)
                  ? 'bg-blue-100 border-blue-300 text-blue-800'
                  : 'bg-gray-50 border-gray-200 text-gray-600'
              }`}
            >
              {selectedMaterials.includes(m) ? '✓ ' : ''}{m}
            </button>
          ))}
        </div>
      </div>

      {[
        { name: 'intro_text',       label: 'Giriş / Hazırlık (5 dk)',       def: DEFAULT_INTRO_TEXT },
        { name: 'development_text', label: 'Gelişme / Konu İşleme (30 dk)', def: DEFAULT_DEVELOPMENT_TEXT },
        { name: 'conclusion_text',  label: 'Sonuç / Değerlendirme (5 dk)',  def: DEFAULT_CONCLUSION_TEXT },
      ].map(({ name, label, def }) => (
        <div key={name}>
          <label className="text-xs font-semibold text-gray-700">{label}</label>
          <textarea
            name={name}
            required
            rows={3}
            defaultValue={(defaultValues as Record<string, unknown>)?.[name] as string ?? def}
            className="w-full mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm resize-y"
          />
        </div>
      ))}

      <div className="flex gap-2">
        <button type="submit" disabled={pending}
          className="bg-blue-600 text-white text-sm rounded-lg px-4 py-2 disabled:opacity-50">
          {pending ? 'Kaydediliyor...' : '💾 Kaydet'}
        </button>
        <a href="/profil/dosyam/gunluk-plan"
          className="bg-gray-100 text-gray-700 text-sm rounded-lg px-4 py-2">
          İptal
        </a>
      </div>
    </form>
  )
}
