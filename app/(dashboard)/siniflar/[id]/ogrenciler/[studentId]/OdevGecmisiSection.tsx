import Link from 'next/link'
import { format, parseISO } from '@/src/shared/date'
import type { SubmissionStatus } from '@/src/shared/types'
import { dersAnahtari, dersOzeti, dersOzetiMetni, derseGore, type HomeworkRecord } from '@/src/domains/homework/lib/stats'
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
const BEKLIYOR = 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-800'
const KONTROL_EDILMEDI = 'bg-white text-gray-500 border-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600'
const SATIR = 'border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 flex items-center justify-between gap-3'

/** ders: ?ders= adres parametresi — liste o derse süzülür (satırdaki ders adına tıklanınca). Özet kağıdı süzülmez. */
export default function OdevGecmisiSection({ odevler, raporHref, sayfaHref, ders }: {
  odevler: Odev[]; raporHref: string; sayfaHref: string; ders: string | null
}) {
  const dersler = dersOzeti(odevler)
  const secili = ders ? dersler.find(d => dersAnahtari(d.ders) === dersAnahtari(ders)) ?? null : null
  const liste = derseGore(odevler, secili?.ders ?? null)
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
          <nav aria-label="Derslere göre" className="text-xs text-gray-600 dark:text-slate-300 mb-3 pb-3 border-b border-gray-100 dark:border-slate-700">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-gray-500 dark:text-slate-400">Derslere göre (yapılan / kontrol edilen)</p>
              {secili && (
                <Link href={sayfaHref} scroll={false} className="inline-block py-1 text-blue-600 dark:text-blue-400 hover:underline shrink-0">
                  Tümünü göster
                </Link>
              )}
            </div>
            <p className="leading-relaxed">
              {dersler.map((d, i) => {
                const aktif = secili?.ders === d.ders
                return (
                  <span key={d.ders} className="whitespace-nowrap">
                    {i > 0 && <span className="text-gray-300 dark:text-slate-600" aria-hidden="true"> · </span>}
                    <Link
                      href={aktif ? sayfaHref : `${sayfaHref}?ders=${encodeURIComponent(d.ders)}`}
                      scroll={false}
                      aria-current={aktif ? 'true' : undefined}
                      title={aktif ? 'Süzmeyi kaldır' : `Yalnız ${d.ders} ödevlerini göster`}
                      // inline-block + py-1: telefonda ≥24px dokunma hedefi (WCAG 2.5.8); noktalı alt çizgi = tıklanabilir işareti
                      className={`inline-block py-1 underline underline-offset-2 ${aktif
                        ? 'font-semibold text-blue-700 dark:text-blue-300'
                        : 'decoration-dotted decoration-gray-400 dark:decoration-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:decoration-solid'}`}
                    >
                      {dersOzetiMetni(d)}
                    </Link>
                  </span>
                )
              })}
            </p>
          </nav>
          <div className="space-y-2 max-h-[28rem] overflow-y-auto">
            {liste.map((h) => {
              const icerik = (<>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{h.title}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    {h.subject || '—'} · {h.due_date ? format(parseISO(h.due_date), 'd MMM yyyy') : 'Tarih yok'}
                  </p>
                </div>
                <span className={`border rounded-full px-2.5 py-1 text-xs font-semibold shrink-0 ${h.status ? BADGE[h.status] : h.bekliyor ? BEKLIYOR : KONTROL_EDILMEDI}`}>
                  {h.status ? LABELS[h.status] : h.bekliyor ? 'Bekliyor' : 'Kontrol edilmedi'}
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
