import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import { notFound } from 'next/navigation'
import RevokeTokenForm from './RevokeTokenForm'
import AuditLogClient from './AuditLogClient'
import VeliLinksSection from './VeliLinksSection'

export const revalidate = 0

export default async function AuditPage() {
  const [profile, supabase] = await Promise.all([getCurrentProfile(), createClient()])
  if (profile?.role !== 'zumre_baskani' && profile?.role !== 'mudur_yardimcisi' && profile?.role !== 'mudur') {
    notFound()
  }

  const [logsRes, profilesRes, revokedRes, veliTokensRes] = await Promise.all([
    supabase
      .from('audit_logs')
      .select('id, created_at, action, table_name, record_id, new_data, user_id')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase.from('profiles').select('id, full_name'),
    supabase
      .from('revoked_tokens')
      .select('jti, token_type, revoked_at, reason')
      .order('revoked_at', { ascending: false })
      .limit(200),
    supabase
      .from('veli_tokens')
      .select('id, jti, issued_by, expires_at, created_at, students(full_name)')
      .order('created_at', { ascending: false })
      .limit(300),
  ])

  const logs        = logsRes.data ?? []
  const profiles    = profilesRes.data ?? []
  const revokedJtis = (revokedRes.data ?? []).map(r => r.jti)

  type VeliTokenRow = {
    id: string
    jti: string
    issued_by: string
    expires_at: string
    created_at: string
    students: { full_name: string } | null
  }
  const veliTokens = (veliTokensRes.data ?? []) as unknown as VeliTokenRow[]

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">

      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Denetim ve Güvenlik</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          Veli linkleri, token yönetimi ve işlem geçmişi
        </p>
      </div>

      {/* Veli Link Yönetimi */}
      <VeliLinksSection
        tokens={veliTokens}
        revokedJtis={revokedJtis}
        profiles={profiles}
      />

      {/* Manuel token iptal */}
      <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Manuel Token İptali</h2>
        <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
          Elinizde token string'i varsa doğrudan yapıştırarak iptal edebilirsiniz.
        </p>
        <RevokeTokenForm />
      </section>

      {/* Denetim Günlüğü — filtrelenebilir */}
      <AuditLogClient logs={logs} profiles={profiles} />

    </div>
  )
}
