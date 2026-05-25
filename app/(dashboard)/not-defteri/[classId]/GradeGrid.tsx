'use client'

import { useState, useCallback, useRef, useTransition } from 'react'
import Button from '@/components/ui/Button'
import { upsertScoreAction, deleteColumnAction } from '@/app/actions/grades'
import AddColumnModal from './AddColumnModal'
import ExportButton from './ExportButton'
import type { GradeColumn, GradeEntry } from '@/src/domains/grades/types'

interface Student {
  id:        string
  full_name: string
}

interface Props {
  classId:  string
  columns:  GradeColumn[]
  entries:  GradeEntry[]
  students: Student[]
  canWrite: boolean
}

type ScoreState = Record<string, Record<string, string>>

const GRADE_TYPE_LABEL: Record<string, string> = {
  yazili: 'Yazılı',
  quiz:   'Quiz',
  proje:  'Proje',
}

const GRADE_TYPE_CLASS: Record<string, string> = {
  yazili: 'bg-blue-100 text-blue-700',
  quiz:   'bg-yellow-100 text-yellow-700',
  proje:  'bg-green-100 text-green-700',
}

function buildScoreState(columns: GradeColumn[], entries: GradeEntry[]): ScoreState {
  const state: ScoreState = {}
  for (const col of columns) state[col.id] = {}
  for (const e of entries) {
    if (state[e.grade_column_id]) {
      state[e.grade_column_id][e.student_id] = e.score !== null ? String(e.score) : ''
    }
  }
  return state
}

export default function GradeGrid({ classId, columns, entries, students, canWrite }: Props) {
  const [scores, setScores] = useState<ScoreState>(() => buildScoreState(columns, entries))
  const [modalOpen, setModalOpen] = useState(false)
  const [, startTransition] = useTransition()
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const saveScore = useCallback((columnId: string, studentId: string, value: string) => {
    const score = value === '' ? null : Number(value)
    if (value !== '' && isNaN(score!)) return

    startTransition(async () => {
      await upsertScoreAction({ columnId, classId, studentId, score })
    })
  }, [classId])

  function handleChange(colId: string, studentId: string, value: string) {
    setScores(prev => ({
      ...prev,
      [colId]: { ...prev[colId], [studentId]: value },
    }))
  }

  function handleBlur(colId: string, studentId: string, value: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveScore(colId, studentId, value), 300)
  }

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    colIdx: number,
    stuIdx: number,
  ) {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const nextStuIdx = stuIdx + 1
      const colId = columns[colIdx]?.id
      if (!colId) return
      const nextId = nextStuIdx < students.length
        ? `cell-${colId}-${students[nextStuIdx]?.id}`
        : `cell-${columns[colIdx + 1]?.id}-${students[0]?.id}`
      document.getElementById(nextId)?.focus()
    }
  }

  function handleDeleteColumn(columnId: string) {
    if (!confirm('Bu sütunu ve tüm notları silmek istediğinize emin misiniz?')) return
    startTransition(async () => {
      await deleteColumnAction(columnId, classId)
    })
  }

  const columnAverages = columns.map(col => {
    const vals = students
      .map(s => scores[col.id]?.[s.id])
      .filter(v => v !== '' && v !== undefined)
      .map(Number)
      .filter(n => !isNaN(n))
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '—'
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Not Girişi</h2>
        <div className="flex gap-2">
          <ExportButton classId={classId} />
          {canWrite && (
            <Button size="sm" variant="primary" onClick={() => setModalOpen(true)}>
              + Ölçme Ekle
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="sticky left-0 z-10 bg-muted/80 px-4 py-3 text-left font-medium min-w-[180px]">
                Öğrenci
              </th>
              {columns.map(col => (
                <th key={col.id} className="px-3 py-3 text-center font-medium min-w-[110px]">
                  <div className="flex flex-col items-center gap-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${GRADE_TYPE_CLASS[col.grade_type] ?? ''}`}
                    >
                      {GRADE_TYPE_LABEL[col.grade_type] ?? col.grade_type}
                    </span>
                    <span className="font-semibold">{col.title}</span>
                    {col.exam_date && (
                      <span className="text-xs text-muted-foreground">{col.exam_date}</span>
                    )}
                    <span className="text-xs text-muted-foreground">/{col.max_score}</span>
                    {canWrite && (
                      <button
                        type="button"
                        title="Sütunu Sil"
                        className="text-xs text-red-500 hover:text-red-700 mt-1"
                        onClick={() => handleDeleteColumn(col.id)}
                      >
                        Sil
                      </button>
                    )}
                  </div>
                </th>
              ))}
              {columns.length === 0 && (
                <th className="px-4 py-3 text-muted-foreground italic font-normal">
                  Henüz ölçme eklenmedi
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {students.map((student, stuIdx) => (
              <tr key={student.id} className="border-t hover:bg-muted/30">
                <td className="sticky left-0 z-10 bg-background px-4 py-2 font-medium">
                  {student.full_name}
                </td>
                {columns.map((col, colIdx) => (
                  <td key={col.id} className="px-2 py-1 text-center">
                    {canWrite ? (
                      <input
                        id={`cell-${col.id}-${student.id}`}
                        type="number"
                        min={0}
                        max={col.max_score}
                        step="0.5"
                        value={scores[col.id]?.[student.id] ?? ''}
                        onChange={e => handleChange(col.id, student.id, e.target.value)}
                        onBlur={e => handleBlur(col.id, student.id, e.target.value)}
                        onKeyDown={e => handleKeyDown(e, colIdx, stuIdx)}
                        className="w-20 rounded border px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="—"
                      />
                    ) : (
                      <span className="text-muted-foreground">
                        {scores[col.id]?.[student.id] || '—'}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Bu sınıfa öğrenci eklenmemiş.
                </td>
              </tr>
            )}
          </tbody>
          {columns.length > 0 && students.length > 0 && (
            <tfoot>
              <tr className="border-t bg-muted/30 font-medium">
                <td className="sticky left-0 z-10 bg-muted/50 px-4 py-2 text-muted-foreground text-xs uppercase tracking-wide">
                  Sınıf ort.
                </td>
                {columnAverages.map((avg, i) => (
                  <td key={columns[i]!.id} className="px-2 py-2 text-center text-sm">
                    {avg}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <AddColumnModal classId={classId} open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
