'use client'

import { useState, useCallback, useRef, useTransition } from 'react'
import Button from '@/components/ui/Button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableFooter,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
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

const GRADE_TYPE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  yazili: 'default',
  quiz:   'secondary',
  proje:  'outline',
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
  const [actionError, setActionError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const saveScore = useCallback((columnId: string, studentId: string, value: string) => {
    const score = value === '' ? null : Number(value)
    if (value !== '' && isNaN(score!)) return

    startTransition(async () => {
      const result = await upsertScoreAction({ columnId, classId, studentId, score })
      if (result?.error) setActionError(result.error)
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
      const result = await deleteColumnAction(columnId, classId)
      if (result?.error) setActionError(result.error)
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
      {actionError && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="ml-4 text-red-500 hover:text-red-700 font-bold">×</button>
        </div>
      )}

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

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="sticky left-0 z-10 bg-muted/80 min-w-[180px]">
                Öğrenci
              </TableHead>
              {columns.map(col => (
                <TableHead key={col.id} className="text-center min-w-[120px]">
                  <div className="flex flex-col items-center gap-1">
                    <Badge variant={GRADE_TYPE_VARIANT[col.grade_type] ?? 'secondary'}>
                      {GRADE_TYPE_LABEL[col.grade_type] ?? col.grade_type}
                    </Badge>
                    <span className="font-semibold text-foreground">{col.title}</span>
                    {col.exam_date && (
                      <span className="text-xs text-muted-foreground font-normal">{col.exam_date}</span>
                    )}
                    <span className="text-xs text-muted-foreground font-normal">/{col.max_score}</span>
                    {canWrite && (
                      <button
                        type="button"
                        title="Sütunu Sil"
                        className="text-xs text-destructive hover:text-destructive/80 mt-0.5"
                        onClick={() => handleDeleteColumn(col.id)}
                      >
                        Sil
                      </button>
                    )}
                  </div>
                </TableHead>
              ))}
              {columns.length === 0 && (
                <TableHead className="text-muted-foreground italic font-normal">
                  Henüz ölçme eklenmedi
                </TableHead>
              )}
            </TableRow>
          </TableHeader>

          <TableBody>
            {students.map((student, stuIdx) => (
              <TableRow key={student.id}>
                <TableCell className="sticky left-0 z-10 bg-background font-medium">
                  {student.full_name}
                </TableCell>
                {columns.map((col, colIdx) => (
                  <TableCell key={col.id} className="text-center">
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
                        className="w-20 rounded-md border bg-background px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="—"
                      />
                    ) : (
                      <span className="text-muted-foreground">
                        {scores[col.id]?.[student.id] || '—'}
                      </span>
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {students.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="py-8 text-center text-muted-foreground"
                >
                  Bu sınıfa öğrenci eklenmemiş.
                </TableCell>
              </TableRow>
            )}
          </TableBody>

          {columns.length > 0 && students.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell className="sticky left-0 z-10 bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                  Sınıf ort.
                </TableCell>
                {columnAverages.map((avg, i) => (
                  <TableCell key={columns[i]!.id} className="text-center text-sm font-medium">
                    {avg}
                  </TableCell>
                ))}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      <AddColumnModal classId={classId} open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
