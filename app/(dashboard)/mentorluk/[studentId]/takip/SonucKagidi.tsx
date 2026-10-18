import {
  GUNLER, kaldigiMetni, ozetHesapla, programYuzde, dogrulukYuzde, sonucSatirlari, sonucNet, sonucDogruluk, dersDogruluk, ekranYaz, type HaftaVerisi, takipHaftaEtiketi,
} from '@/src/domains/mentor/takip/takipMath'

import type { SayfaVerisi } from '@/src/domains/mentor/services/TakipService'
import { OkulOdevTablosu, OkulOdevListesi, ImzaAlanlari, th, td } from './OgrenciKagidi'

const netYaz = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 2 })

/** A4 dikey haftalık sonuç kâğıdı — plan kâğıdıyla aynı dil (siyah-beyaz baskıda okunur). */
export default function SonucKagidi({ v, veri }: { v: SayfaVerisi; veri: HaftaVerisi }) {
  const o = ozetHesapla(veri.icerik)
  const p = programYuzde(o), d = dogrulukYuzde(o)
  const satirlar = sonucSatirlari(veri.icerik, v.kitaplar)
  const net = satirlar.reduce((t, s) => t + (sonucNet(s) ?? 0), 0)
  const dersler = dersDogruluk(satirlar)
  const yapilmayan = GUNLER.map((gun, i) => [gun, veri.icerik.gorevler.filter(g => g.gun === i && !g.yapti).map(g => g.ad)] as const)
    .filter(([, adlar]) => adlar.length > 0)
  const moYapilmayan = veri.icerik.mentorOdevleri.filter(m => !m.yapti)
  const kutu = (baslik: string, deger: string) => (
    <div className="border border-gray-400 px-2 py-1"><p className="text-[10px]">{baslik}</p><p className="text-base font-bold">{deger}</p></div>
  )

  return (
    <article className="text-[11px] leading-snug text-black bg-white">
      {/* header/footer etiketi DEĞİL: globals.css baskıda header'ları gizler */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="text-xs">{v.okulAdi}</p>
          <h1 className="text-base font-bold">Haftalık Sonuç</h1>
          <p>{v.ogrenci.ad} · {v.ogrenci.sinifAdi}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold">{takipHaftaEtiketi(v.hafta)}</p>
          {v.kayit?.kapaliAt && <p>Hafta kapatıldı: {new Date(v.kayit.kapaliAt).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })}</p>}
        </div>
      </div>

      <ImzaAlanlari />
      <div className="grid grid-cols-5 gap-2 mb-2" aria-label="Özet">
        {kutu('Program', p === null ? '—' : `%${p} (${o.gorev_yapilan}/${o.gorev_toplam})`)}
        {kutu('Toplam soru', `${o.soru} / hedef ${veri.soruHedefi}`)}
        {kutu('Doğruluk', d === null ? '—' : `%${d}`)}
        {kutu('Net', o.soru ? netYaz(net) : '—')}
        {kutu('Ekran süresi (günlük ort.)', veri.icerik.ekranSuresi == null ? '—' : `${ekranYaz(veri.icerik.ekranSuresi)} saat`)}
      </div>

      {satirlar.length > 0 && (
        <table aria-label="Soru sonuçları" className="w-full border-collapse mb-1">
          <thead><tr>{['Kitap / ders', 'Sayfa', 'Çözülen', 'Doğru', 'Yanlış', 'Boş', 'Net', 'Doğruluk'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>{satirlar.map(s => {
            const n = sonucNet(s), y = sonucDogruluk(s)
            return (
              <tr key={s.anahtar} className="break-inside-avoid">
                <td className={td}>{s.ad}{s.ders !== s.ad && ` · ${s.ders}`}</td>
                <td className={td}><span className="whitespace-nowrap">{s.sayfa}</span>{kaldigiMetni(s) && <span className="block font-bold">{kaldigiMetni(s)}</span>}</td>
                <td className={td}>{s.cozulen ?? ''}</td><td className={td}>{s.dogru ?? ''}</td><td className={td}>{s.yanlis ?? ''}</td><td className={td}>{s.bos ?? ''}</td>
                <td className={td}>{n === null ? '' : netYaz(n)}</td><td className={`${td} ${y !== null && y < 50 ? 'font-bold' : ''}`}>{y === null ? '' : `%${y}`}</td>
              </tr>
            )
          })}</tbody>
        </table>
      )}
      {dersler.length > 0 && <p className="mb-2"><b>Ders bazında doğruluk:</b> {dersler.map(x => `${x.ders} %${x.yuzde}`).join(' · ')}</p>}

      <div className="mb-2 break-inside-avoid">
        <p className="font-semibold">Yapılmayan görevler</p>
        {yapilmayan.length === 0 && moYapilmayan.length === 0 ? <p>Programdaki tüm görevler yapıldı.</p> : (
          <ul aria-label="Yapılmayan görevler">
            {yapilmayan.map(([gun, adlar]) => <li key={gun}><b>{gun}:</b> {adlar.join(', ')}</li>)}
            {moYapilmayan.length > 0 && <li><b>Mentör ödevi:</b> {moYapilmayan.map(m => [m.kitapAdi, m.konu, m.sayfalar].filter(Boolean).join(' ')).join(', ')}</li>}
          </ul>
        )}
      </div>

      <OkulOdevTablosu baslik="Bu haftanın okul ödevleri" liste={v.okulOdevleri.buHafta} durumlu />
      <OkulOdevListesi baslik="Tamamlanmamış okul ödevleri (önceki haftalar)" liste={v.okulOdevleri.tamamlanmamis} />
    </article>
  )
}
