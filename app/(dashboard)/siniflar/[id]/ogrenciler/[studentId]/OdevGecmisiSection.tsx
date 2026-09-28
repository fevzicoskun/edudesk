import Link from 'next/link'
import { format, parseISO } from '@/src/shared/date'
import type { SubmissionStatus } from '@/src/shared/types'
import { dersOzeti, dersOzetiMetni, type HomeworkRecord } from '@/src/domains/homework/lib/stats'
import { LABELS } from '@/app/(dashboard)/odevler/[id]/statusboard/types'

/** acilabilir: ödev görüntüleyenin kapsamında mı — değilse satır salt okunur (başka öğretmenin ödevi). */
type Odev = HomeworkRecord & { acilabilir: boolean }

const BADGE: Record<SubmissionStatus, string> = {
  yapildi:   'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  eksik:     'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800',
  yapilmadi: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  gec:       'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
  mazeretli: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600',
}
const KONTROL_EDILMEDI = 'bg-white text-gray-500 border-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600'
const SATIR = 'border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 flex items-center justify-between gap-3'

export default function OdevGecmisiSection({ odevler, raporHref }: { odevler: Odev[]; raporHref: string }) {
  const dersler = dersOzeti(odevler)
  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Ödev Geçmişi</h2>
        <Link href={raporHref} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
          Özeti yazdır →
        </Link>
      </div>
      {odevler.length === 0 ? (
        <p className="text-center text-gray-500 dark:text-slate-400 text-sm py-10">Henüz ödev kaydı yok.</p>
      ) : (
        <>
          {/* Ders bazlı: yapılan / değerlendirilen (mazeretli ve kontrol edilmemiş hariç) — tamamlama oranıyla aynı tanım */}
          <div aria-label="Derslere göre" className="text-xs text-gray-600 dark:text-slate-300 mb-3 pb-3 border-b border-gray-100 dark:border-slate-700">
            <p className="text-gray-500 dark:text-slate-400 mb-1">Derslere göre (yapılan / kontrol edilen)</p>
            <p className="leading-relaxed">
              {dersler.map((d, i) => (
                <span key={d.ders} className="whitespace-nowrap">
                  {i > 0 && <span className="text-gray-300 dark:text-slate-600" aria-hidden="true"> · </span>}
                  {dersOzetiMetni(d)}
                </span>
              ))}
            </p>
          </div>
          <div className="space-y-2 max-h-[28rem] overflow-y-auto">
            {odevler.map((h) => {
              const icerik = (<>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{h.title}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    {h.subject || '—'} · {h.due_date ? format(parseISO(h.due_date), 'd MMM yyyy') : 'Tarih yok'}
                  </p>
                </div>
                <span className={`border rounded-full px-2.5 py-1 text-xs font-semibold shrink-0 ${h.status ? BADGE[h.status] : KONTROL_EDILMEDI}`}>
                  {h.status ? LABELS[h.status] : 'Kontrol edilmedi'}
                </span>
              </>)
              return h.acilabilir ? (
                <Link key={h.id} href={`/odevler/${h.id}`} className={`${SATIR} hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors`}>
                  {icerik}
                </Link>
              ) : (
                <div key={h.id} className={SATIR}>{icerik}</div>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}
