import { createClient } from '@/src/infrastructure/supabase/server'
import type { KanaatNotu } from '../types'

export const KanaatRepository = {
  async findByClassAndDonem(classId: string, donem: string, schoolId: string) {
    const db = await createClient()
    return db
      .from('kanaat_notlari')
      .select('*')
      .eq('class_id', classId)
      .eq('donem', donem)
      .eq('school_id', schoolId)
      .order('created_at')
  },

  async upsertMany(
    kayitlar: Omit<KanaatNotu, 'id' | 'created_at' | 'updated_at'>[],
  ) {
    const db = await createClient()
    return db
      .from('kanaat_notlari')
      .upsert(
        kayitlar.map(k => ({ ...k, updated_at: new Date().toISOString() })),
        { onConflict: 'student_id,donem', ignoreDuplicates: false },
      )
  },

  async findAllByClass(classId: string, schoolId: string) {
    const db = await createClient()
    return db
      .from('kanaat_notlari')
      .select('*')
      .eq('class_id', classId)
      .eq('school_id', schoolId)
      .order('donem', { ascending: false })
  },
}
