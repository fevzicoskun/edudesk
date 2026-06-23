'use client'

import { useState, useTransition, useActionState } from 'react'
import { format, parseISO } from '@/src/shared/date'
import { addParentContactLog, deleteParentContactLog } from '@/app/actions/classes'
import type { ActionResult } from '@/src/shared/types'

const METHOD_LABELS: Record<string, string> = {
  email:     'E-posta',
  telefon:   'Telefon',
  whatsapp:  'WhatsApp',
  yuz_yuze:  'Yüz Yüze',
  diger:     'Diğer',
}
const METHOD_COLORS: Record<string, string> = {
  email:     'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  telefon:   'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  whatsapp:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  yuz_yuze:  'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  diger:     'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400',
}

type LogEntry = {
  id: string
  note: string
  contact_method: string
  contacted_at: string
  teacher_id: string
}

function todayISO() {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())
}

function AddLogForm({ studentId, classId }: { studentId: string; classId: string }) {
  const [open, setOpen] = useState(false)

  const [state, action, pending] = useActionState(
    async (_: ActionResult | null, formData: FormData): Promise<ActionResult> => {
      const result = await addParentContactLog(studentId, classId, formData)
      if (!result.error) setOpen(false)
      return result ?? {}
    },
    null,
  )

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
      >
        + Yeni İletişim Kaydı
      </button>
    )
  }

  return (
    <form action={action} className="border border-gray-200 dark:border-slate-700 rounded-xl p-4 bg-gray-50 dark:bg-slate-900/50 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">Yöntem</label>
          <select
            name="contact_method"
            defaultValue="telefon"
            className="px-2.5 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="telefon">Telefon</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">E-posta</option>
            <option value="yuz_yuze">Yüz Yüze</option>
            <option value="diger">Diğer</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">Tarih</label>
          <input
            name="contacted_at"
            type="date"
            defaultValue={todayISO()}
            max={todayISO()}
            className="px-2.5 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 dark:text-slate-400">Not (zorunlu)</label>
        <textarea
          name="note"
          required
          maxLength={500}
          placeholder="Ne görüşüldü?"
          className="w-full min-h-20 px-2.5 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
        />
      </div>
      {state?.error && (
        <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {pending ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-3 py-1.5 text-gray-500 dark:text-slate-400 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
        >
          İptal
        </button>
      </div>
    </form>
  )
}

export default function ParentContactLogSection({
  logs,
  studentId,
  classId,
  currentUserId,
}: {
  logs: LogEntry[]
  studentId: string
  classId: string
  currentUserId: string
}) {
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function handleDelete(logId: string) {
    if (!confirm('Bu kayıt silinecek. Emin misiniz?')) return
    setDeletingId(logId)
    startTransition(async () => {
      await deleteParentContactLog(logId, studentId, classId)
      setDeletingId(null)
    })
  }

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Veli İletişim Günlüğü</h2>
        <AddLogForm studentId={studentId} classId={classId} />
      </div>

      {logs.length === 0 ? (
        <p className="text-center text-gray-500 dark:text-slate-400 text-sm py-6">Henüz kayıt yok.</p>
      ) : (
        <div className="space-y-2">
          {logs.map(log => (
            <div key={log.id} className="border border-gray-100 dark:border-slate-700 rounded-lg px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${METHOD_COLORS[log.contact_method] ?? METHOD_COLORS.diger}`}>
                    {METHOD_LABELS[log.contact_method] ?? log.contact_method}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-slate-400">
                    {format(parseISO(log.contacted_at), 'd MMM yyyy')}
                  </span>
                  {log.teacher_id === currentUserId && (
                    <span className="text-[10px] text-gray-500 dark:text-slate-400">Sen</span>
                  )}
                </div>
                {log.teacher_id === currentUserId && (
                  <button
                    onClick={() => handleDelete(log.id)}
                    disabled={isPending && deletingId === log.id}
                    className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40 shrink-0"
                  >
                    Sil
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-700 dark:text-slate-300 mt-1.5 whitespace-pre-wrap">{log.note}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
