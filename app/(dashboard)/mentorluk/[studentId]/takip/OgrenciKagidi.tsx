import { GUNLER, SEVIYE_ADI, miktarYaz, kitapSayfaYaz, okulDurumYaz, type HaftaVerisi, type OkulOdevi } from '@/src/domains/mentor/takip/takipMath'
import { haftaEtiketi, dersKisa } from '@/src/domains/mentor/lib/bultenMath'
import type { SayfaVerisi } from '@/src/domains/mentor/services/TakipService'

// Satırlar sıkı (py-0.5): 24 görev + okul ödevleri + mentör ödevleri tek A4'e sığmalı (2026-10-16 kullanıcı)
export const th = 'border border-gray-400 px-1.5 py-0.5 text-left font-semibold'
export const td = 'border border-gray-400 px-1.5 py-0.5 align-top'

/** Okul ödevi bölümü, iki sütun: 11 ödev tek sütunda kâğıdı ikinci sayfaya taşıyordu (2026-10-16 kullanıcı).
 *  `durumlu` → son sütun öğretmen işareti (sonuç kâğıdı), değilse öğrencinin ✓ kutusu. */
export function OkulOdevTablosu({ baslik, liste, durumlu = false }: { baslik: string; liste: OkulOdevi[]; durumlu?: boolean }) {
  if (liste.length === 0) return null
  const yari = Math.ceil(liste.length / 2)
  return (
    <div className="mb-2 break-inside-avoid">
      <p className="font-semibold">{baslik}</p>
      <div className="grid grid-cols-2 gap-2 items-start">
        {[liste.slice(0, yari), liste.slice(yari)].filter(y => y.length > 0).map((yarim, i) => (
          <table key={i} aria-label={baslik} className="w-full border-collapse">
            <thead><tr>{['Ders', 'Okul ödevi', 'Teslim', durumlu ? 'Durum' : '✓'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{yarim.map(o => (
              <tr key={o.id} className="break-inside-avoid"><td className={td}>{dersKisa(o.subject)}</td><td className={td}>{o.title}</td>
                <td className={`${td} whitespace-nowrap`}>{o.due_date.slice(8, 10)}.{o.due_date.slice(5, 7)}</td>
                {durumlu ? <td className={`${td} whitespace-nowrap ${o.status === 'yapilmadi' ? 'font-bold' : ''}`}>{okulDurumYaz(o)}</td> : <td className={`${td} w-6`} />}</tr>
            ))}</tbody>
          </table>
        ))}
      </div>
    </div>
  )
}

/** A4 dikey öğrenci kâğıdı. Matematik satırı kalın + gri zemin (siyah-beyaz baskıda okunur). */
export default function OgrenciKagidi({ v, veri }: { v: SayfaVerisi; veri: HaftaVerisi }) {
  return (
    <article className="text-[11px] leading-snug text-black bg-white">
      {/* header/footer etiketi DEĞİL: globals.css baskıda header'ları gizler */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="text-xs">{v.okulAdi}</p>
          <h1 className="text-base font-bold">Haftalık Çalışma Planı</h1>
          <p>{v.ogrenci.ad} · {v.ogrenci.sinifAdi}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold">{haftaEtiketi(v.hafta)}</p>
          <p>Seviye: {SEVIYE_ADI[veri.seviye]} · Soru hedefi: {veri.soruHedefi}</p>
        </div>
      </div>
      {v.onceki?.hedef && <p className="border-2 border-black p-1.5 mb-2"><b>Bu haftaki hedefim:</b> {v.onceki.hedef}</p>}
      {veri.icerik.duzen && <p className="mb-2"><b>Hafta içi düzen:</b> {veri.icerik.duzen}</p>}

      <table aria-label="Program" className="w-full border-collapse mb-2">
        <thead><tr>{['Gün', 'Görev', 'Süre', 'Konu', 'Kitap / sayfa', 'Soru', 'Doğru', '✓'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody>
          {veri.icerik.gorevler.slice().sort((a, b) => a.gun - b.gun).map(g => (
            <tr key={g.id} className={`break-inside-avoid ${g.ders === 'Matematik' ? 'font-bold bg-gray-100' : ''}`}>
              <td className={td}>{GUNLER[g.gun]}</td>
              <td className={td}>{g.ad}</td>
              <td className={`${td} whitespace-nowrap`}>{miktarYaz(g, veri.seviye)}</td>
              <td className={td}>{g.konu}</td>
              <td className={td}>{kitapSayfaYaz(g)}</td>
              <td className={`${td} w-10 ${g.soruSatiri ? '' : 'bg-gray-300'}`} />
              <td className={`${td} w-10 ${g.soruSatiri ? '' : 'bg-gray-300'}`} />
              <td className={`${td} w-6`} />
            </tr>
          ))}
        </tbody>
      </table>

      <OkulOdevTablosu baslik="Tamamlanmamış ödevler (teslimi geçti)" liste={v.okulOdevleri.tamamlanmamis} />
      <OkulOdevTablosu baslik="Bu hafta teslim" liste={v.okulOdevleri.buHafta} />
      <OkulOdevTablosu baslik="Gelecek hafta teslim" liste={v.okulOdevleri.gelecek} />

      {veri.icerik.mentorOdevleri.length > 0 && (
        <table aria-label="Mentör ödevleri" className="w-full border-collapse mb-2">
          <thead><tr>{['Kitap', 'Konu', 'Sayfalar', '✓'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>{veri.icerik.mentorOdevleri.map(m => (
            <tr key={m.id} className="break-inside-avoid"><td className={td}>{m.kitapAdi}</td><td className={td}>{m.konu}</td><td className={td}>{m.sayfalar}</td><td className={`${td} w-6`} /></tr>
          ))}</tbody>
        </table>
      )}

      {veri.icerik.okuma && (
        <table aria-label="Okuma" className="w-full border-collapse mb-2">
          <thead><tr><th className={th}>Okuma: {veri.icerik.okuma.kitap}</th>{GUNLER.map(g => <th key={g} className={`${th} w-12 text-center`}>{g}</th>)}</tr></thead>
          <tbody><tr><td className={td}>Okuduğum sayfa</td>{GUNLER.map(g => <td key={g} className={`${td} h-6`} />)}</tr></tbody>
        </table>
      )}

      <div className="grid grid-cols-2 gap-4 mt-3 break-inside-avoid">
        <div className="border border-gray-400 h-14 p-1"><b>Öğretmen notu</b></div>
        <div className="border border-gray-400 h-14 p-1"><b>Veli imzası</b></div>
      </div>
    </article>
  )
}
