'use client'

import { useState, useTransition, useEffect } from 'react'
import { saveExamEntries, fetchClassStudents } from '@/app/actions/zumre'
import { format, parseISO } from '@/lib/date-utils'

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

type Entry = { name: string; grade: string }

function stats(grades: number[]) {
  if (!grades.length) return null
  const avg = Math.round(grades.reduce((s, n) => s + n, 0) / grades.length)
  const min = Math.min(...grades)
  const max = Math.max(...grades)
  const gecen = grades.filter(g => g >= 50).length
  return { avg, min, max, gecen, total: grades.length }
}

function parseInput(raw: string): number[] {
  return raw.split(/[,\s]+/).map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n >= 0 && n <= 100)
}

const lsKey = (id: string) => `exam_entries_${id}`

const selectCls = 'px-2.5 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500'

export default function SinavCard({
  exam,
  onDelete,
  isBaskan,
  classes,
}: {
  exam: Exam
  onDelete: () => void
  isBaskan: boolean
  classes: ClassInfo[]
}) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState((exam.grades ?? []).join(', '))
  const [saved, setSaved] = useState(exam.grades ?? [])
  const [perStudent, setPerStudent] = useState(false)
  const [entries, setEntries] = useState<Entry[]>([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [, startTransition] = useTransition()

  useEffect(() => {
    if (exam.grade_map && exam.grade_map.length > 0) {
      setEntries(exam.grade_map)
      return
    }
    try {
      const stored = localStorage.getItem(lsKey(exam.id))
      if (stored) setEntries(JSON.parse(stored))
    } catch {}
  }, [exam.id, exam.grade_map])

  const loadStudentsForClass = async (classId: string) => {
    if (!classId) return
    setLoadingStudents(true)
    const students = await fetchClassStudents(classId)
    setLoadingStudents(false)
    // Mevcut notları koru: aynı isimde kayıt varsa notunu aktar
    const existingMap = new Map(entries.map(e => [e.name.trim(), e.grade]))
    setEntries(students.map(s => ({
      name: s.full_name,
      grade: existingMap.get(s.full_name.trim()) ?? '',
    })))
  }

  const handleClassChange = async (classId: string) => {
    setSelectedClassId(classId)
    await loadStudentsForClass(classId)
  }

  const switchToPerStudent = () => {
    const nums = parseInput(input)
    if (entries.length === 0 && nums.length > 0) {
      setEntries(nums.map(g => ({ name: '', grade: String(g) })))
    } else if (entries.length === 0) {
      setEntries([{ name: '', grade: '' }])
    }
    setPerStudent(true)
  }

  const switchToTextarea = () => {
    const grades = entries.map(e => parseInt(e.grade)).filter(n => !isNaN(n) && n >= 0 && n <= 100)
    setInput(grades.join(', '))
    setPerStudent(false)
  }

  const updateEntry = (i: number, field: keyof Entry, val: string) => {
    setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: val } : e))
  }

  const addRow = () => setEntries(prev => [...prev, { name: '', grade: '' }])
  const removeRow = (i: number) => setEntries(prev => prev.filter((_, idx) => idx !== i))

  const save = () => {
    if (perStudent) {
      const grades = entries.map(e => parseInt(e.grade)).filter(n => !isNaN(n) && n >= 0 && n <= 100)
      setInput(grades.join(', '))
      try { localStorage.setItem(lsKey(exam.id), JSON.stringify(entries)) } catch {}
      setSaved(grades)
      startTransition(() => { saveExamEntries(exam.id, entries) })
    } else {
      const grades = parseInput(input)
      const simpleEntries = grades.map(g => ({ name: '', grade: String(g) }))
      setSaved(grades)
      startTransition(() => { saveExamEntries(exam.id, simpleEntries) })
    }
  }

  const s = stats(saved)
  let dateStr = ''
  try { dateStr = format(parseISO(exam.exam_date), 'd MMMM yyyy') } catch {}

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 dark:text-slate-100">{exam.title}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{exam.subject} · {dateStr}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {s && (
            <div className="hidden sm:flex items-center gap-3 text-xs text-gray-500 dark:text-slate-400">
              <span className="font-semibold text-blue-600 dark:text-blue-400">Ort: {s.avg}</span>
              <span>{s.gecen}/{s.total} geçti</span>
            </div>
          )}
          <button onClick={() => setOpen(o => !o)} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 transition-colors">
            {open ? 'Kapat' : (saved.length ? 'Notlar' : '+ Not gir')}
          </button>
          {isBaskan && (
            <button onClick={onDelete} className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors">Sil</button>
          )}
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-slate-700 pt-3 space-y-3">
          {/* Mode toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => perStudent ? switchToTextarea() : switchToPerStudent()}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors border ${
                perStudent
                  ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
                  : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'
              }`}
            >
              {perStudent ? '✓ Öğrenci bazlı' : 'Öğrenci bazlı gir'}
            </button>
          </div>

          {perStudent ? (
            <div className="space-y-2">
              {/* Sınıf seç → öğrenciler otomatik yükle */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-slate-400 shrink-0">Sınıf:</span>
                <select
                  value={selectedClassId}
                  onChange={e => handleClassChange(e.target.value)}
                  className={selectCls}
                  disabled={loadingStudents}
                >
                  <option value="">Sınıf seç…</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {loadingStudents && <span className="text-xs text-gray-400">Yükleniyor…</span>}
              </div>

              <div className="text-xs text-gray-500 dark:text-slate-400">Ad Soyad ve not (0–100)</div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {entries.map((e, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <span className="text-xs text-gray-400 w-5 text-right shrink-0">{i + 1}</span>
                    <input
                      value={e.name}
                      onChange={ev => updateEntry(i, 'name', ev.target.value)}
                      placeholder="Ad Soyad"
                      className="flex-1 px-2.5 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                      value={e.grade}
                      onChange={ev => updateEntry(i, 'grade', ev.target.value)}
                      placeholder="Not"
                      type="number"
                      min="0"
                      max="100"
                      className="w-16 px-2.5 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button onClick={() => removeRow(i)} className="text-gray-300 hover:text-red-400 text-xs shrink-0">✕</button>
                  </div>
                ))}
              </div>
              <button onClick={addRow} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">+ Öğrenci ekle</button>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">
                Notları girin (virgülle ya da boşlukla ayrılmış, 0–100)
              </label>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                rows={2}
                placeholder="45, 67, 89, 92, 55, 78..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          )}

          <button onClick={save} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            Kaydet
          </button>

          {s && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {[
                { label: 'Ortalama', value: s.avg },
                { label: 'En yüksek', value: s.max },
                { label: 'En düşük', value: s.min },
                { label: 'Geçen (≥50)', value: `${s.gecen}/${s.total}` },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 dark:bg-slate-700 rounded-lg px-3 py-2 text-center">
                  <p className="text-base font-bold text-gray-900 dark:text-slate-100">{value}</p>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          )}

          {perStudent && entries.some(e => e.name) && (
            <div className="border border-gray-100 dark:border-slate-700 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-slate-700">
                  <tr>
                    <th className="text-left px-3 py-1.5 text-gray-500 dark:text-slate-400 font-medium">Öğrenci</th>
                    <th className="text-right px-3 py-1.5 text-gray-500 dark:text-slate-400 font-medium">Not</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                  {[...entries].sort((a, b) => parseInt(b.grade || '0') - parseInt(a.grade || '0')).map((e, i) => (
                    e.name ? (
                      <tr key={i}>
                        <td className="px-3 py-1.5 text-gray-800 dark:text-slate-200">{e.name}</td>
                        <td className={`px-3 py-1.5 text-right font-semibold ${
                          parseInt(e.grade) >= 85 ? 'text-green-600' :
                          parseInt(e.grade) >= 50 ? 'text-blue-600' : 'text-red-600'
                        }`}>{e.grade}</td>
                      </tr>
                    ) : null
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
