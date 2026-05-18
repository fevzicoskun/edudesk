'use client'

import { useState, useTransition, useRef } from 'react'
import { deleteExam, createExamReturning } from '@/src/domains/zumre/actions'
import SinavCard from './SinavCard'

interface Exam {
  id: string
  title: string
  subject: string
  exam_date: string
  grades: number[] | null
  grade_map: { name: string; grade: string }[] | null
}

interface ClassInfo {
  id: string
  name: string
  grade: number
}

const inputCls = 'w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 dark:placeholder:text-slate-400'

export default function SinavListesi({
  exams: initial,
  isBaskan,
  classes,
}: {
  exams: Exam[]
  isBaskan: boolean
  classes: ClassInfo[]
}) {
  const [exams, setExams] = useState(initial)
  const [, startTransition] = useTransition()
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const remove = (id: string) => {
    setExams(prev => prev.filter(e => e.id !== id))
    startTransition(() => deleteExam(id, new FormData()))
  }

  const handleSubmit = async (formData: FormData) => {
    setFormError('')
    setPending(true)
    const result = await createExamReturning(formData)
    setPending(false)
    if ('error' in result) {
      setFormError(result.error)
      return
    }
    setExams(prev => [result, ...prev])
    formRef.current?.reset()
  }

  return (
    <div className="space-y-4">
      {isBaskan ? (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Yeni Ortak Sınav</h2>
          <form ref={formRef} action={handleSubmit} className="space-y-3">
            <input name="title" type="text" required placeholder="Sınav başlığı" className={inputCls} />
            <input name="subject" type="text" required placeholder="Ders" className={inputCls} />
            <input name="exam_date" type="date" required className={inputCls} />
            {formError && <p className="text-xs text-red-600">{formError}</p>}
            <button
              type="submit"
              disabled={pending}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {pending ? 'Ekleniyor…' : 'Ekle'}
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl px-4 py-3">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Ortak sınav oluşturma yetkisi Zümre Başkanı&apos;na aittir.
          </p>
        </div>
      )}

      {exams.length === 0 ? (
        <p className="text-center py-12 text-gray-400 dark:text-slate-500 text-sm">Henüz sınav eklenmemiş.</p>
      ) : (
        <div className="space-y-3">
          {exams.map(e => (
            <SinavCard key={e.id} exam={e} onDelete={() => remove(e.id)} isBaskan={isBaskan} classes={classes} />
          ))}
        </div>
      )}
    </div>
  )
}
