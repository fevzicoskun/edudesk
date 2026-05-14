'use client'

import { useState, useTransition } from 'react'
import { deleteExam } from '@/app/actions/zumre'
import SinavCard from './SinavCard'

interface Exam {
  id: string
  title: string
  subject: string
  exam_date: string
  grades: number[] | null
  grade_map: { name: string; grade: string }[] | null
}

export default function SinavListesi({ exams: initial, isBaskan }: { exams: Exam[]; isBaskan: boolean }) {
  const [exams, setExams] = useState(initial)
  const [, startTransition] = useTransition()

  const remove = (id: string) => {
    setExams(prev => prev.filter(e => e.id !== id))
    startTransition(() => deleteExam(id, new FormData()))
  }

  if (exams.length === 0)
    return <p className="text-center py-12 text-gray-400 dark:text-slate-500 text-sm">Henüz sınav eklenmemiş.</p>

  return (
    <div className="space-y-3">
      {exams.map(e => (
        <SinavCard key={e.id} exam={e} onDelete={() => remove(e.id)} isBaskan={isBaskan} />
      ))}
    </div>
  )
}
