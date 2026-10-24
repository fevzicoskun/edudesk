import { dersGruplari, dersOzetiMetni } from '@/src/domains/homework/lib/stats'
import { DERS_ADLARI, netYaz, type DenemeTuru } from '@/src/domains/mentor/deneme/stoys'
import { takipHaftaEtiketi } from '@/src/domains/mentor/takip/takipMath'
import { gunAy } from '@/src/domains/mentor/lib/bultenMath'
import type { VeliToplantisiVerisi } from '@/src/domains/mentor/deneme/VeliToplantisiService'
import { DURUM_ETIKETLERI } from '../takip/SonucKagidi'

const TUR_ADI: Record<DenemeTuru, string> = { TM: 'TM (Türkçe, Matematik)', FKB: 'FKB (Fizik, Kimya, Biyoloji)', TCD: 'TCD (Tarih, Coğrafya, Din)' }
const DERS_SIRASI: Record<DenemeTuru, string[]> = { TM: ['TÜR', 'MAT'], FKB: ['FİZ', 'KİM', 'BİY'], TCD: ['TAR', 'COĞ', 'DİN'] }
const DURUM_YAZ: Record<string, string> = { yapilmadi: 'Yapılmadı', eksik: 'Eksik' }
const th = 'border border-gray-400 px-1.5 py-0.5 text-left font-semibold'
const td = 'border border-gray-400 px-1.5 py-0.5 align-top'
const degisimYaz = (d: number | null) => (d === null ? '—' : d > 0 ? `+${netYaz(d)}` : netYaz(d))
const tarihYaz = (iso: string) => `${gunAy(iso)} ${iso.slice(0, 4)}`

/** Veli toplantısı kâğıdı (spec 2026-10-22): deneme gidişi (tür kendi içinde) → ödevler → haftalık plan → elle not.
 *  Katılmadığı sınav ve girilmemiş hafta 0 DEĞİL; işaretlenmemiş ödev yapılmadı sayılmaz. İki sayfaya taşabilir. */
export default function VeliToplantisiKagidi({ v }: { v: VeliToplantisiVerisi }) {
  const turler = (Object.keys(DERS_SIRASI) as DenemeTuru[]).filter(t => v.denemeler[t].length > 0)
  const eksikler = v.odevler.filter(o => o.status === 'yapilmadi' || o.status === 'eksik')
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? '') || a.subject.localeCompare(b.subject, 'tr'))
  const oranlar = dersGruplari(v.odevler).map(g => dersOzetiMetni(g.ozet))
  return (
    <article className="text-[10.5pt] leading-snug text-black bg-white">
      <div className="flex justify-between items-end border-b-2 border-black pb-1 mb-2">
        <div>
          <p className="text-[9pt]">{v.okulAdi}</p>
          <h1 className="text-[16pt] font-bold leading-tight">Veli Toplantısı</h1>
          <p className="text-[12pt] font-semibold">{v.ogrenci.ad} · {v.ogrenci.sinif}</p>
        </div>
        <div className="text-right text-[10pt]">
          <p>Mentör öğretmen: <b>{v.mentorAdi}</b></p>
          <p>{tarihYaz(v.tarih)}</p>
        </div>
      </div>

      <section aria-label="Denemeler" className="mb-3">
        <h2 className="text-[12pt] font-bold mb-1">Denemeler</h2>
        {turler.length === 0 ? <p>Bu dönem için deneme sonucu yüklenmedi.</p> : turler.map(t => {
          const satirlar = v.denemeler[t]
          const kodlar = DERS_SIRASI[t].filter(k => satirlar.some(s => s.dersler.some(d => d.kod === k)))
          return (
            <table key={t} aria-label={`${t} denemeleri`} className="w-full border-collapse mb-2 break-inside-avoid">
              <caption className="text-left font-semibold">{TUR_ADI[t]}</caption>
              <thead><tr>
                {/* "Tarih" değil: TCD'de Tarih dersi sütunuyla karışıyordu (2026-10-24) */}
                <th className={th}>Sınav</th>
                {kodlar.map(k => <th key={k} className={`${th} text-right`}>{DERS_ADLARI[k] ?? k}</th>)}
                <th className={`${th} text-right`}>Toplam net</th>
                <th className={`${th} text-right`}>Değişim</th>
              </tr></thead>
              <tbody>{satirlar.map(s => (
                <tr key={s.tarih}>
                  <td className={`${td} whitespace-nowrap`}>{gunAy(s.tarih)}</td>
                  {s.katilmadi
                    ? <td className={`${td} italic`} colSpan={kodlar.length + 2}>Katılmadı</td>
                    : <>
                        {kodlar.map(k => { const d = s.dersler.find(x => x.kod === k); return <td key={k} className={`${td} text-right tabular-nums`}>{d ? netYaz(d.n) : '—'}</td> })}
                        <td className={`${td} text-right tabular-nums font-semibold`}>{netYaz(s.toplamNet!)}</td>
                        <td className={`${td} text-right tabular-nums`}>{degisimYaz(s.degisim)}</td>
                      </>}
                </tr>
              ))}</tbody>
            </table>
          )
        })}
      </section>

      <section aria-label="Ödevler" className="mb-3">
        <h2 className="text-[12pt] font-bold mb-1">Ödevler</h2>
        {oranlar.length > 0 && <p className="mb-1"><b>Derslere göre yapılan / kontrol edilen:</b> {oranlar.join(' · ')}</p>}
        {eksikler.length === 0 ? <p>Yapılmayan ödev yok.</p> : (
          <table aria-label="Yapılmayan ve eksik ödevler" className="w-full border-collapse">
            <thead><tr>{['Durum', 'Ders', 'Ödev', 'Teslim'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{eksikler.map(o => (
              <tr key={o.id} className="break-inside-avoid">
                <td className={`${td} whitespace-nowrap`}>{DURUM_YAZ[o.status!]}</td>
                <td className={`${td} whitespace-nowrap`}>{o.subject}</td>
                <td className={td}>{o.title}</td>
                <td className={`${td} whitespace-nowrap`}>{o.due_date ? `${o.due_date.slice(8, 10)}.${o.due_date.slice(5, 7)}` : '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>

      <section aria-label="Haftalık plan sonuçları" className="mb-3 break-inside-avoid">
        <h2 className="text-[12pt] font-bold mb-1">Haftalık plan</h2>
        {v.haftalar.length === 0 ? <p>Bu dönem haftalık plan sonucu yok.</p> : (
          <table aria-label="Haftalık plan" className="w-full border-collapse">
            <thead><tr>{['Hafta', 'Program', 'Soru', 'Durum'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{v.haftalar.map(h => (
              <tr key={h.hafta} className="break-inside-avoid">
                <td className={`${td} whitespace-nowrap`}>{takipHaftaEtiketi(h.hafta)}</td>
                {h.girilmedi ? <td className={`${td} italic`} colSpan={3}>Girilmedi</td> : <>
                  <td className={td}>{h.program === null ? '—' : `%${h.program}`}</td>
                  <td className={td}>{h.soru === null ? 'Girilmedi' : `${h.soru} / ${h.hedef}`}</td>
                  <td className={td}>{h.durum ? DURUM_ETIKETLERI[h.durum] : '—'}</td>
                </>}
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>

      <section aria-label="Mentör notu" className="break-inside-avoid">
        <h2 className="text-[12pt] font-bold mb-1">Mentör notu</h2>
        {/* Sisteme not girilmez: toplantıda elle yazılır */}
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="border-b border-gray-400 h-6" />)}
        <div className="grid grid-cols-3 gap-4 mt-6 text-[10pt]">
          {['Mentör imzası', 'Veli imzası', 'Tarih'].map(x => <p key={x} className="border-t border-black pt-0.5">{x}</p>)}
        </div>
      </section>
    </article>
  )
}
