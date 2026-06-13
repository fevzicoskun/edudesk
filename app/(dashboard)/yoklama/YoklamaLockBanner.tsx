'use client'

import { YOKLAMA_LOCK_HOUR, YOKLAMA_LOCK_MINUTE } from '@/src/shared/constants/attendance'

type LockStatus = 'open' | 'time_locked' | 'date_locked'

export default function YoklamaLockBanner({
  weekend, isPastDate, isLocked, lockStatus, isTodayWeekend, date, today, missingClassNames,
}: {
  weekend: boolean
  isPastDate: boolean
  isLocked: boolean
  lockStatus: LockStatus
  isTodayWeekend: boolean
  date: string
  today: string
  missingClassNames: string[]
}) {
  return (
    <>
      {weekend && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-800 dark:text-amber-300">
          <span>⚠️</span>
          <span>Seçilen tarih hafta sonuna denk geliyor. Yoklama alınamaz.</span>
        </div>
      )}

      {isPastDate && !weekend && !isLocked && (
        <div className="flex items-center gap-2 px-4 py-3 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-xl text-sm text-sky-800 dark:text-sky-300">
          <span>📅</span>
          <span>Geçmiş bir tarih için yoklama giriyorsunuz. Mevcut kayıtların üzerine yazılacak.</span>
        </div>
      )}

      {isLocked && !weekend && (
        <div className="flex items-center gap-2 px-4 py-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl text-sm text-orange-800 dark:text-orange-300">
          <span>🔒</span>
          <span>
            {lockStatus === 'time_locked'
              ? `Yoklama düzenleme saati doldu (${YOKLAMA_LOCK_HOUR}:${String(YOKLAMA_LOCK_MINUTE).padStart(2, '0')}). Müdür yardımcısına başvurun.`
              : 'Geçmiş tarih yoklaması düzenlenemez. Müdür yardımcısına başvurun.'}
          </span>
        </div>
      )}

      {!isTodayWeekend && date === today && missingClassNames.length > 0 && (
        <div className="mb-4 flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-sm px-4 py-3 rounded-xl">
          <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
          </svg>
          <span>Bugün yoklama alınmadı: <strong>{missingClassNames.join(', ')}</strong></span>
        </div>
      )}
    </>
  )
}
