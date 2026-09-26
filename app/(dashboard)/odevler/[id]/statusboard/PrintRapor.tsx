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
 *  Saf sarı metin beyaz kağıtta okunmuyor → zeminli rozet; ✓/✗ siyah-beyaz baskıda da ayırt ettirir. */
type Renk = { rozet: string; satir: string; kutu: string; cubuk: string; isaret: string }
const RENK: Record<SubmissionStatus, Renk> = {
  yapildi:   { rozet: 'bg-blue-100 text-blue-800',     satir: '',            kutu: 'border-blue-600 text-blue-800',     cubuk: 'bg-blue-600',   isaret: '✓ ' },
  gec:       { rozet: 'bg-orange-100 text-orange-900', satir: '',            kutu: 'border-orange-500 text-orange-800', cubuk: 'bg-orange-500', isaret: '' },
  eksik:     { rozet: 'bg-yellow-200 text-yellow-900', satir: 'bg-yellow-50', kutu: 'border-yellow-400 text-yellow-900', cubuk: 'bg-yellow-400', isaret: '' },
  yapilmadi: { rozet: 'bg-red-100 text-red-800',       satir: 'bg-red-50',    kutu: 'border-red-600 text-red-800',       cubuk: 'bg-red-600',    isaret: '✗ ' },
  mazeretli: { rozet: 'bg-gray-100 text-gray-700',     satir: '',            kutu: 'border-gray-400 text-gray-700',     cubuk: 'bg-gray-400',   isaret: '' },
}
/** kod yok = "Girilmedi": durum değil, kayıt yokluğu — nötr basılır */
const GIRILMEDI: Renk = { rozet: 'text-gray-500', satir: '', kutu: 'border-gray-300 text-gray-500', cubuk: 'bg-gray-200', isaret: '' }
const renk = (kod: SubmissionStatus | null) => (kod ? RENK[kod] : GIRILMEDI)

const uzunTarih = (d: Date) => d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })

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
  const toplam = satirlar.length

  const tarihler = [
    ['Verildi', verilisTarihi],
    ['Son teslim', sonTeslim],
    ['Kontrol edildi', kontrolTarihi || 'Henüz kontrol edilmedi'],
  ].filter(([, v]) => v)

  return (
    <div className="hidden print:block text-black">
      {/* not: <header> kullanma — globals.css print kuralı tüm header'ları gizliyor */}
      <div className="flex items-center justify-between text-[9pt] uppercase tracking-wider text-gray-600 border-b border-gray-300 pb-1">
        <span className="font-semibold">{okulAdi}</span>
        <span>Ödev Kontrol Raporu</span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[17pt] font-bold leading-tight">{odevBasligi || 'Ödev'}</h1>
          <p className="text-[10.5pt] text-gray-700 mt-0.5">
            {[sinif, ders].filter(Boolean).join(' · ')}
            {ogretmenAdi && <> · {ogretmenAdi}</>}
          </p>
        </div>
        <dl className="flex shrink-0 text-[9pt] border border-gray-300 rounded-md overflow-hidden">
          {tarihler.map(([etiket, deger]) => (
            <div key={etiket} className="px-2.5 py-1 border-l border-gray-300 first:border-l-0">
              <dt className="text-gray-500 text-[8pt]">{etiket}</dt>
              <dd className="font-semibold whitespace-nowrap">{deger}</dd>
            </div>
          ))}
        </dl>
      </div>

      {ozet.length > 0 && (
        <div className="mt-3 break-inside-avoid">
          <div className="flex gap-2">
            {ozet.map(o => (
              <div key={o.etiket} className={`flex-1 border-l-4 bg-gray-50 rounded-r px-2 py-1 ${renk(o.kod).kutu}`}>
                <div className="text-[17pt] font-bold leading-none tabular-nums">{o.sayi}</div>
                <div className="text-[9pt] font-semibold mt-0.5">{o.etiket}</div>
              </div>
            ))}
            <div className="flex-1 border-l-4 border-black bg-gray-50 rounded-r px-2 py-1">
              <div className="text-[17pt] font-bold leading-none tabular-nums">{toplam}</div>
              <div className="text-[9pt] font-semibold mt-0.5">Mevcut</div>
            </div>
          </div>
          {toplam > 0 && (
            <div className="flex h-2 mt-2 rounded-full overflow-hidden">
              {ozet.map(o => (
                <div key={o.etiket} className={renk(o.kod).cubuk} style={{ width: `${(o.sayi / toplam) * 100}%` }} />
              ))}
            </div>
          )}
        </div>
      )}

      {(yapmayanlar.length > 0 || eksikler.length > 0) && (
        <div className="mt-3 grid grid-cols-2 gap-2 break-inside-avoid">
          {[
            { baslik: 'Ödevi yapmayanlar', adlar: yapmayanlar, cls: 'border-red-300 bg-red-50', baslikCls: 'text-red-800' },
            { baslik: 'Eksik bırakanlar',  adlar: eksikler,    cls: 'border-yellow-400 bg-yellow-50', baslikCls: 'text-yellow-900' },
          ].filter(k => k.adlar.length > 0).map(k => (
            <div key={k.baslik} className={`border rounded-md px-2.5 py-1.5 ${k.cls} ${yapmayanlar.length && eksikler.length ? '' : 'col-span-2'}`}>
              <p className={`text-[10pt] font-bold ${k.baslikCls}`}>{k.baslik} ({k.adlar.length})</p>
              <p className="text-[10pt] leading-snug mt-0.5">{k.adlar.join(', ')}</p>
            </div>
          ))}
        </div>
      )}

      <div className={`mt-4 grid gap-x-4 ${tekSutun ? '' : sutunlar.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {sutunlar.map((sutun, i) => (
          <table key={i} className={`w-full border-collapse self-start ${tekSutun ? 'text-[10.5pt]' : sutunlar.length === 2 ? 'text-[9.5pt]' : 'text-[8.5pt]'}`}>
            <thead>
              <tr className="border-b-2 border-gray-800 text-[0.85em] uppercase tracking-wide text-gray-600">
                <th className="text-left font-semibold py-1 pl-1">Ad Soyad</th>
                <th className={`text-left font-semibold py-1 ${tekSutun ? 'w-28' : 'w-[5.5rem]'}`}>Durum</th>
                {tekSutun && <th className="text-left font-semibold py-1 w-1/3">Not</th>}
              </tr>
            </thead>
            <tbody>
              {sutun.map(s => {
                const r = renk(s.durumKodu)
                return (
                  <tr key={s.sira} className={`border-b border-gray-200 break-inside-avoid ${r.satir}`}>
                    <td className="py-[3px] pl-1 align-top leading-tight">
                      {s.ad}
                      {!tekSutun && s.not && <span className="block text-[8pt] text-gray-600 italic">{s.not}</span>}
                    </td>
                    <td className="py-[3px] align-top">
                      <span className={`inline-block px-1.5 rounded font-bold whitespace-nowrap ${r.rozet}`}>{r.isaret}{s.durum}</span>
                    </td>
                    {tekSutun && <td className="py-[3px] align-top text-gray-700 italic">{s.not}</td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        ))}
      </div>

      <div className="flex items-end justify-between mt-6 break-inside-avoid">
        <span className="text-[8pt] text-gray-500">Yazdırma: {uzunTarih(new Date())} · myedudesk.com.tr</span>
        <div className="text-center text-[10pt] w-56">
          <div className="border-b border-gray-800 h-8" />
          <div className="mt-1 font-semibold">{ogretmenAdi || 'Ders Öğretmeni'}</div>
          <div className="text-[8.5pt] text-gray-600">Ders Öğretmeni · İmza</div>
        </div>
      </div>
    </div>
  )
}
