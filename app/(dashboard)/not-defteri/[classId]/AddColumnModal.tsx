'use client'

import { useState, useActionState, useTransition, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import Button from '@/components/ui/Button'
import { addColumnAction } from '@/app/actions/grades'

interface Props {
  classId: string
  open:    boolean
  onClose: () => void
}

const INITIAL: { error?: string } = {}

export default function AddColumnModal({ classId, open, onClose }: Props) {
  const [state, formAction, isPending] = useActionState(addColumnAction, INITIAL)
  const prevPendingRef = useState(false)

  useEffect(() => {
    if (!isPending && state !== INITIAL && !state.error) {
      onClose()
    }
  }, [isPending, state])

  function handleSubmit(formData: FormData) {
    formData.set('class_id', classId)
    formAction(formData)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Yeni Ölçme Ekle</DialogTitle>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="add-title" className="text-sm font-medium">Başlık *</label>
            <input
              id="add-title"
              name="title"
              required
              maxLength={100}
              placeholder="Yazılı 1, Quiz 3..."
              className="w-full rounded-md border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="add-type" className="text-sm font-medium">Tür *</label>
            <select
              id="add-type"
              name="grade_type"
              required
              className="w-full rounded-md border bg-background px-3 py-2 text-base"
            >
              <option value="yazili">Yazılı</option>
              <option value="quiz">Quiz</option>
              <option value="proje">Proje</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="add-max" className="text-sm font-medium">Maks. Puan</label>
              <input
                id="add-max"
                name="max_score"
                type="number"
                defaultValue={100}
                min={1}
                max={1000}
                className="w-full rounded-md border bg-background px-3 py-2 text-base"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="add-date" className="text-sm font-medium">Tarih</label>
              <input
                id="add-date"
                name="exam_date"
                type="date"
                className="w-full rounded-md border bg-background px-3 py-2 text-base"
              />
            </div>
          </div>

          {state.error && (
            <p className="text-sm text-red-600">{state.error}</p>
          )}

          <DialogFooter>
            <Button variant="secondary" type="button" onClick={onClose}>İptal</Button>
            <Button variant="primary" type="submit" loading={isPending}>
              {isPending ? 'Ekleniyor...' : 'Ekle'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
