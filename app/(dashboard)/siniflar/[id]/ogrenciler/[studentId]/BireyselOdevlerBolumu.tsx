import { BireyselOdevService } from '@/src/domains/bireyselOdev/services/BireyselOdevService'
import { todayLocalISO } from '@/src/shared/date'
import BireyselOdevEkleForm from '@/components/bireyselOdev/BireyselOdevEkleForm'
import BireyselOdevSatiri from '@/components/bireyselOdev/BireyselOdevSatiri'

/** Öğrenci sayfasında bireysel ödevler (spec 2026-10-24): bu öğretmenin bu öğrenciye verdikleri, yeniden eskiye.
 *  Öğretmen rolü değilse hiç görünmez. */
export default async function BireyselOdevlerBolumu({ ogrenciId }: { ogrenciId: string }) {
  const liste = await BireyselOdevService.ogrenciListesi(ogrenciId)
  if (liste === null) return null
  const bugun = todayLocalISO()
  return (
    <section aria-label="Bireysel ödevler" className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 mb-5 space-y-3">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Bireysel Ödevler <span className="font-normal text-gray-500 dark:text-slate-400">(yalnız senin verdiklerin)</span></h2>
      <BireyselOdevEkleForm ogrenciId={ogrenciId} />
      {liste.length === 0
        ? <p className="text-sm text-gray-500 dark:text-slate-400">Bu öğrenciye henüz bireysel ödev vermedin.</p>
        : <ul className="space-y-2">{liste.map(o => <BireyselOdevSatiri key={o.id} odev={o} bugun={bugun} />)}</ul>}
    </section>
  )
}
