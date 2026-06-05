'use client'

import { useEffect, useState, useTransition } from 'react'
import { getStudentHomeworkProfile } from '@/src/domains/homework/actions'
import type { ClassWeekLoad } from '@/src/domains/homework/lib/week-load'

type ProfileData = Awaited<ReturnType<typeof getStudentHomeworkProfile>>

const STATUS_LABEL: Record<string, string> = {
  yapildi: 'Yapıldı', eksik: 'Eksik', yapilmadi: 'Yapılmadı',
  gec: 'Geç', mazeretli: 'Mazeretli',
}
const STATUS_COLOR: Record<string, string> = {
  yapildi:   'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  eksik:     'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  yapilmadi: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  gec:       'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  mazeretli: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
}

function makeWhatsAppUrl(phone: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^0/, '')
  return `https://wa.me/90${digits}`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return iso }
}

export default function StudentHomeworkProfileModal({
  studentId,
  classId,
  weekLoad = null,
  onClose,
}: {
  studentId: string | null
  classId: string
  weekLoad?: ClassWeekLoad | null
  onClose: () => void
}) {
  const [data, setData] = useState<ProfileData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!studentId) { setData(null); setError(null); return }
    setData(null)
    setError(null)
    startTransition(async () => {
      const result = await getStudentHomeworkProfile(studentId, classId)
      if ('error' in result) setError(result.error)
      else setData(result)
    })
  }, [studentId, classId])

  if (!studentId) return null

  const profile = data && !('error' in data) ? data : null
  const stats = profile?.stats

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">

        {/* Başlık */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100 dark:border-slate-700">
          <div className="min-w-0">
            {profile ? (
              <>
                <p className="font-semibold text-gray-900 dark:text-slate-100 text-base leading-tight">
                  {profile.student.full_name}
                  {profile.student.student_number && (
                    <span className="ml-2 text-xs font-normal text-gray-400 dark:text-slate-500">
                      No: {profile.student.student_number}
                    </span>
                  )}
                </p>
                {weekLoad && weekLoad.count > 0 && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full border ${
                      weekLoad.level === 'danger'
                        ? 'bg-red-100 text-red-600 border-red-200 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800'
                        : weekLoad.level === 'warn'
                          ? 'bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-800'
                          : 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600'
                    }`}>
                      ● {weekLoad.count}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-slate-500">bu hafta ödev</span>
                  </div>
                )}
                {(profile.student.veli_ad || profile.student.veli_telefon) && (
                  <div className="flex items-center gap-2 mt-1">
                    {profile.student.veli_ad && (
                      <span className="text-xs text-gray-500 dark:text-slate-400">
                        Veli: {profile.student.veli_ad}
                      </span>
                    )}
                    {profile.student.veli_telefon && (
                      <a
                        href={makeWhatsAppUrl(profile.student.veli_telefon)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                        WhatsApp
                      </a>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="h-5 w-32 bg-gray-100 dark:bg-slate-700 rounded animate-pulse" />
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* İçerik */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {isPending && !profile && (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2">
                {[0,1,2,3].map(i => (
                  <div key={i} className="h-14 bg-gray-100 dark:bg-slate-800 rounded-xl animate-pulse" />
                ))}
              </div>
              {[0,1,2,3].map(i => (
                <div key={i} className="h-10 bg-gray-100 dark:bg-slate-800 rounded-lg animate-pulse" />
              ))}
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 text-center py-4">{error}</p>
          )}

          {stats && (
            <>
              {/* İstatistik kartları */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'Toplam', value: stats.total, cls: 'text-gray-700 dark:text-slate-300' },
                  { label: 'Yapıldı', value: stats.yapildi, cls: 'text-green-600 dark:text-green-400' },
                  { label: 'Eksik/Yok', value: stats.eksik + stats.yapilmadi + stats.gec, cls: 'text-red-600 dark:text-red-400' },
                  { label: 'Mazeretli', value: stats.mazeretli, cls: 'text-slate-500 dark:text-slate-400' },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3 text-center border border-gray-100 dark:border-slate-700">
                    <p className={`text-2xl font-bold leading-none ${cls}`}>{value}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{label}</p>
                  </div>
                ))}
              </div>

              {/* Tamamlanma oranı */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 dark:text-slate-400">Tamamlanma oranı</span>
                  <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">%{stats.completionRate}</span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all duration-500"
                    style={{ width: `${stats.completionRate}%` }}
                  />
                </div>
              </div>

              {/* Ödev listesi */}
              {profile.homeworks.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-4">
                  Bu sınıfa henüz ödev atanmamış.
                </p>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                    Tüm dönem ödevleri
                  </p>
                  {profile.homeworks.map(hw => (
                    <div
                      key={hw.id}
                      className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[hw.status]}`}>
                        {STATUS_LABEL[hw.status]}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 dark:text-slate-200 truncate">{hw.title}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">{hw.subject}</p>
                      </div>
                      <span className="text-xs text-gray-400 dark:text-slate-500 shrink-0">
                        {formatDate(hw.due_date)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
