// src/domains/bireyselOdev/services/BireyselOdevService.ts
import { requireAbility } from '@/src/shared/authorization/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { isTeachingRole } from '@/src/shared/types'
import { BireyselOdevRepository as R } from '../repositories/BireyselOdevRepository'
import { ekleSema, duzenleSema, type BireyselOdev } from '../lib/liste'

type Satir = Awaited<ReturnType<typeof R.ogrencinin>>[number]
const cevir = (s: Satir): BireyselOdev => {
  const o = s.students as unknown as { full_name: string; class_id: string; classes: { name: string } | null }
  return {
    id: s.id, ogrenciId: s.ogrenci_id, ogrenciAd: o.full_name, sinifId: o.class_id, sinifAd: o.classes?.name ?? '—',
    aciklama: s.aciklama, teslimTarihi: s.teslim_tarihi, yapildi: s.yapildi, yapildiTarihi: s.yapildi_tarihi, olusturmaTarihi: s.olusturma_tarihi,
  }
}

const YETKISIZ = 'Bireysel ödevi yalnız öğretmenler kullanabilir.'

/** Yalnız öğretmen rolleri (ogretmen, zümre başkanı); sahiplik RLS'te (ogretmen_id = auth.uid()). */
async function yetki() {
  const ab = await requireAbility()
  const profil = await getCurrentProfile()
  return profil && isTeachingRole(profil.role) ? ab : null
}

export const BireyselOdevService = {
  /** Öğretmenin verdiği bütün bireysel ödevler; rol uygun değilse null. */
  async liste(): Promise<BireyselOdev[] | null> {
    const ab = await yetki()
    if (!ab) return null
    return (await R.ogretmenin(ab.userId, ab.schoolId)).map(s => cevir(s as Satir))
  },

  /** Öğrenci sayfası: bu öğretmenin bu öğrenciye verdikleri, yeniden eskiye. */
  async ogrenciListesi(ogrenciId: string): Promise<BireyselOdev[] | null> {
    const ab = await yetki()
    if (!ab) return null
    return (await R.ogrencinin(ab.userId, ab.schoolId, ogrenciId)).map(cevir)
  },

  async ekle(girdi: unknown): Promise<{ error?: string; ogrenciId?: string }> {
    const p = ekleSema.safeParse(girdi)
    if (!p.success) return { error: p.error.issues[0]?.message ?? 'Geçersiz veri' }
    const ab = await yetki()
    if (!ab) return { error: YETKISIZ }
    if (!(await R.ogrenciVarMi(ab.schoolId, p.data.ogrenciId))) return { error: 'Öğrenci bulunamadı.' }
    await R.ekle({ school_id: ab.schoolId, ogrenci_id: p.data.ogrenciId, ogretmen_id: ab.userId, aciklama: p.data.aciklama, teslim_tarihi: p.data.teslimTarihi })
    return { ogrenciId: p.data.ogrenciId }
  },

  async duzenle(girdi: unknown): Promise<{ error?: string; ogrenciId?: string }> {
    const p = duzenleSema.safeParse(girdi)
    if (!p.success) return { error: p.error.issues[0]?.message ?? 'Geçersiz veri' }
    const ab = await yetki()
    if (!ab) return { error: YETKISIZ }
    const r = await R.guncelle(p.data.id, ab.userId, { aciklama: p.data.aciklama, teslim_tarihi: p.data.teslimTarihi })
    return r.length ? { ogrenciId: r[0].ogrenci_id } : { error: 'Kayıt bulunamadı.' }
  },

  /** Tek tık yapıldı / geri al. */
  async yapildi(id: string, yapildi: boolean): Promise<{ error?: string; ogrenciId?: string }> {
    const ab = await yetki()
    if (!ab) return { error: YETKISIZ }
    const r = await R.guncelle(id, ab.userId, { yapildi, yapildi_tarihi: yapildi ? new Date().toISOString() : null })
    return r.length ? { ogrenciId: r[0].ogrenci_id } : { error: 'Kayıt bulunamadı.' }
  },

  async sil(id: string): Promise<{ error?: string; ogrenciId?: string }> {
    const ab = await yetki()
    if (!ab) return { error: YETKISIZ }
    const r = await R.sil(id, ab.userId)
    return r.length ? { ogrenciId: r[0].ogrenci_id } : { error: 'Kayıt bulunamadı.' }
  },
}
