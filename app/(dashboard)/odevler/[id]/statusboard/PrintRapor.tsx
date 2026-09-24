import { durumListesi, sutunlaraBol } from '@/src/domains/homework/lib/odev-rapor'
import type { RaporSatiri, OzetKalemi } from '@/src/domains/homework/lib/odev-rapor'
import type { SubmissionStatus } from '@/src/shared/types'

type Props = {
  okulAdi: string
  odevBasligi: string
  sinif: string
  ders: string
  /** Ödevin verildiği gün */
  verilisTarihi: string
  sonTeslim: string
  /** Öğretmenin son işaretleme yaptığı gün; hiç işaretlenmemişse boş */
  kontrolTarihi: string
  ogretmenAdi: string
  satirlar: RaporSatiri[]
  ozet: OzetKalemi[]
}

/** Çıktı veliyle/öğrenciyle paylaşılıyor: durum bir bakışta renkten okunmalı.
 *  Kırmızı = yapılmadı, sarı = eksik, mavi = yapıldı.
 *  Saf sarı metin beyaz kağıtta okunmuyor → durum hücresi zeminli rozet, başlıklar koyu ton. */
const ROZET: Record<SubmissionStatus, string> = {
  yapildi:   'bg-blue-100 text-blue-800',
  gec:       'bg-orange-100 text-orange-900',
  eksik:     'bg-yellow-200 text-yellow-900',
  yapilmadi: 'bg-red-100 text-red-800',
  mazeretli: 'bg-gray-100 text-gray-700',
}
const TON: Record<SubmissionStatus, string> = {
  yapildi:   'text-blue-700',
  gec:       'text-orange-700',
  eksik:     'text-yellow-700',
  yapilmadi: 'text-red-700',
  mazeretli: 'text-gray-600',
}
/** kod yok = "Girilmedi": durum değil, kayıt yokluğu — nötr basılır */
const rozet = (kod: SubmissionStatus | null) => (kod ? ROZET[kod] : 'bg-gray-50 text-gray-600')
const ton   = (kod: SubmissionStatus | null) => (kod ? TON[kod] : 'text-gray-500')

/** Yalnızca yazdırmada görünür; ekranda hiç yer kaplamaz. */
export default function PrintRapor({
  okulAdi, odevBasligi, sinif, ders, verilisTarihi, sonTeslim, kontrolTarihi,
  ogretmenAdi, satirlar, ozet,
}: Props) {
  const yapmayanlar = durumListesi(satirlar, ['yapilmadi'])
  const eksikler    = durumListesi(satirlar, ['eksik'])
  // Tek sayfaya sığsın: kalabalık sınıfta 2-3 sütun; çok sütunda not adın altına iner
  const sutunlar = sutunlaraBol(satirlar)
  const tekSutun = sutunlar.length === 1

  return (
    <div className="hidden print:block text-black">
      {/* not: <header> kullanma — globals.css print kuralı tüm header'ları gizliyor */}
      <div className="border-b-2 border-black pb-1 mb-2">
        <div className="flex items-baseline justify-between">
          <h1 className="text-base font-bold">{okulAdi}</h1>
          <span className="text-sm">Ödev Durum Raporu</span>
        </div>
      </div>

      <dl className="grid grid-cols-[auto_1fr_auto_1fr] gap-x-3 gap-y-0.5 text-[10pt] mb-2">
        <dt className="font-semibold">Ödev</dt>
        <dd>{odevBasligi || '—'}</dd>
        <dt className="font-semibold">Sınıf</dt>
        <dd>{[sinif, ders].filter(Boolean).join('  ·  ') || '—'}</dd>
        {verilisTarihi && (<><dt className="font-semibold">Ödevin verildiği tarih</dt><dd>{verilisTarihi}</dd></>)}
        {sonTeslim && (<><dt className="font-semibold">Son teslim tarihi</dt><dd>{sonTeslim}</dd></>)}
        <dt className="font-semibold">Kontrol edildiği tarih</dt>
        <dd>{kontrolTarihi || 'Henüz kontrol edilmedi'}</dd>
        <dt className="font-semibold">Yazdırma tarihi</dt>
        <dd>{new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</dd>
      </dl>

      {ozet.length > 0 && (
        <p className="text-[11pt] mb-3 pb-2 border-b border-gray-400">
          <span className="font-semibold">Özet: </span>
          {ozet.map((o, i) => (
            <span key={o.etiket}>
              {i > 0 && <span className="text-gray-500">  ·  </span>}
              <span className={`font-bold ${ton(o.kod)}`}>{o.sayi} {o.etiket}</span>
            </span>
          ))}
          <span className="text-gray-700"> — sınıf mevcudu {satirlar.length}</span>
        </p>
      )}

      {(yapmayanlar.length > 0 || eksikler.length > 0) && (
        <div className="mb-3 pb-2 border-b border-gray-400 space-y-1">
          {yapmayanlar.length > 0 && (
            <p className="text-[11pt]">
              <span className="font-bold text-red-700">Ödevi yapmayanlar ({yapmayanlar.length}): </span>
              {yapmayanlar.join(' · ')}
            </p>
          )}
          {eksikler.length > 0 && (
            <p className="text-[11pt]">
              <span className="font-bold text-yellow-700">Eksik bırakanlar ({eksikler.length}): </span>
              {eksikler.join(' · ')}
            </p>
          )}
        </div>
      )}

      <div className={`grid gap-x-4 ${tekSutun ? '' : sutunlar.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {sutunlar.map((sutun, i) => (
          <table key={i} className={`w-full border-collapse self-start ${tekSutun ? 'text-[10.5pt]' : sutunlar.length === 2 ? 'text-[9.5pt]' : 'text-[8.5pt]'}`}>
            <thead>
              <tr className="border-b border-black">
                <th className={`text-left font-semibold py-0.5 ${tekSutun ? 'w-12' : 'w-8'}`}>No</th>
                <th className="text-left font-semibold py-0.5">Ad Soyad</th>
                <th className={`text-left font-semibold py-0.5 ${tekSutun ? 'w-24' : 'w-16'}`}>Durum</th>
                {tekSutun && <th className="text-left font-semibold py-0.5 w-1/3">Not</th>}
              </tr>
            </thead>
            <tbody>
              {sutun.map(s => (
                <tr key={s.sira} className="border-b border-gray-300 break-inside-avoid">
                  <td className="py-0.5 tabular-nums align-top">{s.numara || '—'}</td>
                  <td className="py-0.5 align-top leading-tight">
                    {s.ad}
                    {!tekSutun && s.not && <span className="block text-[8pt] text-gray-700">{s.not}</span>}
                  </td>
                  <td className="py-0.5 align-top">
                    <span className={`inline-block px-1 rounded font-bold whitespace-nowrap ${rozet(s.durumKodu)}`}>{s.durum}</span>
                  </td>
                  {tekSutun && <td className="py-0.5 align-top text-gray-700">{s.not}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>

      <div className="flex justify-end gap-10 mt-4 text-[10pt] break-inside-avoid">
        {ogretmenAdi && <span>Öğretmen: <strong>{ogretmenAdi}</strong></span>}
        <span>İmza: ______________</span>
      </div>
    </div>
  )
}
