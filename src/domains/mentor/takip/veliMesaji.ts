import { haftaEtiketi } from '../lib/bultenMath'
import { ozetHesapla, programYuzde, dogrulukYuzde, fark, type HaftaVerisi, type Ozet } from './takipMath'

/** Konu haritasından veli mesajı listeleri (client + server ortak). */
export function konuAdlari(konular: { id: string; ad: string }[], durum: Record<string, number>) {
  const ad = (d: number) => konular.filter(k => durum[k.id] === d).map(k => k.ad)
  return { oturan: ad(2), calisilan: ad(1) }
}

/** Spec §5 şablonu; boş satırlar atlanır. */
export function takipVeliMesaji(g: {
  ogrenciAdi: string; pazartesi: string; veri: HaftaVerisi; onceki: Ozet | null
  konular: { oturan: string[]; calisilan: string[] }; mentorAdi: string
}): string {
  const o = ozetHesapla(g.veri.icerik), d = dogrulukYuzde(o), f = fark(o, g.onceki)
  const gk = g.veri.gorusme, ok = g.veri.icerik.okuma, mo = g.veri.icerik.mentorOdevleri
  const farkMetni = f === null || f === 0 ? '' : `, geçen haftaya göre ${Math.abs(f)} puan ${f > 0 ? 'arttı' : 'düştü'}`
  const satir = (kosul: unknown, metin: string) => (kosul ? [metin] : [])
  return [
    `Sayın Veli, ${g.ogrenciAdi} için ${haftaEtiketi(g.pazartesi)} haftasının özeti:`,
    '',
    // Görev + mentör ödevi (programYuzde): veli raporu kutusu ve Sonuç kartıyla aynı oran. İşlenmemiş hafta → satır yok.
    ...satir(o.islendi && o.gorev_toplam, `• Program: ${o.gorev_toplam} görevin ${o.gorev_yapilan} tanesini tamamladı (%${programYuzde(o)}).`),
    ...satir(o.soru, `• Soru: ${o.soru} soru çözdü (hedef ${g.veri.soruHedefi}), doğruluk %${d}${farkMetni}.`),
    ...satir(mo.length, `• Ekstra ödevler: ${mo.length} ödevin ${mo.filter(m => m.yapti).length} tanesi yapıldı.`),
    ...satir(ok && (ok.sayfa || ok.bitti), ok?.bitti ? `• Okuma: ${ok.kitap} kitabını bitirdi${ok.sayfa ? ` (bu hafta ${ok.sayfa} sayfa)` : ''}.` : `• Okuma: ${ok?.kitap} kitabından ${ok?.sayfa} sayfa okudu.`),
    ...satir(g.konular.oturan.length, `• Oturan konular: ${g.konular.oturan.join(', ')}`),
    ...satir(g.konular.calisilan.length, `• Üzerinde çalıştığımız konular: ${g.konular.calisilan.join(', ')}`),
    ...satir(gk.iyi.trim(), `• İyi giden: ${gk.iyi.trim()}`),
    ...satir(gk.zor.trim(), `• Zorlandığı yer: ${gk.zor.trim()}`),
    ...satir(gk.hedef.trim(), `• Gelecek hafta için kendi koyduğu hedef: “${gk.hedef.trim()}”`),
    ...satir(gk.odak.trim(), `• Gelecek haftanın odağı: ${gk.odak.trim()}`),
    ...satir(gk.evde.trim(), `\nEvde sizden ricam: ${gk.evde.trim()}`),
    '',
    'İlginiz için teşekkür ederim.',
    g.mentorAdi,
  ].join('\n')
}
