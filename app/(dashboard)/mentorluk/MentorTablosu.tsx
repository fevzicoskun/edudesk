import Link from 'next/link'
import { dersOzetiMetni } from '@/src/domains/homework/lib/stats'
import type { MentorTablo } from '@/src/domains/mentor/lib/mentorTablosu'

/** Öğrenci × ders. Renk yalnız rakamda (kırmızı = geride). Telefonda satır + ders metni. */
type GecenHafta = { program: number | null; dogruluk: number | null } | null
const yuzde = (ad: string, n: number | null) => n === null ? null
  : <span className={n < 50 ? 'text-red-700 dark:text-red-400 font-semibold' : ''}>{ad} %{n}</span>
function Gecen({ g }: { g: GecenHafta }) {
  if (!g) return <span className="text-gray-500 dark:text-slate-400">—</span>
  return <>{yuzde('Program', g.program)}{g.dogruluk !== null && <> · {yuzde('Doğruluk', g.dogruluk)}</>}</>
}

export default function MentorTablosu({ tablo, bas, baglanti = true, takip, gecen }: {
  tablo: MentorTablo; bas: string; baglanti?: boolean
  /** Haftalık takip açıksa öğrenci → bu haftanın durumu */
  takip?: Record<string, string>
  /** Haftalık takip açıksa öğrenci → geçen haftanın program/doğruluk yüzdesi (%50 altı kırmızı) */
  gecen?: Record<string, GecenHafta>
}) {
  const ad = (id: string, full: string) => baglanti
    ? <Link href={`/mentorluk/${id}?bas=${bas}`} className="font-medium text-gray-900 dark:text-slate-100 hover:text-blue-600">{full}</Link>
    : <span className="font-medium">{full}</span>

  return (
    <>
      <div className="hidden md:block print:block overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-300 dark:border-slate-600 text-left text-xs text-gray-500 dark:text-slate-400 print:text-gray-700">
              <th className="py-2 pr-3 font-semibold">Öğrenci</th>
              <th className="py-2 pr-3 font-semibold">Sınıf</th>
              {tablo.dersler.map(d => <th key={d} className="py-2 px-2 font-semibold text-center">{d}</th>)}
              {takip && <th className="py-2 px-2 font-semibold">Bu hafta</th>}
              {gecen && <th className="py-2 px-2 font-semibold">Geçen hafta</th>}
            </tr>
          </thead>
          <tbody>
            {tablo.satirlar.map(s => (
              <tr key={s.id} className="border-b border-gray-100 dark:border-slate-700 break-inside-avoid">
                <td className="py-2 pr-3">{ad(s.id, s.full_name)}</td>
                <td className="py-2 pr-3 text-gray-600 dark:text-slate-400">{s.class_name ?? '—'}</td>
                {s.hucreler.map((h, i) => (
                  <td key={tablo.dersler[i]} className={`py-2 px-2 text-center tabular-nums ${h.kirmizi ? 'text-red-700 dark:text-red-400 font-semibold' : 'text-gray-800 dark:text-slate-200'}`}>{h.metin}</td>
                ))}
                {takip && <td className="py-2 px-2 whitespace-nowrap">{takip[s.id]}</td>}
                {gecen && <td className="py-2 px-2 whitespace-nowrap text-xs">{<Gecen g={gecen[s.id] ?? null} />}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="md:hidden print:hidden space-y-2">
        {tablo.satirlar.map(s => (
          <li key={s.id} className="p-3 rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800">
            <span>{ad(s.id, s.full_name)} <span className="text-xs text-gray-500 dark:text-slate-400">· {s.class_name ?? '—'}</span></span>
            {takip && <p className="text-xs mt-0.5">Bu hafta: {takip[s.id]}</p>}
            {gecen && <p className="text-xs mt-0.5">Geçen hafta: <Gecen g={gecen[s.id] ?? null} /></p>}
            <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-gray-700 dark:text-slate-300">
              {s.dersler.length === 0 ? 'Bu aralıkta ödev yok' : s.dersler.map(d => <span key={d.ders}>{dersOzetiMetni(d)}</span>)}
            </p>
          </li>
        ))}
      </ul>
    </>
  )
}
