// src/domains/mentor/lib/bultenMath.ts
// Haftalık veli bülteni: saf hesaplar (DB yok). Spec: docs/superpowers/specs/2026-10-09-haftalik-veli-bulteni-design.md
import { addDaysISO } from '@/src/shared/date'
import type { HomeworkRecord } from '@/src/domains/homework/lib/stats'

const AY = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const GUN = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
const tarih = (iso: string) => new Date(`${iso}T12:00:00Z`)
const haftaGunu = (iso: string) => tarih(iso).getUTCDay() // 0=Pazar

export function pazartesiMi(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(tarih(iso).getTime()) && haftaGunu(iso) === 1
}

/** Cuma–Pazar → gelecek pazartesi; Pzt–Perş → bu haftanın pazartesisi. `bugun` Türkiye tarihidir (todayLocalISO). */
export function haftaSec(bugun: string): string {
  const g = haftaGunu(bugun)
  if (g === 5 || g === 6 || g === 0) return addDaysISO(bugun, g === 0 ? 1 : 8 - g)
  return addDaysISO(bugun, 1 - g)
}

export const gunAy = (iso: string) => `${tarih(iso).getUTCDate()} ${AY[tarih(iso).getUTCMonth()]}`
export const gunAdi = (iso: string) => GUN[haftaGunu(iso)]

/** Pazartesi–Cuma etiketi: "12–16 Ekim" veya "28 Eylül – 2 Ekim". */
export function haftaEtiketi(pazartesi: string): string {
  const cuma = addDaysISO(pazartesi, 4)
  const [a, b] = [tarih(pazartesi), tarih(cuma)]
  return a.getUTCMonth() === b.getUTCMonth() ? `${a.getUTCDate()}–${gunAy(cuma)}` : `${gunAy(pazartesi)} – ${gunAy(cuma)}`
}

export type Eksik = { id: string; subject: string; title: string; due_date: string; durum: 'eksik' | 'yapılmadı' }

/** Geçen hafta [P-7, P-1] kontrol edilip eksik/yapılmadı işaretlenen ödevler. Mazeretli, gec ve işaretsiz hariç. */
export function ogrenciEksikleri(kayitlar: HomeworkRecord[], pazartesi: string): Eksik[] {
  const [bas, son] = [addDaysISO(pazartesi, -7), addDaysISO(pazartesi, -1)]
  return kayitlar
    .filter(k => k.due_date !== null && k.due_date >= bas && k.due_date <= son && (k.status === 'eksik' || k.status === 'yapilmadi'))
    .map(k => ({ id: k.id, subject: k.subject, title: k.title, due_date: k.due_date as string, durum: k.status === 'eksik' ? 'eksik' as const : 'yapılmadı' as const }))
    .sort((x, y) => x.due_date.localeCompare(y.due_date) || x.subject.localeCompare(y.subject, 'tr'))
}

export type GunOdevleri = { gun: string; etiket: string; odevler: { id: string; subject: string; title: string; teacher_id: string }[] }

/** Bu hafta kontrol edilecek ödevler: Pzt–Cuma her zaman (boş gün dahil); Cmt/Paz kontrollü varsa "Hafta sonu" satırı. */
export function haftaOdevleri(kayitlar: HomeworkRecord[], pazartesi: string): GunOdevleri[] {
  const sec = (bas: string, son: string) => kayitlar
    .filter(k => k.due_date !== null && k.due_date >= bas && k.due_date <= son)
    .sort((x, y) => (x.due_date as string).localeCompare(y.due_date as string) || x.subject.localeCompare(y.subject, 'tr'))
    .map(k => ({ id: k.id, subject: k.subject, title: k.title, teacher_id: k.teacher_id }))
  const gunler: GunOdevleri[] = [0, 1, 2, 3, 4].map(i => {
    const gun = addDaysISO(pazartesi, i)
    return { gun, etiket: gunAdi(gun), odevler: sec(gun, gun) }
  })
  const hs = sec(addDaysISO(pazartesi, 5), addDaysISO(pazartesi, 6))
  if (hs.length) gunler.push({ gun: addDaysISO(pazartesi, 5), etiket: 'Hafta sonu', odevler: hs })
  return gunler
}

export type OzetSatiri = { id: string; subject: string; title: string; due_date: string; toplam: number; yapildi: number; eksik: number; yapilmadi: number }

/** Geçen haftanın her ödevi için, verilen öğrenciler arasında işaretli ve mazeretli olmayanların dağılımı (isimsiz). */
export function grupOzeti(ogrenciKayitlari: HomeworkRecord[][], pazartesi: string): OzetSatiri[] {
  const [bas, son] = [addDaysISO(pazartesi, -7), addDaysISO(pazartesi, -1)]
  const satir = new Map<string, OzetSatiri>()
  for (const k of ogrenciKayitlari.flat()) {
    if (k.due_date === null || k.due_date < bas || k.due_date > son || k.status === null || k.status === 'mazeretli') continue
    const s = satir.get(k.id) ?? { id: k.id, subject: k.subject, title: k.title, due_date: k.due_date, toplam: 0, yapildi: 0, eksik: 0, yapilmadi: 0 }
    s.toplam++
    if (k.status === 'eksik') s.eksik++
    else if (k.status === 'yapilmadi') s.yapilmadi++
    else s.yapildi++ // yapildi + gec
    satir.set(k.id, s)
  }
  return [...satir.values()].sort((x, y) => x.due_date.localeCompare(y.due_date) || x.subject.localeCompare(y.subject, 'tr'))
}

export function veliMesaji(g: { ogrenciAdi: string; sinif: string; pazartesi: string; eksikler: Eksik[]; gunler: GunOdevleri[]; mentorAdi: string }): string {
  const gecen = haftaEtiketi(addDaysISO(g.pazartesi, -7)), bu = haftaEtiketi(g.pazartesi)
  const odevSatirlari = g.gunler.flatMap(d => d.odevler.map(o =>
    `• ${d.etiket === 'Hafta sonu' ? 'Hafta sonu' : `${d.etiket} ${gunAy(d.gun)}`} – ${dersKisa(o.subject)}: ${o.title}`))
  return [
    'Sayın Velimiz,',
    `*${g.ogrenciAdi}* (${g.sinif}) için haftalık ödev bilgilendirmesi:`,
    '',
    `*Geçen hafta (${gecen}) tamamlanmayan ödevler:*`,
    ...(g.eksikler.length
      ? g.eksikler.map(e => `• ${dersKisa(e.subject)} – ${e.title} (${gunAy(e.due_date)}): ${e.durum}`)
      : ['Kontrol edilen ödevlerin tamamını yaptı. Tebrikler! 👏']),
    '',
    `*Bu hafta (${bu}) kontrol edilecek ödevler:*`,
    ...(odevSatirlari.length ? odevSatirlari : ['Kontrol edilecek ödev yok.']),
    ...(g.eksikler.length ? ['', 'Eksik ödevlerin tamamlanması için desteğinizi rica ederiz.'] : []),
    '',
    'Saygılarımızla,',
    g.mentorAdi,
    `${g.sinif} Mentör Öğretmeni`,
  ].join('\n')
}

/** TR cep numarası → "90XXXXXXXXXX"; geçersizse null. */
export function telefonNormalize(tel: string | null): string | null {
  const d = (tel ?? '').replace(/\D/g, '')
  if (/^905\d{9}$/.test(d)) return d
  if (/^05\d{9}$/.test(d)) return `9${d}`
  if (/^5\d{9}$/.test(d)) return `90${d}`
  return null
}

/** wa.me linki; numara yoksa WhatsApp kişi seçtirir. */
export function whatsappLink(metin: string, tel: string | null): string {
  const no = telefonNormalize(tel)
  return `https://wa.me/${no ?? ''}?text=${encodeURIComponent(metin)}`
}

const KISA: Record<string, string> = { 'Türk Dili ve Edebiyatı': 'Edebiyat', 'Din Kültürü ve Ahlak Bilgisi': 'Din Kültürü' }
export const dersKisa = (s: string) => KISA[s] ?? s
const RENK: Record<string, string> = {
  Matematik: '#2F6FED', Geometri: '#5B4BDB', Fizik: '#E0662E', Kimya: '#14A38B', Biyoloji: '#4CA83A', Edebiyat: '#C2417A',
  Türkçe: '#C2417A', Tarih: '#A5672B', Coğrafya: '#2A9BC1', İngilizce: '#D2463F', Almanca: '#7A7F8C', Felsefe: '#8E5BB5',
}
export const dersRengi = (s: string) => RENK[dersKisa(s)] ?? '#7A7F8C'
export const kisalt = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
