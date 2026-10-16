// src/domains/mentor/repositories/TakipRepository.ts
import { createClient } from '@/src/infrastructure/supabase/server'
import type { Json } from '@/src/infrastructure/supabase/database.types'
import type { Ozet } from '../takip/takipMath'

type HaftaSatiri = { school_id: string; student_id: string; hafta_basi: string; seviye: number; soru_hedefi: number; icerik: Json; gorusme: Json; updated_by: string } & Ozet

export const TakipRepository = {
  async acikMi(): Promise<boolean> {
    const db = await createClient()
    const { data, error } = await db.rpc('mentor_takip_acik')
    if (error) throw new Error(error.message)
    return data === true
  },

  async mentoruMu(userId: string, schoolId: string, studentId: string): Promise<boolean> {
    const db = await createClient()
    const { data, error } = await db.from('mentorships').select('student_id')
      .eq('school_id', schoolId).eq('mentor_id', userId).eq('student_id', studentId).maybeSingle()
    if (error) throw new Error(error.message)
    return !!data
  },

  async ogrenci(schoolId: string, studentId: string) {
    const db = await createClient()
    const { data, error } = await db.from('students').select('id, full_name, class_id, veli_telefon, classes(name, grade)')
      .eq('id', studentId).eq('school_id', schoolId).is('deleted_at', null).maybeSingle()
    if (error) throw new Error(error.message)
    return data
  },

  async hafta(schoolId: string, studentId: string, hafta: string) {
    const db = await createClient()
    const { data, error } = await db.from('mentor_haftalari').select('*')
      .eq('school_id', schoolId).eq('student_id', studentId).eq('hafta_basi', hafta).maybeSingle()
    if (error) throw new Error(error.message)
    return data
  },

  async oncekiHafta(schoolId: string, studentId: string, hafta: string) {
    const db = await createClient()
    const { data, error } = await db.from('mentor_haftalari').select('*')
      .eq('school_id', schoolId).eq('student_id', studentId).lt('hafta_basi', hafta)
      .order('hafta_basi', { ascending: false }).limit(1).maybeSingle()
    if (error) throw new Error(error.message)
    return data
  },

  /** Satır varsa (başka sekme önce yazdı) çakışma döner — unique (student_id, hafta_basi). */
  async haftaEkle(s: HaftaSatiri): Promise<{ updatedAt?: string; cakisma?: boolean }> {
    const db = await createClient()
    const { data, error } = await db.from('mentor_haftalari').insert(s).select('updated_at').single()
    if (error?.code === '23505') return { cakisma: true }
    if (error) throw new Error(error.message)
    return { updatedAt: data.updated_at }
  },

  /** İyimser kilit: yalnız son bilinen updated_at eşleşirse yazar; 0 satır = çakışma. */
  async haftaGuncelle(s: HaftaSatiri, sonBilinen: string): Promise<{ updatedAt?: string; cakisma?: boolean }> {
    const db = await createClient()
    const { data, error } = await db.from('mentor_haftalari')
      .update({ ...s, updated_at: new Date().toISOString() })
      .eq('school_id', s.school_id).eq('student_id', s.student_id).eq('hafta_basi', s.hafta_basi).eq('updated_at', sonBilinen)
      .select('updated_at')
    if (error) throw new Error(error.message)
    return data.length ? { updatedAt: data[0].updated_at } : { cakisma: true }
  },

  async kitaplar(schoolId: string, studentId: string) {
    const db = await createClient()
    const { data, error } = await db.from('mentor_kitaplari').select('id, ad, ders')
      .eq('school_id', schoolId).eq('student_id', studentId).is('deleted_at', null).order('created_at')
    if (error) throw new Error(error.message)
    return data ?? []
  },

  async kitapEkle(schoolId: string, studentId: string, ad: string, ders: string) {
    const db = await createClient()
    return db.from('mentor_kitaplari').insert({ school_id: schoolId, student_id: studentId, ad, ders }).select('id, ad, ders').single()
  },

  async kitapSil(schoolId: string, studentId: string, kitapId: string) {
    const db = await createClient()
    return db.from('mentor_kitaplari').update({ deleted_at: new Date().toISOString() })
      .eq('id', kitapId).eq('school_id', schoolId).eq('student_id', studentId)
  },

  async konular(schoolId: string, sinif: number) {
    const db = await createClient()
    const { data, error } = await db.from('konu_listesi').select('id, ders, ad, grup')
      .eq('school_id', schoolId).eq('sinif', sinif).order('ders').order('sira').order('ad')
    if (error) throw new Error(error.message)
    return data ?? []
  },

  /** Matematik listesini okula tohumlar (idempotent: unique + ignoreDuplicates). */
  async konuTohumla(schoolId: string, userId: string, sinif: number, konular: { grup: string; ad: string }[]) {
    const db = await createClient()
    const { error } = await db.from('konu_listesi').upsert(
      konular.map((k, i) => ({ school_id: schoolId, ders: 'Matematik', sinif, ad: k.ad, grup: k.grup, sira: i, created_by: userId })),
      { onConflict: 'school_id,ders,sinif,ad', ignoreDuplicates: true })
    if (error) throw new Error(error.message)
  },

  async konuDurumlari(schoolId: string, studentId: string) {
    const db = await createClient()
    const { data, error } = await db.from('ogrenci_konu_durumu').select('konu_id, durum').eq('school_id', schoolId).eq('student_id', studentId)
    if (error) throw new Error(error.message)
    return data ?? []
  },

  async gecmis(schoolId: string, studentId: string) {
    const db = await createClient()
    const { data, error } = await db.from('mentor_haftalari')
      .select('hafta_basi, seviye, icerik, gorev_toplam, gorev_yapilan, soru, dogru, okuma_sayfa, islendi')
      .eq('school_id', schoolId).eq('student_id', studentId).order('hafta_basi').limit(200)
    if (error) throw new Error(error.message)
    return data ?? []
  },
  async konuEkle(schoolId: string, userId: string, ders: string, sinif: number, ad: string) {
    const db = await createClient()
    return db.from('konu_listesi').upsert({ school_id: schoolId, ders, sinif, ad, created_by: userId, sira: 1000 },
      { onConflict: 'school_id,ders,sinif,ad', ignoreDuplicates: true }).select('id, ders, ad, grup')
  },
  async konuDurumuYaz(schoolId: string, studentId: string, konuId: string, durum: number) {
    const db = await createClient()
    return db.from('ogrenci_konu_durumu').upsert({ school_id: schoolId, student_id: studentId, konu_id: konuId, durum, updated_at: new Date().toISOString() })
  },

  async durumlar(schoolId: string, studentIds: string[], hafta: string) {
    const db = await createClient()
    const { data, error } = await db.from('mentor_haftalari').select('student_id, islendi, gorev_toplam, gorev_yapilan')
      .eq('school_id', schoolId).eq('hafta_basi', hafta).in('student_id', studentIds)
    if (error) throw new Error(error.message)
    return data ?? []
  },
}
