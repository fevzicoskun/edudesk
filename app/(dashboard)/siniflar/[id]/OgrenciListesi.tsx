'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton'
import { deleteStudent } from '@/src/domains/classes/actions'

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
}

function waLink(telefon: string): string {
  const digits = telefon.replace(/\D/g, '')
  if (digits.startsWith('90')) return `https://wa.me/${digits}`
  if (digits.startsWith('0')) return `https://wa.me/9${digits}`
  if (digits.startsWith('5')) return `https://wa.me/90${digits}`
  return `https://wa.me/${digits}`
}

export default function OgrenciListesi({ students, classId, canDelete }: Props) {
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
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            placeholder="Ad veya numara ara..."
            value={q}
            onChange={e => setQ(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-center py-8 text-gray-400 text-sm">Sonuç bulunamadı.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((s, i) => (
            <div
              key={s.id}
              className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 flex items-center gap-3"
            >
              <span className="text-xs text-gray-400 w-6 text-right shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <Link
                  href={`/siniflar/${classId}/ogrenciler/${s.id}`}
                  className="text-sm font-medium text-gray-900 dark:text-slate-100 hover:text-blue-700 dark:hover:text-blue-400"
                >
                  {s.full_name}
                </Link>
                {s.student_number && (
                  <p className="text-xs text-gray-400">No: {s.student_number}</p>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {s.veli_email && (
                  <a
                    href={`mailto:${s.veli_email}`}
                    title={s.veli_email}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
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
                    className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950 transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.121 1.532 5.849L.057 23.928l6.235-1.637A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.002-1.368l-.36-.214-3.7.971.989-3.612-.235-.372A9.818 9.818 0 1112 21.818z"/>
                    </svg>
                  </a>
                )}
                {canDelete && (
                  <ConfirmDeleteButton
                    action={deleteStudent.bind(null, s.id, classId)}
                    message={`"${s.full_name}" adlı öğrenciyi ve tüm ödev kayıtlarını silmek istediğine emin misin?`}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
