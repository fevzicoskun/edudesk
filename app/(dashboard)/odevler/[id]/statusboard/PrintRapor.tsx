import { yapmayanlar } from '@/src/domains/homework/lib/odev-rapor'
import type { RaporSatiri, OzetKalemi } from '@/src/domains/homework/lib/odev-rapor'

type Props = {
  okulAdi: string
  odevBasligi: string
  sinif: string
  ders: string
  sonTeslim: string
  ogretmenAdi: string
  satirlar: RaporSatiri[]
  ozet: OzetKalemi[]
}

/** Yalnızca yazdırmada görünür; ekranda hiç yer kaplamaz. */
export default function PrintRapor({
  okulAdi, odevBasligi, sinif, ders, sonTeslim, ogretmenAdi, satirlar, ozet,
}: Props) {
  const eksikler = yapmayanlar(satirlar)

  return (
    <div className="hidden print:block text-black">
      {/* not: <header> kullanma — globals.css print kuralı tüm header'ları gizliyor */}
      <div className="border-b-2 border-black pb-2 mb-4">
        <div className="flex items-baseline justify-between">
          <h1 className="text-base font-bold">{okulAdi}</h1>
          <span className="text-sm">Ödev Durum Raporu</span>
        </div>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11pt] mb-3">
        <dt className="font-semibold">Ödev</dt>
        <dd>{odevBasligi || '—'}</dd>
        <dt className="font-semibold">Sınıf</dt>
        <dd>{[sinif, ders].filter(Boolean).join('  ·  ') || '—'}</dd>
        {sonTeslim && (<><dt className="font-semibold">Son Teslim</dt><dd>{sonTeslim}</dd></>)}
        <dt className="font-semibold">Yazdırma</dt>
        <dd>{new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</dd>
      </dl>

      {ozet.length > 0 && (
        <p className="text-[11pt] mb-3 pb-2 border-b border-gray-400">
          <span className="font-semibold">Özet: </span>
          {ozet.map(o => `${o.sayi} ${o.etiket}`).join('  ·  ')}
          <span className="text-gray-600"> ({satirlar.length} öğrenci)</span>
        </p>
      )}

      {eksikler.length > 0 && (
        <div className="mb-3 pb-2 border-b border-gray-400">
          <p className="text-[11pt]">
            <span className="font-bold">Yapmayanlar ({eksikler.length}): </span>
            {eksikler.join(' · ')}
          </p>
        </div>
      )}

      <table className="w-full text-[10.5pt] border-collapse">
        <thead>
          <tr className="border-b border-black">
            <th className="text-left font-semibold py-1 w-8">#</th>
            <th className="text-left font-semibold py-1 w-16">No</th>
            <th className="text-left font-semibold py-1">Ad Soyad</th>
            <th className="text-left font-semibold py-1 w-24">Durum</th>
            <th className="text-left font-semibold py-1 w-1/3">Not</th>
          </tr>
        </thead>
        <tbody>
          {satirlar.map(s => (
            <tr key={s.sira} className="border-b border-gray-300">
              <td className="py-1 tabular-nums align-top">{s.sira}</td>
              <td className="py-1 tabular-nums align-top">{s.numara}</td>
              <td className="py-1 align-top">{s.ad}</td>
              <td className={`py-1 align-top ${s.durumKodu === 'yapilmadi' ? 'font-semibold' : ''}`}>{s.durum}</td>
              <td className="py-1 align-top text-gray-700">{s.not}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end gap-10 mt-8 text-[10pt]">
        {ogretmenAdi && <span>Öğretmen: <strong>{ogretmenAdi}</strong></span>}
        <span>İmza: ______________</span>
      </div>
    </div>
  )
}
