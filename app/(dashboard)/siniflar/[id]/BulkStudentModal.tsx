'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addStudentsBulk } from '@/src/domains/classes/actions'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

export default function BulkStudentModal({
  classId,
  maxNumber,
}: {
  classId: string
  maxNumber: number
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit() {
    const lines = text.split('\n').filter((l) => l.trim())
    if (!lines.length) return

    let autoNum = maxNumber
    const students = lines
      .map((line) => {
        const trimmed = line.trim()
        if (!trimmed) return null
        const commaIdx = trimmed.indexOf(',')
        if (commaIdx !== -1) {
          const num = trimmed.slice(0, commaIdx).trim()
          const name = trimmed.slice(commaIdx + 1).trim()
          if (!name) return null
          return { full_name: name, student_number: num || null }
        }
        autoNum += 1
        return { full_name: trimmed, student_number: String(autoNum) }
      })
      .filter(Boolean) as { full_name: string; student_number: string | null }[]

    if (!students.length) return

    startTransition(async () => {
      await addStudentsBulk(classId, students)
      router.refresh()
      setOpen(false)
      setText('')
    })
  }

  function handleOpenChange(next: boolean) {
    if (!next) setText('')
    setOpen(next)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
      >
        Toplu Ekle
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Toplu Öğrenci Ekle</DialogTitle>
            <DialogDescription className="whitespace-pre-line">
              {`Her satıra bir öğrenci yaz. Format:\nnumara, ad soyad\nveya sadece: ad soyad (numara otomatik verilir)\n\nÖrnek:\n1, Ahmet Yılmaz\n2, Ayşe Demir\nMehmet Kaya`}
            </DialogDescription>
          </DialogHeader>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder="Öğrencileri buraya yazın..."
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />

          <DialogFooter>
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              İptal
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || !text.trim()}
              className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? 'Ekleniyor...' : 'Ekle'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
