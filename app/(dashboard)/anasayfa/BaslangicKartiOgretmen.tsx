import Link from 'next/link'
import type { SetupStep } from '@/src/domains/onboarding/setupMath'

// Öğretmen Başlangıç kartı: 4 adımlı ✓/○ kurulum listesi.
// Görünürlük SetupService'te: 30 gün içinde VE en az bir adım eksik.
export default function BaslangicKartiOgretmen({ steps }: { steps: SetupStep[] }) {
  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5 mb-4">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Başlangıç</h2>
      <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 mb-3">
        EduDesk&apos;i tanımak için şu adımları tamamla.
      </p>
      <ol className="space-y-1.5">
        {steps.map(s => (
          <li key={s.key}>
            <Link
              href={s.href}
              className="flex items-center gap-3 rounded-lg px-2 py-2 -mx-2 hover:bg-gray-50 dark:hover:bg-slate-700/60 transition-colors"
            >
              {s.done ? (
                <span aria-hidden className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0">✓</span>
              ) : (
                <span aria-hidden className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-slate-500 shrink-0" />
              )}
              <span className={`text-sm ${s.done
                ? 'text-gray-500 dark:text-slate-400 line-through'
                : 'text-gray-900 dark:text-slate-100 font-medium'}`}>
                {s.title}
              </span>
              <span className="sr-only">{s.done ? '(tamamlandı)' : '(bekliyor)'}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}
