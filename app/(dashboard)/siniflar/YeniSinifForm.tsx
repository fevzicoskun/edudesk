'use client'

import { useActionState } from 'react'
import { createClass } from '@/src/domains/classes/actions'

const inputCls = 'px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-base bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function YeniSinifForm() {
  const [state, formAction, isPending] = useActionState(createClass, null)

  return (
    <form action={formAction} className="flex gap-2 flex-wrap">
      <input name="name" type="text" required placeholder="9-A" className={inputCls} />
      <input name="grade" type="number" required placeholder="Sınıf (9)" min="1" max="12" className={`${inputCls} w-28`} />
      <button
        type="submit"
        disabled={isPending}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
      >
        {isPending ? 'Ekleniyor…' : 'Ekle'}
      </button>
      {state?.error && (
        <p role="alert" className="basis-full text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </form>
  )
}
