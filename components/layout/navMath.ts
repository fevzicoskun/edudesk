import type { Role } from '@/src/shared/types'

/**
 * Menü yerleşiminin saf mantığı — Sidebar'dan ayrı test edilebilsin diye burada.
 *
 * 'gunluk' = her gün açılan ekranlar, menünün başında durur.
 * 'diger'  = ara sıra gereken ekranlar, katlanır grupta. Hiçbiri KALDIRILMAZ.
 */
export type NavGrup = 'gunluk' | 'diger'

export type NavKayit = {
  href: string
  label: string
  /** Mobil alt barda yer isteyen giriş (yer kalmazsa çekmeceye düşer) */
  mobile: boolean
  roles: Role[] | null
  grup: NavGrup
  /** Yalnız en az bir mentörlük öğrencisi olan kullanıcıda görünür (Mentörlük) */
  yalnizMentor?: boolean
  /** Yalnız okulun yoklama modülü açıkken görünür (Yoklama, Devamsızlık Raporu) */
  yalnizYoklama?: boolean
}

/** yoklamaAktif varsayılan true: okul ayarı bilinmiyorsa eski davranış */
export type NavSecenek = { mentorMu?: boolean; yoklamaAktif?: boolean }

/** Mobil alt bardaki toplam yuva sayısı — 5. yuva çekmece varsa "Daha Fazla"ya ayrılır */
const MOBIL_YUVA = 5

export function gorunurNav<T extends Pick<NavKayit, 'roles' | 'yalnizMentor' | 'yalnizYoklama'>>(
  items: T[],
  role: Role | undefined,
  { mentorMu = false, yoklamaAktif = true }: NavSecenek = {},
): T[] {
  return items.filter(item =>
    (!item.roles || (!!role && item.roles.includes(role)))
    && (!item.yalnizMentor || mentorMu)
    && (!item.yalnizYoklama || yoklamaAktif))
}

export function gruplaNav<T extends Pick<NavKayit, 'grup'>>(items: T[]): { gunluk: T[]; diger: T[] } {
  return {
    gunluk: items.filter(i => i.grup === 'gunluk'),
    diger:  items.filter(i => i.grup !== 'gunluk'),
  }
}

/**
 * Mobil alt bar ile çekmecenin paylaşımı.
 * Alt bara sığmayan mobil girişler çekmeceye eklenir — aksi halde menüden
 * tamamen kaybolurlardı (Sınıflar'ın başına gelen buydu).
 */
export function mobilNavSec<T extends Pick<NavKayit, 'mobile' | 'roles' | 'yalnizMentor' | 'yalnizYoklama'>>(
  items: T[],
  role: Role | undefined,
  secenek: NavSecenek = {},
): { altBar: T[]; drawer: T[] } {
  const gorunur = gorunurNav(items, role, secenek)
  const mobilAdaylar = gorunur.filter(i => i.mobile)
  const digerleri    = gorunur.filter(i => !i.mobile)

  const cekmeceVar = digerleri.length > 0
  const yuva       = cekmeceVar ? MOBIL_YUVA - 1 : MOBIL_YUVA

  return {
    altBar: mobilAdaylar.slice(0, yuva),
    drawer: [...mobilAdaylar.slice(yuva), ...digerleri],
  }
}

/**
 * Aktif menü bağlantısı: pathname'i segment sınırında kapsayan EN UZUN href.
 * /yonetim/odevler açıkken /yonetim de yanmasın diye — çağıran TÜM menüyü verir (alt bar + çekmece ortak).
 */
export function aktifHref(pathname: string, hrefs: string[]): string | null {
  let enIyi: string | null = null
  for (const h of hrefs) {
    if ((pathname === h || pathname.startsWith(h + '/')) && h.length > (enIyi?.length ?? 0)) enIyi = h
  }
  return enIyi
}
