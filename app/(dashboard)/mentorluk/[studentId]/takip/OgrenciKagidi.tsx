import { miktarYaz, kitapSayfaYaz, okulDurumYaz, gunSirasi, dengeliBol, gunTarihi, type HaftaVerisi, type OkulOdevi, takipHaftaEtiketi } from '@/src/domains/mentor/takip/takipMath'
import { gorevSaatleri, kagitDuzeni, saatlerVarMi, saatYaz } from '@/src/domains/mentor/takip/calismaSaatleri'
import { odevEtiketi, planDisi } from '@/src/domains/mentor/takip/odevYerlesim'
import { dersKisa, gunAy } from '@/src/domains/mentor/lib/bultenMath'
import type { SayfaVerisi } from '@/src/domains/mentor/services/TakipService'
import TekSayfa from './TekSayfa'

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

/** Uzun liste (tamamlanmamış ödevler, gerçek okulda 27'ye çıkıyor): üç sütun, satır başına "Ders – ödev (tarih)". */
export function OkulOdevListesi({ baslik, liste }: { baslik: string; liste: OkulOdevi[] }) {
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

/** Öğretmen notu + veli imzası başlığın hemen altında: altta dururken uzun ödev listesiyle 2. sayfaya sarkıyordu (2026-10-17). */
export function ImzaAlanlari() {
  return (
    <div className="grid grid-cols-2 gap-2 mb-2 break-inside-avoid">
      <div className="border border-gray-400 h-11 p-1"><b>Öğretmen notu</b></div>
      <div className="border border-gray-400 h-11 p-1"><b>Veli imzası</b></div>
    </div>
  )
}

const GUN_TAM = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'] as const

/** A4 dikey öğrenci kâğıdı (2026-10-21 yeniden tasarım): gün başına kutu, öğrencinin saatiyle sıralı görevler.
 *  Siyah-beyaz baskıda okunur: gri dolgu yok, etiketler metinle ayırt edilir, gövde ≥ 11pt. */
export default function OgrenciKagidi({ v, veri }: { v: SayfaVerisi; veri: HaftaVerisi }) {
  const duzen = kagitDuzeni(veri.icerik.duzen, v.saatler)
  const disarida = planDisi(v.disaridaOdevler, veri.icerik.gizliOdevler ?? [], v.odevKayitlari, veri.icerik.gorevler)
  // Plan sırası (Cuma haftasında Cum → Per); görev günü haftanın günüdür
  const o = v.okulOdevleri
  const eskiListeler = !veri.icerik.otoOdev && o.tamamlanmamis.length + o.buHafta.length + o.gelecek.length > 0
  // Yaklaşık satır yükü: başlık + görev satırları (ad + etiket ~38 karakterde sarar; soru satırı küçük) + 2 "Yeni ödev"
  const yuk = (gs: typeof veri.icerik.gorevler) => 3.2 + gs.reduce((t, g) => {
    const etiket = g.teslim && odevEtiketi(g.teslim, v.bugun).tur !== 'tarih' ? 14 : 0
    return t + Math.ceil((g.ad.length + etiket) / 38) + (g.soruSatiri ? 0.8 : 0)
  }, 0)
  const gunler = gunSirasi(v.hafta).map(i => ({ ad: GUN_TAM[i], i, gorevler: veri.icerik.gorevler.filter(g => g.gun === i) })).filter(x => x.gorevler.length > 0)
  const yukler = gunler.map(x => yuk(x.gorevler))
  const bolum = dengeliBol(yukler)
  return (
    <article className="text-[11pt] leading-snug text-black bg-white">
      {/* Plan + plana girmeyen ödevler her zaman tek A4 (2026-10-24 kullanıcı: 2 sayfayı tek tek zımbalamak zorunda kaldı) */}
      <TekSayfa>
      {/* header/footer etiketi DEĞİL: globals.css baskıda header'ları gizler */}
      <div className="flex justify-between items-start border-b-2 border-black pb-1 mb-1.5">
        <div>
          <p className="text-[9pt]">{v.okulAdi}</p>
          <h1 className="text-[15pt] font-bold leading-tight">Haftalık Çalışma Planı</h1>
          <p className="text-[13pt] font-bold">{v.ogrenci.ad} · {v.ogrenci.sinifAdi}</p>
        </div>
        <p className="font-extrabold text-[15pt]">{takipHaftaEtiketi(v.hafta)}</p>
      </div>
      <p className="text-[14pt] font-bold">Bu hafta hedefin: {veri.soruHedefi} soru</p>
      {duzen && <p className="text-[10pt]"><b>Günlük düzen:</b> {duzen}</p>}

      {/* İki açık sütun, yükü dengeli (dengeliBol): CSS columns baskıda iki sütunu da kısa kesip günleri 2. sayfaya itiyordu */}
      <div className="grid grid-cols-2 gap-2 mt-2 items-start">
        {[gunler.slice(0, bolum), gunler.slice(bolum)].map((sutun, si) => <div key={si}>{sutun.map(({ ad, i, gorevler }) => {
          const saat = saatlerVarMi(v.saatler) ? v.saatler!.gunler[i] : null
          return (
            <section key={ad} aria-label={ad} className="break-inside-avoid border border-black rounded px-2 py-0.5 mb-1 leading-tight">
              <h2 className="flex items-baseline justify-between gap-2 font-bold border-b border-black mb-0.5">
                <span>{ad} · {gunAy(gunTarihi(v.hafta, i))}{saat && ` · ${saatYaz(saat.bas)}–${saatYaz(saat.bit)}`}</span>
                {/* Günlük ekran süresini öğrenci her gün yazar (veli imzası altındaki haftalık alan kalktı, 2026-10-22) */}
                <span className="text-[8.5pt] font-normal whitespace-nowrap">Ekran: ___ sa</span>
              </h2>
              <ul>
                {gorevSaatleri(saat, gorevler).map(({ gorev: g, saat: s }) => {
                  const e = g.teslim ? odevEtiketi(g.teslim, v.bugun) : null
                  const kitap = g.soruSatiri ? kitapSayfaYaz(g, v.hafta) : ''
                  return (
                    <li key={g.id} className="py-[1px]">
                      <div className="flex items-baseline gap-1">
                        {saat && <span className="w-10 shrink-0 tabular-nums">{s ?? '+'}</span>}
                        <span aria-hidden className="shrink-0">☐</span>
                        <span>{g.ad}{e && e.tur !== 'tarih' && <span className={`text-[9pt] ml-1 ${e.tur === 'gecikmis' ? 'font-bold' : 'italic'}`}>({e.metin})</span>}</span>
                        <span aria-hidden className="flex-1 border-b border-dotted border-black mb-1 min-w-2" />
                        <span className="shrink-0 whitespace-nowrap">{miktarYaz(g)}</span>
                      </div>
                      {g.soruSatiri && (
                        <p className={`text-[9pt] ${saat ? 'pl-[3.75rem]' : 'pl-4'}`}>{kitap && `${kitap} · `}Çözdüm: ____ Doğru: ____</p>
                      )}
                    </li>
                  )
                })}
              </ul>
              {/* Okulda yeni verilen ödevi öğrenci kendisi yazar */}
              {[0, 1].map(k => <p key={k} className="text-[9pt] mt-0.5">Yeni ödev: ______________________ Teslim: ______</p>)}
            </section>
          )
        })}
        </div>)}
      </div>

      {/* Öğrenciye verilen kâğıt: öğretmen notu / veli imzası YOK (2026-10-24 kullanıcı; veli imzası sonuç kâğıdında) */}
      {(veri.icerik.okuma || veri.icerik.mentorOdevleri.length > 0) && <div className="text-[9.5pt] space-y-1 break-inside-avoid">
        {veri.icerik.okuma && <p><b>Okuma:</b> {veri.icerik.okuma.kitap} — okuduğun sayfaları her gün not et.</p>}
        {veri.icerik.mentorOdevleri.length > 0 && (
          <p><b>Mentör ödevleri:</b> {veri.icerik.mentorOdevleri.map(m => [m.kitapAdi, m.konu, m.sayfalar].filter(Boolean).join(' ')).join(' · ')}</p>
        )}
      </div>}

      {disarida.length > 0 && (
        <p className="text-[9.5pt] mt-1"><b>Plana girmeyen ödevler:</b> {disarida.map(o => `${dersKisa(o.subject)} — ${o.title}${o.due_date ? ` (${odevEtiketi(o.due_date, v.bugun).metin})` : ''}`).join(' · ')}</p>
      )}
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
