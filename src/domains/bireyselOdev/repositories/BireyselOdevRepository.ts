// src/domains/bireyselOdev/repositories/BireyselOdevRepository.ts
import { createClient } from '@/src/infrastructure/supabase/server'
import { fetchAll } from '@/src/shared/utils/fetchAll'

// Öğrenci adı ve sınıfı için join; silinmiş öğrencinin kaydı listelerde görünmez
const ALANLAR = 'id, ogrenci_id, aciklama, teslim_tarihi, yapildi, yapildi_tarihi, olusturma_tarihi, students!inner(full_name, class_id, deleted_at, classes(name))'

/** bireysel_odevler (migration 20261024120000). RLS: yalnız ogretmen_id = auth.uid() kayıtları görünür/yazılır. */
export const BireyselOdevRepository = {
  /** Öğretmenin bütün kayıtları (yıl içinde 1000'i aşabilir → sayfalı). */
  async ogretmenin(ogretmenId: string, schoolId: string) {
    const db = await createClient()
    return fetchAll((from, to) => db.from('bireysel_odevler').select(ALANLAR)
      .eq('ogretmen_id', ogretmenId).eq('school_id', schoolId).is('students.deleted_at', null)
      .order('id').range(from, to))
  },

  async ogrencinin(ogretmenId: string, schoolId: string, ogrenciId: string) {
    const db = await createClient()
    const { data, error } = await db.from('bireysel_odevler').select(ALANLAR)
      .eq('ogretmen_id', ogretmenId).eq('school_id', schoolId).eq('ogrenci_id', ogrenciId)
      .order('olusturma_tarihi', { ascending: false }).limit(500)
    if (error) throw new Error(error.message)
    return data ?? []
  },

  async ekle(satir: { school_id: string; ogrenci_id: string; ogretmen_id: string; aciklama: string; teslim_tarihi: string | null }) {
    const db = await createClient()
    const { error } = await db.from('bireysel_odevler').insert(satir)
    if (error) throw new Error(error.message)
  },

  /** Güncellenen satır sayısı (0 = kayıt yok ya da başkasının). */
  async guncelle(id: string, ogretmenId: string, degisim: { aciklama?: string; teslim_tarihi?: string | null; yapildi?: boolean; yapildi_tarihi?: string | null }) {
    const db = await createClient()
    const { data, error } = await db.from('bireysel_odevler').update(degisim).eq('id', id).eq('ogretmen_id', ogretmenId).select('ogrenci_id')
    if (error) throw new Error(error.message)
    return data ?? []
  },

  async sil(id: string, ogretmenId: string) {
    const db = await createClient()
    const { data, error } = await db.from('bireysel_odevler').delete().eq('id', id).eq('ogretmen_id', ogretmenId).select('ogrenci_id')
    if (error) throw new Error(error.message)
    return data ?? []
  },

  /** Ekleme öncesi: öğrenci bu okulda ve silinmemiş mi (RLS de denetler; burada anlaşılır hata için). */
  async ogrenciVarMi(schoolId: string, ogrenciId: string) {
    const db = await createClient()
    const { data, error } = await db.from('students').select('id').eq('id', ogrenciId).eq('school_id', schoolId).is('deleted_at', null).maybeSingle()
    if (error) throw new Error(error.message)
    return !!data
  },
}
