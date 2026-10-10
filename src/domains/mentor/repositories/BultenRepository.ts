// src/domains/mentor/repositories/BultenRepository.ts
import { createClient } from '@/src/infrastructure/supabase/server'

export const BultenRepository = {
  /** Bülten için ek bilgiler: veli telefonları, okul adı, okul öğretmenlerinin adları. Hata = fırlat (sessiz boş yok). */
  async ekBilgi(schoolId: string, studentIds: string[]) {
    const db = await createClient()
    const [ogr, okul, ogretmen] = await Promise.all([
      db.from('students').select('id, veli_telefon').in('id', studentIds).eq('school_id', schoolId).is('deleted_at', null),
      db.from('schools').select('name').eq('id', schoolId).single(),
      db.from('profiles').select('id, full_name').eq('school_id', schoolId),
    ])
    for (const r of [ogr, okul, ogretmen]) if (r.error) throw new Error(r.error.message)
    return {
      telefonlar: new Map((ogr.data ?? []).map(s => [s.id, s.veli_telefon])),
      okulAdi: okul.data?.name ?? '',
      ogretmenAdlari: new Map((ogretmen.data ?? []).map(p => [p.id, p.full_name ?? ''])),
    }
  },

  /** Çağıranın bu hafta "gönderildi" işaretli öğrencileri (RLS: mentör kendi satırları). */
  async gonderilenler(schoolId: string, hafta: string): Promise<string[]> {
    const db = await createClient()
    const { data, error } = await db.from('bulten_gonderimleri').select('student_id')
      .eq('school_id', schoolId).eq('hafta', hafta)
    if (error) throw new Error(error.message)
    return (data ?? []).map(r => r.student_id)
  },

  /** İşaret koy/kaldır. Yetki RLS'te: yalnız öğrencinin güncel mentörü yazar. */
  async gonderildiYaz(schoolId: string, mentorId: string, studentId: string, hafta: string, gonderildi: boolean) {
    const db = await createClient()
    return gonderildi
      ? db.from('bulten_gonderimleri')
          .upsert({ school_id: schoolId, mentor_id: mentorId, student_id: studentId, hafta }, { onConflict: 'student_id,hafta', ignoreDuplicates: true })
      : db.from('bulten_gonderimleri').delete()
          .eq('school_id', schoolId).eq('mentor_id', mentorId).eq('student_id', studentId).eq('hafta', hafta)
  },
}
