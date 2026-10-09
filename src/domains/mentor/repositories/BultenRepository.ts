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
}
