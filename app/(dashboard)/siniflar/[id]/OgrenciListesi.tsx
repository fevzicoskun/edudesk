'use client'

import { useState, useActionState } from 'react'
import Link from 'next/link'
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton'
import { deleteStudent, updateVeliContact } from '@/src/domains/classes/actions'

interface Student {
  id: string
  full_name: string
  student_number: string | null
  veli_email: string | null
  veli_telefon: string | null
}

interface Props {
  students: Student[]
  classId: string
  canDelete: boolean
  absenceCounts: Record<string, number>
  warnDays: number
  limitDays: number
}

function waLink(telefon: string): string {
  const digits = telefon.replace(/\D/g, '')
  if (digits.startsWith('90')) return `https://wa.me/${digits}`
  if (digits.startsWith('0')) return `https://wa.me/9${digits}`
  if (digits.startsWith('5')) return `https://wa.me/90${digits}`
  return `https://wa.me/${digits}`
}

function OgrenciSatiri({
  s, classId, canDelete, index, absenceCount, warnDays, limitDays,
}: {
  s: Student; classId: string; canDelete: boolean; index: number
  absenceCount: number; warnDays: number; limitDays: number
}) {
  const [open, setOpen] = useState(false)

  const [state, action, pending] = useActionState(
    async (_: null | { ok: boolean; error?: string }, formData: FormData) => {
      const result = await updateVeliContact(s.id, classId, formData)
      if (result.error) return { ok: false, error: result.error }
      setOpen(false)
      return { ok: true }
    },
    null
  )

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
      {/* Ana satır */}
      <div className="px-4 py-3 flex items-center gap-3">
        <span className="text-xs text-gray-400 w-6 text-right shrink-0">{index + 1}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/siniflar/${classId}/ogrenciler/${s.id}`}
              className="text-sm font-medium text-gray-900 dark:text-slate-100 hover:text-blue-700 dark:hover:text-blue-400"
            >
              {s.full_name}
            </Link>
            {absenceCount > 0 && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                absenceCount >= limitDays
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                  : absenceCount >= warnDays
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                  : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
              }`}>
                {absenceCount % 1 === 0 ? `${absenceCount}g` : `${absenceCount.toFixed(1)}g`}
              </span>
            )}
          </div>
          {s.student_number && (
            <p className="text-xs text-gray-400">No: {s.student_number}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {s.veli_email && (
            <a
              href={`mailto:${s.veli_email}`}
              title={s.veli_email}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </a>
          )}
          {s.veli_telefon && (
            <a
              href={waLink(s.veli_telefon)}
              target="_blank"
              rel="noopener noreferrer"
              title={`WhatsApp: ${s.veli_telefon}`}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.121 1.532 5.849L.057 23.928l6.235-1.637A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.002-1.368l-.36-.214-3.7.971.989-3.612-.235-.372A9.818 9.818 0 1112 21.818z"/>
              </svg>
            </a>
          )}

          {/* Veli iletişim düzenle */}
          <button
            onClick={() => setOpen(v => !v)}
            title="Veli iletişim bilgisi"
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
              open
                ? 'text-blue-600 bg-blue-50 dark:bg-blue-950'
                : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>

          {canDelete && (
            <ConfirmDeleteButton
              action={deleteStudent.bind(null, s.id, classId)}
              message={`"${s.full_name}" adlı öğrenciyi ve tüm ödev kayıtlarını silmek istediğine emin misin?`}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors text-xs font-medium"
            />
          )}
        </div>
      </div>

      {/* Inline edit paneli */}
      {open && (
        <div className="border-t border-gray-100 dark:border-slate-700 px-4 py-3 bg-gray-50 dark:bg-slate-900/50">
          <form action={action} className="flex flex-wrap gap-2 items-end">
            <div className="flex flex-col gap-1 flex-1 min-w-36">
              <label className="text-xs text-gray-500 dark:text-slate-400">E-posta</label>
              <input
                name="veli_email"
                type="email"
                defaultValue={s.veli_email ?? ''}
                placeholder="veli@ornek.com"
                className="px-2.5 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-base bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-36">
              <label className="text-xs text-gray-500 dark:text-slate-400">WhatsApp</label>
              <input
                name="veli_telefon"
                type="tel"
                defaultValue={s.veli_telefon ?? ''}
                placeholder="905XX000000"
                className="px-2.5 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-base bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
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
              {state?.ok && (
                <span className="text-xs text-green-600 dark:text-green-400">Kaydedildi</span>
              )}
              {state?.error && (
                <span className="text-xs text-red-600 dark:text-red-400">{state.error}</span>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default function OgrenciListesi({ students, classId, canDelete, absenceCounts, warnDays, limitDays }: Props) {
  const [q, setQ] = useState('')

  const filtered = q.trim()
    ? students.filter(
        s =>
          s.full_name.toLowerCase().includes(q.toLowerCase()) ||
          (s.student_number ?? '').includes(q.trim())
      )
    : students

  return (
    <div>
      {students.length > 5 && (
        <div className="relative mb-4">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            placeholder="Ad veya numara ara..."
            value={q}
            onChange={e => setQ(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-base bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-center py-8 text-gray-400 text-sm">Sonuç bulunamadı.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((s, i) => (
            <OgrenciSatiri
              key={s.id}
              s={s}
              classId={classId}
              canDelete={canDelete}
              index={i}
              absenceCount={absenceCounts[s.id] ?? 0}
              warnDays={warnDays}
              limitDays={limitDays}
            />
          ))}
        </div>
      )}
    </div>
  )
}
