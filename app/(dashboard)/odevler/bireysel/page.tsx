import Link from 'next/link'
import { redirect } from 'next/navigation'
import { todayLocalISO } from '@/src/shared/date'
import { BireyselOdevService } from '@/src/domains/bireyselOdev/services/BireyselOdevService'
import { filtrele, gecikmisMi, listeSirala, type Filtre } from '@/src/domains/bireyselOdev/lib/liste'
import BireyselOdevSatiri from '@/components/bireyselOdev/BireyselOdevSatiri'

export const metadata = { title: 'Verdiğim Bireysel Ödevler' }

const sekme = (aktif: boolean) => `min-h-11 inline-flex items-center px-4 rounded-lg text-sm font-medium border ${aktif
  ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700'}`

/** Öğretmenin verdiği bütün bireysel ödevler (spec 2026-10-24): gecikmişler kırmızı ve üstte; Bekleyenler (varsayılan) / Tümü. */
export default async function BireyselOdevlerPage({ searchParams }: { searchParams: Promise<{ filtre?: string }> }) {
  const liste = await BireyselOdevService.liste()
  if (liste === null) redirect('/anasayfa')
  const filtre: Filtre = (await searchParams).filtre === 'tumu' ? 'tumu' : 'bekleyen'
  const bugun = todayLocalISO()
  const gosterilen = listeSirala(filtrele(liste, filtre), bugun)
  const gecikmis = liste.filter(o => gecikmisMi(o, bugun)).length
  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Verdiğim Bireysel Ödevler</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Öğrencilere tek tek verdiğin ödevler. Yeni ödevi öğrencinin sayfasından eklersin (üstteki aramadan öğrenciyi bul).
        </p>
      </div>
      <nav aria-label="Filtre" className="flex flex-wrap items-center gap-2">
        <Link href="/odevler/bireysel" aria-current={filtre === 'bekleyen' ? 'page' : undefined} className={sekme(filtre === 'bekleyen')}>Bekleyenler</Link>
        <Link href="/odevler/bireysel?filtre=tumu" aria-current={filtre === 'tumu' ? 'page' : undefined} className={sekme(filtre === 'tumu')}>Tümü</Link>
        {gecikmis > 0 && <span className="text-sm font-semibold text-red-700 dark:text-red-300">{gecikmis} gecikmiş</span>}
      </nav>
      {gosterilen.length === 0
        ? <p className="text-sm text-gray-500 dark:text-slate-400 py-8 text-center">{filtre === 'bekleyen' ? 'Bekleyen bireysel ödev yok.' : 'Henüz bireysel ödev vermedin.'}</p>
        : <ul aria-label="Bireysel ödevler" className="space-y-2">{gosterilen.map(o => <BireyselOdevSatiri key={o.id} odev={o} bugun={bugun} ogrenciBaglantisi />)}</ul>}
    </div>
  )
}
