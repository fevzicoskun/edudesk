'use client'

import { useActionState } from 'react'
import { importCurriculumFromFile } from '@/app/actions/zumre'

export default function MufredatImportForm({
  grades,
}: {
  grades: number[]
}) {
  const [state, action, pending] = useActionState(importCurriculumFromFile, null)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-1">Dosyadan İçe Aktar</h2>
      <p className="text-xs text-gray-400 mb-3">MEB müfredatı Excel (.xlsx) dosyası</p>
      <form action={action} className="space-y-3">
        <select
          name="grade"
          required
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Sınıf seviyesi seçin</option>
          {grades.map(g => (
            <option key={g} value={g}>{g}. Sınıf</option>
          ))}
        </select>
        <input
          name="file"
          type="file"
          accept=".xlsx,.xls"
          required
          className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        <button
          type="submit"
          disabled={pending}
          className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {pending ? 'Aktarılıyor...' : 'İçe Aktar'}
        </button>
        {state?.imported != null && (
          <p className="text-sm text-green-600 font-medium text-center">
            ✓ {state.imported} konu içe aktarıldı
          </p>
        )}
        {state?.error && (
          <p className="text-sm text-red-600 text-center">{state.error}</p>
        )}
      </form>
    </div>
  )
}
