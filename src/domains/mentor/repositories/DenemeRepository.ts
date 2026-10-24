// src/domains/mentor/repositories/DenemeRepository.ts
import { createClient } from '@/src/infrastructure/supabase/server'
import type { Json } from '@/src/infrastructure/supabase/database.types'
import type { DenemeTuru } from '../deneme/stoys'

// PostgREST yanıtı (veri | hata) birleşimi: hata fırlatır, veriyi null'suz döner (liste ve tekil kayıt sorguları)
function ok<R extends { data: unknown; error: { message: string } | null }>(r: R): NonNullable<R['data']> {
  if (r.error) throw new Error(r.error.message)
  return r.data as NonNullable<R['data']>
}

/** Deneme tabloları (migration 20261023120000). RLS: kapı + güncel mentör yazar; müdür/MY okur. */
export const DenemeRepository = {
  async sinifBul(schoolId: string, ad: string): Promise<string | null> {
    const db = await createClient()
    const r = ok(await db.from('classes').select('id').eq('school_id', schoolId).eq('name', ad).is('deleted_at', null)
      .order('created_at', { ascending: false }).limit(1))
    return r[0]?.id ?? null
  },

  /** Aynı okul+tür+seviye için `enAz` tarihinden sonraki en yeni sınav (tarih ikilenmesin önerisi). */
  async sonSinav(schoolId: string, tur: DenemeTuru, seviye: number, enAz: string) {
    const db = await createClient()
    const r = ok(await db.from('deneme_sinavlari').select('id, tarih').eq('school_id', schoolId).eq('tur', tur).eq('seviye', seviye)
      .gte('tarih', enAz).order('tarih', { ascending: false }).limit(1))
    return r[0] ?? null
  },

  async sinav(schoolId: string, id: string) {
    const db = await createClient()
    const { data, error } = await db.from('deneme_sinavlari').select('id, tur, seviye, tarih').eq('school_id', schoolId).eq('id', id).maybeSingle()
    if (error) throw new Error(error.message)
    return data
  },

  /** Sınav yoksa oluşturur (update policy yok → çakışmada dokunmaz), kimliğini döner. */
  async sinavAlVeyaOlustur(k: { school_id: string; tur: DenemeTuru; seviye: number; tarih: string; created_by: string }): Promise<string> {
    const db = await createClient()
    ok(await db.from('deneme_sinavlari').upsert(k, { onConflict: 'school_id,tur,seviye,tarih', ignoreDuplicates: true }))
    const { data, error } = await db.from('deneme_sinavlari').select('id').eq('school_id', k.school_id).eq('tur', k.tur).eq('seviye', k.seviye)
      .eq('tarih', k.tarih).single()
    if (error) throw new Error(error.message)
    return data.id
  },

  async sinifYuklendi(sinavId: string, classId: string, schoolId: string) {
    const db = await createClient()
    ok(await db.from('deneme_sinav_siniflari').upsert({ sinav_id: sinavId, class_id: classId, school_id: schoolId },
      { onConflict: 'sinav_id,class_id', ignoreDuplicates: true }))
  },

  async sonuclariYaz(satirlar: { sinav_id: string; student_id: string; school_id: string; dersler: Json; toplam_net: number; puan: number | null; updated_by: string }[]) {
    if (satirlar.length === 0) return
    const db = await createClient()
    ok(await db.from('deneme_sonuclari').upsert(satirlar.map(s => ({ ...s, updated_at: new Date().toISOString() })), { onConflict: 'sinav_id,student_id' }))
  },

  async sonuclariSil(sinavId: string, studentIds: string[]) {
    if (studentIds.length === 0) return
    const db = await createClient()
    ok(await db.from('deneme_sonuclari').delete().eq('sinav_id', sinavId).in('student_id', studentIds))
  },

  /** Sınıfın dosyası yüklenmiş sınavlar (`enAz` tarihinden beri) — katılmadı çıkarımı bunlara dayanır. */
  async sinifSinavlari(classId: string, enAz: string) {
    const db = await createClient()
    return ok(await db.from('deneme_sinav_siniflari').select('class_id, deneme_sinavlari!inner(id, tur, tarih)')
      .eq('class_id', classId).gte('deneme_sinavlari.tarih', enAz))
  },

  /** Öğrencinin dönem içindeki haftalık plan kayıtları, eskiden yeniye. */
  async donemHaftalari(schoolId: string, studentId: string, bas: string, son: string) {
    const db = await createClient()
    return ok(await db.from('mentor_haftalari').select('hafta_basi, seviye, soru_hedefi, icerik')
      .eq('school_id', schoolId).eq('student_id', studentId).gte('hafta_basi', bas).lte('hafta_basi', son).order('hafta_basi'))
  },

  /** Öğrencilerin bütün sonuçları sınav bilgisiyle (mentör ≤ ~60 öğrenci × dönemde ~10 sınav: 1000 satır sınırının altında). */
  async ogrenciSonuclari(studentIds: string[]) {
    if (studentIds.length === 0) return []
    const db = await createClient()
    return ok(await db.from('deneme_sonuclari')
      .select('sinav_id, student_id, dersler, toplam_net, deneme_sinavlari!inner(tur, tarih, seviye)')
      .in('student_id', studentIds))
  },
}
