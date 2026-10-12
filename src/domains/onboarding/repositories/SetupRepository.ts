import { createClient } from '@/src/infrastructure/supabase/server'

// RLS altında hafif count sorguları (head:true). İş mantığı yok.
export const SetupRepository = {
  // Okulda müdür dışında üye var mı? (davet ✓ koşulu)
  async countOtherMembers(schoolId: string) {
    const db = await createClient()
    return db
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .neq('role', 'mudur')
  },

}
