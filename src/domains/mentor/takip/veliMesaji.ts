import {
  ozetHesapla, programYuzde, dogrulukYuzde, sonucSatirlari, dersDogruluk, kaldigiMetni, takipHaftaEtiketi, ekranYaz,
  type HaftaVerisi, type Ozet, type OkulOdevBolumleri, type OkulOdevi,
} from './takipMath'

const YAPILDI = new Set(['yapildi', 'gec'])
/** Ödev her yerde dersiyle ("Fizik – Kondisyon Sy 13-22"). En fazla 3 ad; kalan "ve N ödev daha" — WhatsApp'ta mesaj kısa kalsın. */
const adlar = (liste: OkulOdevi[]) =>
  liste.slice(0, 3).map(o => `${o.subject} – ${o.title}`).join(', ') + (liste.length > 3 ? ` ve ${liste.length - 3} ödev daha` : '')

/** Haftanın verisinden otomatik veli mesajı (madde işaretli, ~10 satır). Mentör düzenlerse gorusme.veliMesaji'de saklanır. */
export function takipVeliMesaji(g: {
  ogrenciAdi: string; pazartesi: string; veri: HaftaVerisi; onceki: Ozet | null
  okul: OkulOdevBolumleri; kitaplar: { id: string; ders: string }[]; mentorAdi: string
}): string {
  const o = ozetHesapla(g.veri.icerik), d = dogrulukYuzde(o)
  const oncekiD = g.onceki?.islendi ? dogrulukYuzde(g.onceki) : null
  const satirlar = sonucSatirlari(g.veri.icerik, g.kitaplar)
  const dersler = dersDogruluk(satirlar)
  const geride = satirlar.flatMap(s => (kaldigiMetni(s) ? [`${s.ad} ${kaldigiMetni(s)}`] : []))
  const bu = g.okul.buHafta
  const yapilan = bu.filter(x => x.status && YAPILDI.has(x.status)).length
  const yapilmayan = bu.filter(x => x.status === 'yapilmadi')
  const isaretsiz = bu.filter(x => !x.status).length
  const { not, rica } = g.veri.gorusme
  const ekran = g.veri.icerik.ekranSuresi
  const satir = (kosul: unknown, metin: string) => (kosul ? [metin] : [])
  return [
    `Sayın Veli, ${g.ogrenciAdi} için ${takipHaftaEtiketi(g.pazartesi)} haftasının özeti:`,
    ...satir(bu.length, `• Okul ödevleri: ${yapilan}/${bu.length} yapıldı`
      + (isaretsiz ? `, ${isaretsiz} tanesi henüz kontrol edilmedi` : '') + '.'
      + (yapilmayan.length ? ` Yapılmayan: ${adlar(yapilmayan)}` : '')),
    ...satir(g.okul.tamamlanmamis.length, `• Önceki haftalardan tamamlanmamış: ${adlar(g.okul.tamamlanmamis)}`),
    // İşlenmemiş hafta (hiç ✓/sonuç yok) → "%0" yazılmaz
    ...satir(o.islendi && o.gorev_toplam, `• Program: %${programYuzde(o)} (${o.gorev_yapilan}/${o.gorev_toplam} görev)`),
    ...satir(o.soru, `• Soru: ${o.soru} soru, doğruluk %${d}${oncekiD !== null ? ` (geçen hafta %${oncekiD})` : ''}`),
    ...satir(dersler.length, `• Ders bazında: ${dersler.map(x => `${x.ders} %${x.yuzde}`).join(' · ')}`),
    ...satir(geride.length, `• Kaynaklar: ${geride.join('; ')}`),
    ...satir(ekran != null, `• Ekran süresi: günlük ort. ${ekranYaz(ekran ?? 0)} saat`),
    ...satir(not.trim(), `• Öğretmen notu: ${not.trim()}`),
    ...satir(rica.trim(), `• Sizden ricam: ${rica.trim()}`),
    '',
    g.mentorAdi,
  ].join('\n')
}
