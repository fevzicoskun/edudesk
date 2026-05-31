'use client'

import { useState, useTransition } from 'react'
import Button from '@/components/ui/Button'
import { generateKanaatAction, saveKanaatAction } from '@/app/actions/kanaat'
import type { KanaatNotu, KanaatHesap } from '@/src/domains/kanaat/types'

interface Student {
  id:        string
  full_name: string
}

interface Props {
  classId:         string
  donem:           string
  students:        Student[]
  kanaatKayitlari: KanaatNotu[]
  canWrite:        boolean
}

type Satir = {
  studentId:   string
  studentName: string
  score:       1 | 2 | 3 | 4 | 5
  text:        string
  dirty:       boolean
}

const SCORE_CLASS: Record<number, string> = {
  5: 'text-green-600 font-bold',
  4: 'text-blue-600 font-bold',
  3: 'text-yellow-600 font-bold',
  2: 'text-orange-600 font-bold',
  1: 'text-red-600 font-bold',
}

function kayitlarToSatirlar(kayitlar: KanaatNotu[], students: Student[]): Satir[] {
  return students.map(stu => {
    const k = kayitlar.find(x => x.student_id === stu.id)
    return k
      ? { studentId: stu.id, studentName: stu.full_name, score: k.score as 1|2|3|4|5, text: k.text, dirty: false }
      : { studentId: stu.id, studentName: stu.full_name, score: 3 as const, text: '', dirty: false }
  })
}

export default function KanaatSekmesi({ classId, donem, students, kanaatKayitlari, canWrite }: Props) {
  const [satirlar, setSatirlar] = useState<Satir[]>(() =>
    kayitlarToSatirlar(kanaatKayitlari, students)
  )
  const [error, setError]   = useState<string | null>(null)
  const [toast, setToast]   = useState<string | null>(null)
  const [generated, setGenerated] = useState(kanaatKayitlari.length > 0)
  const [isPending, startTransition] = useTransition()

  const hasDirty = satirlar.some(s => s.dirty)

  function handleGenerate() {
    if (generated && !confirm('Mevcut hesaplama üzerine yeniden oluşturulsun mu?')) return
    setError(null)
    startTransition(async () => {
      const result = await generateKanaatAction(classId, donem)
      if (result.error) { setError(result.error); return }
      const hesaplar = result.data as KanaatHesap[]
      setSatirlar(
        students.map(stu => {
          const h = hesaplar.find(x => x.studentId === stu.id)
          return h
            ? { studentId: stu.id, studentName: stu.full_name, score: h.score, text: h.text, dirty: true }
            : { studentId: stu.id, studentName: stu.full_name, score: 3 as const, text: '', dirty: false }
        })
      )
      setGenerated(true)
    })
  }

  function handleTextChange(studentId: string, text: string) {
    setSatirlar(prev => prev.map(s =>
      s.studentId === studentId ? { ...s, text, dirty: true } : s
    ))
  }

  function handleScoreChange(studentId: string, score: number) {
    setSatirlar(prev => prev.map(s =>
      s.studentId === studentId ? { ...s, score: score as 1|2|3|4|5, dirty: true } : s
    ))
  }

  function handleSave() {
    setError(null)
    const dirtySatirlar = satirlar.filter(s => s.dirty && s.text.trim())
    if (!dirtySatirlar.length) return

    startTransition(async () => {
      const result = await saveKanaatAction({
        classId,
        donem,
        kayitlar: dirtySatirlar.map(s => ({
          studentId: s.studentId,
          score:     s.score,
          text:      s.text.trim(),
        })),
      })
      if (result.error) { setError(result.error); return }
      setSatirlar(prev => prev.map(s => ({ ...s, dirty: false })))
      setToast(`${dirtySatirlar.length} kayıt kaydedildi.`)
      setTimeout(() => setToast(null), 3000)
    })
  }

  if (students.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Bu sınıfa öğrenci eklenmemiş.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-4 font-bold">×</button>
        </div>
      )}
      {toast && (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Kanaat Notları — {donem}</h2>
        {canWrite && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleGenerate}
              disabled={isPending}
            >
              {isPending ? 'Hesaplanıyor…' : generated ? 'Yeniden Oluştur' : 'Dönem Değerlendirmesi Oluştur'}
            </Button>
            {hasDirty && (
              <Button
                size="sm"
                variant="primary"
                onClick={handleSave}
                disabled={isPending}
              >
                Tümünü Kaydet
              </Button>
            )}
          </div>
        )}
      </div>

      {!generated ? (
        <div className="py-12 text-center text-muted-foreground border rounded-lg">
          Dönem değerlendirmesi henüz oluşturulmadı.
          {canWrite && (
            <p className="mt-2 text-sm">Yukarıdaki butona basarak otomatik hesaplatabilirsiniz.</p>
          )}
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50 text-sm font-medium text-muted-foreground border-b">
                <th className="text-left px-4 py-3 min-w-[160px]">Öğrenci</th>
                <th className="text-center px-4 py-3 w-20">Skor</th>
                <th className="text-left px-4 py-3">Metin</th>
              </tr>
            </thead>
            <tbody>
              {satirlar.map(satir => (
                <tr key={satir.studentId} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium text-sm">{satir.studentName}</td>
                  <td className="px-4 py-3 text-center">
                    {canWrite ? (
                      <select
                        value={satir.score}
                        onChange={e => handleScoreChange(satir.studentId, Number(e.target.value))}
                        className={`rounded border px-2 py-1 text-sm bg-background ${SCORE_CLASS[satir.score] ?? ''}`}
                      >
                        {[1, 2, 3, 4, 5].map(v => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={SCORE_CLASS[satir.score] ?? ''}>{satir.score}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canWrite ? (
                      <textarea
                        value={satir.text}
                        onChange={e => handleTextChange(satir.studentId, e.target.value)}
                        rows={2}
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                        placeholder="Kanaat metni…"
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground">{satir.text || '—'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
