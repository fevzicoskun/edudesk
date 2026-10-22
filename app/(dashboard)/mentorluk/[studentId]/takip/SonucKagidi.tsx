import { kaldigiMetni, ozetHesapla, programYuzde, dogrulukYuzde, sonucSatirlari, ekranYaz, haftaKaydir, type HaftaVerisi, type Icerik, type OkulOdevi, type Ozet, takipHaftaEtiketi } from '@/src/domains/mentor/takip/takipMath'
import { dersKisa } from '@/src/domains/mentor/lib/bultenMath'
import type { SayfaVerisi } from '@/src/domains/mentor/services/TakipService'

// ── Ayarlar (veliye giden sonuç kâğıdı, 2026-10-22) ──────────────────────────────
/** Durum etiketi (durumYuzdesi): ≥ IYI → iyi, ≥ ORTA → orta, altı → düşük. Kırmızı yok, dil yumuşak. */
export const DURUM_ESIKLERI = { IYI: 80, ORTA: 50 } as const
export const DURUM_ETIKETLERI = { iyi: 'İyi gidiyor', orta: 'Gelişmeli', dusuk: 'Birlikte takip edelim' } as const
export const BOS_HAFTA_METNI = 'Bu hafta için henüz sonuç girilmedi.'
/** Dersin öğretmeni henüz işaretlemediği okul ödevi ("Bekliyor" veliye "çocuk yapmadı" gibi okunuyordu). */
export const KONTROLDE_METNI = 'Öğretmen kontrolünde'
/** Öğretmen notunun altında veliye dönük tek satır ("benden ne bekleniyor?"); kayıtlı rica yoksa elle yazılır. */
export const RICA_BASLIGI = 'Evde sizden ricamız:'
/** Geçen haftaya göre program artışı bu kadar puandan azsa yazılmaz (1–2 puan oynama gürültüdür). */
export const KIYAS_PROGRAM_ESIGI = 5
/** Tek A4 sınırları: fazlası "+ x ödev daha" olur. */
export const ONCEKI_ODEV_SINIRI = 5
export const BU_HAFTA_ODEV_SINIRI = 8
export const AKSAYAN_SINIRI = 3
/** Satır yükü bunu aşınca yazı 11pt → 10pt, boşluklar daralır (gövde 10pt altına inmez). */
export const SIKI_YUK_ESIGI = 14
/** "Bu rapor anlaşılır mıydı?" satırı; false → bölüm tamamen kalkar. */
export const VELI_GERI_BILDIRIM_GOSTER = true

// ── Türkçe sayı ekleri: "%72'sini", "27'si", "3'ünde" — ek sayının okunuşundaki son kelimeye uyar ──
const BIRLER = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz']
const ONLAR = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan']
const UNLU = 'aeıioöuü'
// ponytail: 1000'in katları "bin" sayılır; milyon ölçeğinde sayı bu kâğıda gelmez
const sonKelime = (n: number) => {
  n = Math.abs(Math.trunc(n))
  return n === 0 ? 'sıfır' : n % 10 ? BIRLER[n % 10] : n % 100 ? ONLAR[Math.floor(n / 10) % 10] : n % 1000 ? 'yüz' : 'bin'
}
/** 3. tekil iyelik (+ belirtme "sini" / bulunma "sinde") eki, kesme işaretiyle: 72 → "72'sini". */
export function sayiEk(n: number, ek: 'si' | 'sini' | 'sinde'): string {
  const k = sonKelime(n)
  const son = [...k].reverse().find(c => UNLU.includes(c))!
  const v = ({ a: 'ı', ı: 'ı', e: 'i', i: 'i', o: 'u', u: 'u', ö: 'ü', ü: 'ü' } as Record<string, string>)[son]
  const iyelik = (UNLU.includes(k.at(-1)!) ? 's' : '') + v
  return `${n}'${iyelik}${ek === 'sini' ? `n${v}` : ek === 'sinde' ? `nd${'ıu'.includes(v) ? 'a' : 'e'}` : ''}`
}

export type Durum = keyof typeof DURUM_ETIKETLERI
/** Etiketin dayandığı yüzde: program tamamlama ile soru hedefine ulaşmanın DÜŞÜĞÜ (2026-10-22 veli gözü:
 *  "%97 program, 40/200 soru" haftası "İyi gidiyor" diyordu). Hedef aşımı 100'de kapanır; ölçü yoksa null.
 *  soru null = sonuç hiç girilmedi → yalnız program (girilmemiş soru %0 sayılmaz). */
export function durumYuzdesi(program: number | null, soru: number | null, hedef: number): number | null {
  const olculer = [...(program === null ? [] : [program]), ...(soru !== null && hedef > 0 ? [Math.min(100, Math.round((soru / hedef) * 100))] : [])]
  return olculer.length ? Math.min(...olculer) : null
}
export const durumOf = (yuzde: number): Durum => (yuzde >= DURUM_ESIKLERI.IYI ? 'iyi' : yuzde >= DURUM_ESIKLERI.ORTA ? 'orta' : 'dusuk')

/** "Beren bu hafta programın %72'sini tamamladı ve 96 soru çözdü (hedef 120), doğruluk %78." */
export function ozetCumlesi(ad: string, program: number | null, soru: number | null, hedef: number, dogruluk: number | null): string {
  const parca = [...(program === null ? [] : [`programın %${sayiEk(program, 'sini')} tamamladı`]),
    ...(soru === null ? [] : [`${soru} soru çözdü${hedef ? ` (hedef ${hedef})` : ''}`])]
  if (parca.length === 0) return BOS_HAFTA_METNI
  return `${ad} bu hafta ${parca.join(' ve ')}${dogruluk === null ? '' : `, doğruluk %${dogruluk}`}.`
}

/** Soru sonucu girildi mi (çözülen 0 dahil)? Girilmemiş soru kâğıtta "0" gibi basılmaz (2026-10-22 veli gözü).
 *  Eski kayıtlar görev bazlı soru taşır (2026-10-17 öncesi) — ozetHesapla ile aynı iki kaynak. */
export const soruGirildi = (ic: Pick<Icerik, 'gorevler' | 'sonuclar'>) =>
  (ic.sonuclar ?? []).some(s => s.cozulen !== null) || ic.gorevler.some(g => g.soruSatiri && g.soru !== null)

/** Geçen haftayla kıyas — YALNIZ İYİLEŞME yazılır, gerileme kâğıda girmez (2026-10-22 kullanıcı kararı a).
 *  Soru artışı (somut sayı) önce; yoksa program en az KIYAS_PROGRAM_ESIGI puan arttıysa sayısız cümle. */
export function gecenHaftaKiyasi(bu: Ozet, onceki: Ozet): string | null {
  if (!onceki.islendi) return null
  if (bu.soru > onceki.soru) return `Geçen haftaya göre ${bu.soru - onceki.soru} soru daha fazla çözdü.`
  const a = programYuzde(bu), b = programYuzde(onceki)
  return a !== null && b !== null && a - b >= KIYAS_PROGRAM_ESIGI ? 'Geçen haftaya göre programa daha çok uydu.' : null
}

/** Görev adının sade grubu: "Tatil: Kitap okuma (en az 20 sayfa)" → "Kitap okuma"; "İngilizce — Workbook s. 18" → "İngilizce". */
export function gorevGrubu(ad: string): string {
  let s = ad.replace(/\([^)]*\)/g, ' ')
  if (s.trimStart().toLocaleLowerCase('tr-TR').startsWith('tatil:')) s = s.slice(s.indexOf(':') + 1)
  s = s.split(/\s[—–]\s|:/)[0].replace(/\s+/g, ' ').trim()
  return s || ad.trim()
}

export type Aksayan = { ad: string; toplam: number; yapilan: number; gunler: number }
/** Aynı görevler gruplanır (tr-TR küçük harf), yapılma oranı en düşük `sinir` grup. `gun` yoksa (mentör ödevi) gün sayılmaz. */
export function aksayanlar(isler: { ad: string; yapti: boolean; gun?: number }[], sinir = AKSAYAN_SINIRI): Aksayan[] {
  const m = new Map<string, Aksayan & { g: Set<number> }>()
  for (const x of isler) {
    const ad = gorevGrubu(x.ad), k = ad.toLocaleLowerCase('tr-TR')
    const a = m.get(k) ?? { ad, toplam: 0, yapilan: 0, gunler: 0, g: new Set<number>() }
    a.toplam++; if (x.yapti) a.yapilan++; if (x.gun !== undefined) a.g.add(x.gun)
    m.set(k, a)
  }
  return [...m.values()].filter(a => a.yapilan < a.toplam)
    .sort((a, b) => a.yapilan / a.toplam - b.yapilan / b.toplam || b.toplam - a.toplam)
    .slice(0, sinir).map(({ g, ...a }) => ({ ...a, gunler: g.size }))
}
/** Her gün bir kez yapılan görev gün diliyle ("7 günün 3'ünde yapıldı"), değilse görev sayısıyla. */
export function aksayanMetni(a: Aksayan): string {
  const gunluk = a.gunler === a.toplam
  if (a.toplam === 1) return 'yapılmadı'
  if (a.yapilan === 0) return gunluk ? `${a.toplam} günün hiçbirinde yapılmadı` : `${a.toplam} görevin hiçbiri yapılmadı`
  return gunluk ? `${a.toplam} günün ${sayiEk(a.yapilan, 'sinde')} yapıldı` : `${a.toplam} görevin ${sayiEk(a.yapilan, 'si')} yapıldı`
}

// ── Görünüm ─────────────────────────────────────────────────────────────────────
const ROZET: Record<Durum, [string, string]> = {
  iyi: ['✔', 'bg-green-50 text-green-800 border-green-300'],
  orta: ['●', 'bg-yellow-50 text-yellow-900 border-yellow-300'],
  dusuk: ['▲', 'bg-orange-50 text-orange-900 border-orange-300'],
}
const yapildiMi = (o: OkulOdevi) => o.status === 'yapildi' || o.status === 'gec'
/** Okul ödevleri kartı: payda yalnız öğretmenin işaretledikleri — işaretlenmemiş ödev "yapılmadı" gibi sayılmaz. */
export function okulOdevKarti(liste: OkulOdevi[]): { deger: string; not: string | null } {
  const isaretli = liste.filter(o => o.status), kontrolde = liste.length - isaretli.length
  if (isaretli.length === 0) return { deger: `${liste.length} ödev`, not: KONTROLDE_METNI }
  return { deger: `${isaretli.filter(yapildiMi).length} / ${isaretli.length} yapıldı`, not: kontrolde ? `${kontrolde} ödev öğretmen kontrolünde` : null }
}
const tarih = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`
// Renk tek başına anlam taşımaz: her durumda ikon + metin (siyah-beyaz baskı)
function OdevDurumu({ o }: { o: OkulOdevi }) {
  if (yapildiMi(o)) return <span className="text-green-800">✔ Yapıldı{o.status === 'gec' && ' (geç)'}</span>
  if (o.status === 'yapilmadi') return <span className="text-orange-800">✖ Yapılmadı</span>
  if (!o.status) return <span className="text-gray-600">{KONTROLDE_METNI}</span>
  return <span className="text-gray-700">{o.status === 'eksik' ? 'Eksik' : o.status === 'mazeretli' ? 'Mazeretli' : o.status}</span>
}
const Daha = ({ n }: { n: number }) => (n > 0 ? <p className="text-gray-600 mt-0.5">+ {n} ödev daha</p> : null)

/** Veliye giden tek A4 haftalık sonuç (2026-10-22 yeniden tasarım): 5 saniyede "hafta nasıl geçti, benden ne bekleniyor?". */
export default function SonucKagidi({ v, veri }: { v: SayfaVerisi; veri: HaftaVerisi }) {
  const ic = veri.icerik
  const o = ozetHesapla(ic)
  const p = programYuzde(o), d = dogrulukYuzde(o)
  const sg = soruGirildi(ic)
  const soru = sg ? o.soru : null // null: girilmedi (0 değil)
  const hicVeri = o.gorev_yapilan === 0 && !sg
  // Yalnız hemen önceki hafta "geçen hafta"dır: arada kayıtsız hafta varsa kıyas yok
  const kiyas = !hicVeri && v.onceki && v.onceki.hafta === haftaKaydir(v.hafta, -1) ? gecenHaftaKiyasi(o, v.onceki.ozet) : null
  const parcalar = v.ogrenci.ad.trim().split(/\s+/)
  const ad = parcalar.length > 1 ? parcalar.slice(0, -1).join(' ') : parcalar[0] // soyadı düşer: "Ali Kemal"
  const satirlar = sonucSatirlari(ic, v.kitaplar).filter(s => (s.cozulen ?? 0) > 0)
  // Okul ödevi görevleri aşağıdaki okul ödevleri tablosunda; aksayanlarda tekrar edilmez
  const aksayan = aksayanlar([
    ...ic.gorevler.filter(g => !g.odevId).map(g => ({ ad: g.ad, yapti: g.yapti, gun: g.gun })),
    ...ic.mentorOdevleri.map(m => ({ ad: 'Mentör ödevleri', yapti: m.yapti })),
  ])
  const buHafta = v.okulOdevleri.buHafta, onceki = v.okulOdevleri.tamamlanmamis
  const not = veri.gorusme.not.trim(), rica = veri.gorusme.rica.trim()
  const notSatir = Math.ceil(not.length / 90) + Math.max(1, Math.ceil(rica.length / 90)) // rica satırı boşken de yer tutar
  // ponytail: kaba satır yükü sezgisi (soru tablosu görevlerle yan yana); 10+ kitaplı ağır haftada yine taşabilir → o zaman ölç
  const yuk = Math.max(satirlar.length, 4) + Math.min(buHafta.length, BU_HAFTA_ODEV_SINIRI + 1)
    + Math.min(onceki.length, ONCEKI_ODEV_SINIRI + 1) * 0.75 + notSatir
  const siki = yuk > SIKI_YUK_ESIGI
  const ara = siki ? 'mb-2' : 'mb-3.5'
  const hucre = siki ? 'px-1.5 py-0.5' : 'px-2 py-1'
  const th = `${hucre} text-left font-semibold text-gray-600 border-b border-gray-300`
  const td = `${hucre} border-b border-gray-200 align-top`
  const baslik = 'font-bold text-[1.1em] mb-1'
  const ekran = ic.ekranSuresi

  const okulKart = okulOdevKarti(buHafta)
  const kartlar: [string, string, (string | null)?][] = [
    ...(o.gorev_toplam ? [['Program', hicVeri ? 'Girilmedi' : `${o.gorev_yapilan} / ${o.gorev_toplam} görev`] as [string, string]] : []),
    soru === null ? ['Soru', 'Girilmedi', `hedef ${veri.soruHedefi}`] : ['Soru', `${soru} / hedef ${veri.soruHedefi}`],
    ...(ic.okuma?.sayfa != null ? [['Okuma', `${ic.okuma.sayfa} sayfa`] as [string, string]] : []),
    ...(buHafta.length ? [['Okul ödevleri', okulKart.deger, okulKart.not] as [string, string, string | null]] : []),
    ['Ekran süresi', ekran == null ? 'Girilmedi' : `${ekranYaz(ekran)} saat / gün`],
  ]
  const dy = durumYuzdesi(p, soru, veri.soruHedefi)
  const durum = dy === null ? null : durumOf(dy)

  return (
    <article className={`${siki ? 'text-[10pt]' : 'text-[11pt]'} leading-snug text-gray-900 bg-white`}>
      {/* header/footer etiketi DEĞİL: globals.css baskıda header'ları gizler */}
      <div className={`border-b border-gray-300 pb-2 ${ara}`}>
        <div className="flex justify-between items-center gap-3 text-[10pt] text-gray-600">
          <span className="flex items-center gap-2">
            {/* ponytail: tek okul → logo sabit dosya (components/Filigran.tsx ile aynı) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/filigran.png" alt="" className="h-8 w-auto" />
            {v.okulAdi}
          </span>
          <span className="font-semibold text-gray-800 whitespace-nowrap">{takipHaftaEtiketi(v.hafta)}</span>
        </div>
        <h1 className={`${siki ? 'text-[18pt]' : 'text-[21pt]'} font-extrabold tracking-wide uppercase leading-tight mt-1`}>Haftalık Sonuç</h1>
        <p className="text-[13pt] font-semibold">{v.ogrenci.ad} · {v.ogrenci.sinifAdi}</p>
        {v.mentorAdi && <p className="text-[10pt] text-gray-700">Mentör öğretmen: {v.mentorAdi}</p>}
      </div>

      <section aria-label="Haftanın özeti" className={`flex items-center gap-3 border-2 border-gray-300 rounded-lg ${siki ? 'p-2' : 'p-3'} ${ara}`}>
        <p className="flex-1 text-[1.15em] font-semibold">{hicVeri ? BOS_HAFTA_METNI : ozetCumlesi(ad, p, soru, veri.soruHedefi, d)}{kiyas && ` ${kiyas}`}</p>
        {!hicVeri && durum && (
          <span className={`shrink-0 whitespace-nowrap border rounded-full px-3 py-1 font-bold ${ROZET[durum][1]}`}>
            {ROZET[durum][0]} {DURUM_ETIKETLERI[durum]}
          </span>
        )}
      </section>

      <div aria-label="Özet" className={`grid grid-flow-col auto-cols-fr gap-2 ${ara}`}>
        {kartlar.map(([b, x, not]) => (
          <div key={b} className="border border-gray-200 rounded-md px-2 py-1">
            <p className="text-[0.8em] text-gray-600">{b}</p>
            <p className="font-bold">{x}</p>
            {not && <p className="text-[0.8em] text-gray-600 leading-tight">{not}</p>}
          </div>
        ))}
      </div>

      <div className={`grid grid-cols-2 gap-4 items-start ${ara}`}>
        <section aria-label="Soru sonuçları" className="break-inside-avoid">
          <h2 className={baslik}>Sorular</h2>
          {satirlar.length === 0 ? <p className="text-gray-600">Bu hafta soru sonucu girilmedi.</p> : (
            <table aria-label="Soru sonuçları" className="w-full border-collapse">
              <thead><tr>{['Ders', 'Çözülen', 'Doğru', 'Yanlış'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>{satirlar.map(s => (
                <tr key={s.anahtar} className="break-inside-avoid">
                  <td className={td}>{s.ad}{s.ders !== s.ad && ` · ${s.ders}`}{kaldigiMetni(s) && <span className="block text-[0.85em] text-gray-600">{kaldigiMetni(s)}</span>}</td>
                  <td className={td}>{s.cozulen}</td><td className={td}>{s.dogru ?? ''}</td><td className={td}>{s.yanlis ?? ''}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </section>

        <section aria-label="Görevler" className="break-inside-avoid">
          <h2 className={baslik}>Görevler</h2>
          {o.gorev_toplam === 0 ? <p className="text-gray-600">Bu hafta programda görev yoktu.</p>
            : hicVeri ? <p>Bu hafta programda {o.gorev_toplam} görev vardı.</p>
              : o.gorev_yapilan === o.gorev_toplam ? <p>Tüm görevler tamamlandı.</p> : <>
                <p>{o.gorev_toplam} görevden {sayiEk(o.gorev_yapilan, 'si')} tamamlandı.</p>
                {aksayan.length > 0 && <>
                  <p className="font-semibold mt-1.5">En çok aksayanlar</p>
                  <ul aria-label="En çok aksayanlar" className="list-disc pl-5">
                    {aksayan.map(a => <li key={a.ad}>{a.ad} — {aksayanMetni(a)}</li>)}
                  </ul>
                </>}
              </>}
        </section>
      </div>

      {buHafta.length > 0 && (
        <section aria-label="Okul ödevleri" className={ara}>
          <h2 className={baslik}>Bu haftanın okul ödevleri</h2>
          <table aria-label="Bu haftanın okul ödevleri" className="w-full border-collapse">
            <thead><tr>{['Ders', 'Ödev', 'Teslim', 'Durum'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{buHafta.slice(0, BU_HAFTA_ODEV_SINIRI).map(x => (
              <tr key={x.id} className="break-inside-avoid">
                <td className={`${td} whitespace-nowrap`}>{dersKisa(x.subject)}</td><td className={td}>{x.title}</td>
                <td className={`${td} whitespace-nowrap`}>{tarih(x.due_date)}</td><td className={`${td} whitespace-nowrap`}><OdevDurumu o={x} /></td>
              </tr>
            ))}</tbody>
          </table>
          <Daha n={buHafta.length - BU_HAFTA_ODEV_SINIRI} />
        </section>
      )}

      {onceki.length > 0 && (
        <section aria-label="Önceki haftalardan kalan ödevler" className={`break-inside-avoid bg-orange-50 border border-orange-200 rounded-md px-3 py-2 ${ara}`}>
          <h2 className="font-bold mb-0.5">Önceki haftalardan kalan ödevler ({onceki.length})</h2>
          <ul className="text-[0.95em]">
            {onceki.slice(0, ONCEKI_ODEV_SINIRI).map(x => <li key={x.id}>{dersKisa(x.subject)} – {x.title} <span className="whitespace-nowrap">({tarih(x.due_date)})</span></li>)}
          </ul>
          <Daha n={onceki.length - ONCEKI_ODEV_SINIRI} />
        </section>
      )}

      <section aria-label="Öğretmen notu" className={`break-inside-avoid border border-gray-300 rounded-md px-3 py-2 ${ara}`}>
        <h2 className="font-bold">Öğretmen notu</h2>
        {not && <p className="whitespace-pre-line">{not}</p>}
        <div className="grid grid-cols-2 gap-4 mt-1">
          {['Bu hafta güçlü yanı:', 'Gelecek hafta odak:'].map(b => (
            <div key={b}>
              <p className="font-semibold text-gray-700">{b}</p>
              {[0, 1].map(k => <div key={k} className={`border-b border-gray-300 ${siki ? 'h-5' : 'h-6'}`} />)}
            </div>
          ))}
        </div>
        {/* Veliye dönük satır (2026-10-22 veli gözü): kayıtlı "Veliden ricam" metni ya da elle yazmak için çizgi */}
        <div role="group" aria-label="Evde sizden ricamız" className={`mt-2 ${rica ? '' : 'flex items-end gap-2'}`}>
          <b className="shrink-0">{RICA_BASLIGI}</b>
          {rica ? <span className="whitespace-pre-line"> {rica}</span>
            : <span data-cizgi aria-hidden className={`flex-1 border-b border-gray-300 ${siki ? 'h-5' : 'h-6'}`} />}
        </div>
      </section>

      {VELI_GERI_BILDIRIM_GOSTER && (
        <section aria-label="Veli geri bildirimi" className="break-inside-avoid text-[10pt] text-gray-700 mb-2">
          <p>Bu rapor anlaşılır mıydı? <span className="ml-3">☐ Evet</span><span className="ml-3">☐ Kısmen</span><span className="ml-3">☐ Hayır</span></p>
          <p className="mt-1">Eklemek istedikleriniz: ______________________________________________</p>
        </section>
      )}

      <div role="group" aria-label="İmzalar" className="flex justify-between gap-4 mt-3 break-inside-avoid">
        <span>Mentör imzası: _______________</span>
        <span>Veli imzası: _______________</span>
        <span>Tarih: ____________</span>
      </div>
    </article>
  )
}
