import { gunSirasi, gunTarihi, type HaftaVerisi, type OkulOdevi, takipHaftaEtiketi } from '@/src/domains/mentor/takip/takipMath'
import { saatlerVarMi, saatYaz } from '@/src/domains/mentor/takip/calismaSaatleri'
import { GUN_KISA, GUN_TAM, gunSatirlari, rutinGunuMu, rutinler, type KagitSatiri, type Rutin } from '@/src/domains/mentor/takip/planKagidi'
import { tatilBul } from '@/src/domains/mentor/takip/tatiller'
import { dersKisa, gunAy } from '@/src/domains/mentor/lib/bultenMath'
import type { SayfaVerisi } from '@/src/domains/mentor/services/TakipService'
import TekSayfa from './TekSayfa'

/** Uzun liste (tamamlanmamış ödevler, gerçek okulda 27'ye çıkıyor): üç sütun, satır başına "Ders – ödev (tarih)". */
function OkulOdevListesi({ baslik, liste }: { baslik: string; liste: OkulOdevi[] }) {
  if (liste.length === 0) return null
  return (
    <div className="mb-2 break-inside-avoid">
      <p className="font-semibold">{baslik} ({liste.length})</p>
      <ul aria-label={baslik} className="grid grid-cols-3 gap-x-3 text-[10px] leading-tight border-t border-gray-400">
        {liste.map(o => (
          <li key={o.id} className="border-b border-gray-300 py-px">□ {dersKisa(o.subject)} – {o.title} <span className="whitespace-nowrap">({o.due_date.slice(8, 10)}.{o.due_date.slice(5, 7)})</span></li>
        ))}
      </ul>
    </div>
  )
}

// Taslak (Downloads/plan-taslak.html, 2026-10-24) ölçüleri; sıkışık kâğıtta (TekSayfa data-sik) boşluklar daralır, yazı değil
const KUTU = 'inline-block w-[11px] h-[11px] border border-[#444] align-middle'
const TARALI = 'bg-[repeating-linear-gradient(45deg,#f3f3f3,#f3f3f3_4px,#e6e6e6_4px,#e6e6e6_8px)]'
const BOLUM = 'text-[11px] uppercase tracking-[.05em] text-[#333] font-bold mt-[9px] mb-[3px] group-data-[sik]:mt-[5px]'
const HUCRE = 'border border-[#999] px-1 py-[3px] h-[24px] group-data-[sik]:h-[19px] group-data-[sik]:py-px'

type RutinSatiri = Pick<Rutin, 'etiket' | 'not'> & { sayfalar?: Rutin['sayfalar']; tur: Rutin['tur'] | 'saat'; acik: (gun: number) => boolean }

function hucre(tur: RutinSatiri['tur']) {
  if (tur === 'kutu') return <span aria-hidden className={KUTU} />
  return tur === 'kesir' ? '___/___' : tur === 'sayfa' ? '___ sf' : '___ sa'
}

function Satir({ s }: { s: KagitSatiri }) {
  return (
    <li>
      <div className={`flex gap-[5px] items-start py-[2px] group-data-[sik]:py-px ${s.gecikmis ? 'bg-[#f2f2f2] border-l-[3px] border-[#111] pl-1 -ml-0.5' : ''}`}>
        <span aria-hidden className="flex-none w-[11px] h-[11px] border border-[#333] mt-[2px]" />
        <span className="flex-1 leading-[1.3]">
          <b className="font-semibold">{s.ders}</b>{s.metin && ` — ${s.metin}`}
          {s.gecikmis && <b className="text-[8.5px] font-bold"> GECİKMİŞ</b>}
          {/* "sığmaz" uyarısı öğrenci kâğıdında YOK: öğrenci değiştiremez; yalnız plan ekranında mentöre (2026-10-24 kullanıcı) */}
        </span>
        <span className="flex-none whitespace-nowrap text-[#333]">{s.sure}</span>
      </div>
      {s.test && <p className="text-[9.5px] text-[#444] my-px ml-4">Çözdüm ___ Doğru ___</p>}
    </li>
  )
}

/** A4 dikey öğrenci kâğıdı (2026-10-24 yeniden tasarım, spec 2026-10-24-haftalik-plan-kagidi-yeniden):
 *  "Her gün" rutin tablosu + güne özel ödevler + hafta sonu özeti. İmza ve filigran yok; siyah-beyaz okunur. */
export default function OgrenciKagidi({ v, veri }: { v: SayfaVerisi; veri: HaftaVerisi }) {
  const o = v.okulOdevleri
  const eskiListeler = !veri.icerik.otoOdev && o.tamamlanmamis.length + o.buHafta.length + o.gelecek.length > 0
  const gorevler = veri.icerik.gorevler
  const rut = rutinler(gorevler, v.hafta)
  const rutinAdlari = new Set(rut.map(r => r.ad))
  const saatVar = saatlerVarMi(v.saatler)
  const gunler = gunSirasi(v.hafta).map(i => {
    const tarih = gunTarihi(v.hafta, i)
    return { i, tarih, tatil: tatilBul(tarih), saat: saatVar ? v.saatler!.gunler[i] : null, satirlar: gunSatirlari(gorevler, i, rutinAdlari, v.bugun, v.hafta) }
  })
  const gecikmis = gunler.reduce((t, x) => t + x.satirlar.filter(s => s.gecikmis).length, 0)
  const tablo: RutinSatiri[] = [
    ...rut.map(r => ({ ...r, acik: (i: number) => rutinGunuMu(r, i, tatilBul(gunTarihi(v.hafta, i))) })),
    { etiket: 'Ekran süresi', not: '', tur: 'saat', acik: () => true },
  ]

  const gunKutusu = ({ i, tarih, tatil, saat, satirlar }: typeof gunler[number]) => (
    <section key={i} aria-label={GUN_TAM[i]} className={`break-inside-avoid border-[1.3px] rounded px-1.5 pt-1 pb-[5px] mb-1.5 group-data-[sik]:mb-1 group-data-[sik]:pt-0.5 group-data-[sik]:pb-0.5 ${tatil?.tur === 'tatil' ? 'border-[#c0392b]' : 'border-[#333]'}`}>
      <h3 className={`flex justify-between items-baseline gap-1 border-b mb-[3px] pb-px ${tatil?.tur === 'tatil' ? 'border-[#c0392b]' : 'border-[#333]'}`}>
        <b className="text-[11.5px]">{GUN_TAM[i]} · {gunAy(tarih)}</b>
        <span className="text-[9px] text-[#555] font-normal whitespace-nowrap">
          {tatil && <span className={`text-[8.5px] font-bold text-white rounded-[3px] px-1 ${tatil.tur === 'tatil' ? 'bg-[#c0392b]' : 'bg-[#888]'}`}>
            {tatil.tur === 'tatil' ? tatil.ad.toLocaleUpperCase('tr') : 'YARIM GÜN'}</span>}
          {saat && ` ${saatYaz(saat.bas)}–${saatYaz(saat.bit)}`}
        </span>
      </h3>
      <ul>{satirlar.map(s => <Satir key={s.id} s={s} />)}</ul>
      {/* Okulda yeni verilen ödevi öğrenci kendisi yazar: tek satır */}
      <p className="flex items-end gap-1 mt-1 pt-1 border-t border-dashed border-[#aaa] text-[9.5px] text-[#444] group-data-[sik]:mt-0.5 group-data-[sik]:pt-0.5">
        Yeni ödev: <span className="flex-1 border-b border-[#777] h-3" /> Teslim: <span className="w-[18%] border-b border-[#777] h-3" />
      </p>
    </section>
  )

  return (
    <article className="text-[10.5px] text-[#111] bg-white">
      {/* Sade kâğıt: okul logosu filigranı basılmaz (2026-10-24 kullanıcı) */}
      <style>{'@media print { .filigran { display: none !important; } }'}</style>
      <TekSayfa>
        <div className="flex justify-between items-end border-b-2 border-[#111] pb-1">
          <div>
            <p className="text-[9px] text-[#444]">{v.okulAdi} · Mentörlük</p>
            <h1 className="text-[17px] font-bold mt-px">Haftalık Çalışma Planı</h1>
            <p className="text-[13px] font-semibold">{v.ogrenci.ad} · {v.ogrenci.sinifAdi}</p>
          </div>
          <div className="text-right">
            <p className="text-[17px] font-extrabold">{takipHaftaEtiketi(v.hafta)}</p>
            <p className="text-[11px] mt-0.5">Haftalık hedef: <b className="text-[13px]">{veri.soruHedefi} soru</b> · Gecikmiş: <b className="text-[13px]">{gecikmis}</b></p>
          </div>
        </div>

        <h2 className={BOLUM}>Her gün</h2>
        <table aria-label="Her gün" className="w-full border-collapse table-fixed text-[10.5px]">
          <thead><tr>
            <th className={`${HUCRE} bg-[#f0f0f0] font-semibold text-left w-[31%]`}>Rutin</th>
            {gunler.map(({ i, tarih, tatil }) => (
              <th key={i} className={`${HUCRE} font-semibold ${tatil?.tur === 'tatil' ? 'bg-[#fde8e8]' : 'bg-[#f0f0f0]'}`}>{GUN_KISA[i]} {Number(tarih.slice(8))}</th>
            ))}
          </tr></thead>
          <tbody>{tablo.map(r => (
            <tr key={r.etiket}>
              <td className={`${HUCRE} font-semibold`}>{r.etiket} {r.not && <small className="text-[10.5px] font-normal text-[#555]">{r.not}</small>}</td>
              {gunler.map(({ i }) => r.acik(i)
                ? <td key={i} className={`${HUCRE} text-center text-[#888] text-[9.5px] tracking-[.5px]`}>
                    {r.sayfalar?.[i] && <span className="block text-[8.5px] text-[#333] leading-none tracking-normal">{r.sayfalar[i]}</span>}{hucre(r.tur)}</td>
                : <td key={i} aria-label="yok" className={`${HUCRE} ${TARALI}`} />)}
            </tr>
          ))}</tbody>
        </table>

        <h2 className={BOLUM}>Günlük ödevler</h2>
        {/* Sol Cu–Pt, sağ Sa–Pe + özet (taslak); iki bağımsız sütun: bir günün uzunluğu karşısındakini itmez */}
        <div className="grid grid-cols-2 gap-1.5 items-start">
          <div>{gunler.slice(0, 4).map(gunKutusu)}</div>
          <div>
            {gunler.slice(4).map(gunKutusu)}
            <section aria-label="Hafta sonu özeti" className="break-inside-avoid border-2 border-[#111] rounded px-[7px] py-[5px]">
              <h3 className="text-[11.5px] font-bold mb-1">Hafta sonu özeti</h3>
              {[['Toplam soru', `____ / ${veri.soruHedefi}`], ['Toplam doğru', '____'], ['Kapanan gecikmiş', `____ / ${gecikmis}`]].map(([ad, deger]) => (
                <p key={ad} className="flex justify-between py-1 border-b border-[#ddd] group-data-[sik]:py-0.5"><span>{ad}</span><b className="text-[13px]">{deger}</b></p>
              ))}
              <div className="h-[70px] border border-[#bbb] mt-1 rounded-[3px] px-1 py-0.5 text-[9px] text-[#777] group-data-[sik]:h-[50px]">Mentör notu:</div>
            </section>
          </div>
        </div>

        {(veri.icerik.okuma || veri.icerik.mentorOdevleri.length > 0) && <div className="text-[9.5px] space-y-1 mt-1">
          {veri.icerik.okuma && <p><b>Okuma:</b> {veri.icerik.okuma.kitap} — okuduğun sayfaları her gün not et.</p>}
          {veri.icerik.mentorOdevleri.length > 0 && (
            <p><b>Mentör ödevleri:</b> {veri.icerik.mentorOdevleri.map(m => [m.kitapAdi, m.konu, m.sayfalar].filter(Boolean).join(' ')).join(' · ')}</p>
          )}
        </div>}
      </TekSayfa>

      {/* Özellikten önce elle hazırlanmış plan: ödevler göreve girmedi, eski üç liste 2. sayfada */}
      {eskiListeler && <div className="break-before-page text-[9.5pt] space-y-1 pt-1">
        <OkulOdevListesi baslik="Tamamlanmamış ödevler (teslimi geçti)" liste={o.tamamlanmamis} />
        <OkulOdevListesi baslik="Bu hafta teslim" liste={o.buHafta} />
        <OkulOdevListesi baslik="Gelecek hafta teslim" liste={o.gelecek} />
      </div>}
    </article>
  )
}
