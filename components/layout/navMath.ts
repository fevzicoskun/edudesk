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
}

/** Mobil alt bardaki toplam yuva sayısı — 5. yuva çekmece varsa "Daha Fazla"ya ayrılır */
const MOBIL_YUVA = 5

export function gorunurNav<T extends Pick<NavKayit, 'roles'>>(
  items: T[],
  role: Role | undefined,
): T[] {
  return items.filter(item => !item.roles || (!!role && item.roles.includes(role)))
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
export function mobilNavSec<T extends Pick<NavKayit, 'mobile' | 'roles'>>(
  items: T[],
  role: Role | undefined,
): { altBar: T[]; drawer: T[] } {
  const gorunur = gorunurNav(items, role)
  const mobilAdaylar = gorunur.filter(i => i.mobile)
  const digerleri    = gorunur.filter(i => !i.mobile)

  const cekmeceVar = digerleri.length > 0
  const yuva       = cekmeceVar ? MOBIL_YUVA - 1 : MOBIL_YUVA

  return {
    altBar: mobilAdaylar.slice(0, yuva),
    drawer: [...mobilAdaylar.slice(yuva), ...digerleri],
  }
}
