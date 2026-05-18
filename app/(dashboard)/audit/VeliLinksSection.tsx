'use client'

import { useState, useTransition, useMemo } from 'react'
import { format, parseISO, formatDistanceToNow, isPast } from '@/src/shared/date'
import { revokeToken } from '@/src/domains/tokens/actions'

type VeliToken = {
  id: string
  jti: string
  issued_by: string
  expires_at: string
  created_at: string
  students: { full_name: string } | null
}

type Profile = { id: string; full_name: string | null }

type Tab = 'aktif' | 'gecmis' | 'iptal'

export default function VeliLinksSection({
  tokens,
  revokedJtis: initialRevokedJtis,
  profiles,
}: {
  tokens: VeliToken[]
  revokedJtis: string[]
  profiles: Profile[]
}) {
  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p.full_name ?? 'Bilinmeyen'])), [profiles])
  const [revokedJtis, setRevokedJtis] = useState(() => new Set(initialRevokedJtis))
  const [tab, setTab] = useState<Tab>('aktif')
  const [isPending, startTransition] = useTransition()
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const aktif  = tokens.filter(t => !revokedJtis.has(t.jti) && !isPast(new Date(t.expires_at)))
  const gecmis = tokens.filter(t => !revokedJtis.has(t.jti) &&  isPast(new Date(t.expires_at)))
  const iptal  = tokens.filter(t =>  revokedJtis.has(t.jti))

  const shown = tab === 'aktif' ? aktif : tab === 'gecmis' ? gecmis : iptal

  function handleRevoke(token: VeliToken) {
    setRevokingId(token.id)
    setError(null)
    startTransition(async () => {
      const result = await revokeToken(token.jti, 'veli', 'Yönetici tarafından iptal edildi')
      if (result.ok) {
        setRevokedJtis(prev => new Set([...prev, token.jti]))
      } else {
        setError(result.error ?? 'İptal işlemi başarısız')
      }
      setRevokingId(null)
    })
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'aktif',  label: 'Aktif',   count: aktif.length  },
    { key: 'gecmis', label: 'Süresi Dolmuş', count: gecmis.length },
    { key: 'iptal',  label: 'İptal',   count: iptal.length  },
  ]

  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">Veli Linkleri</h2>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
          Oluşturulan veli portalı linkleri · Aktif linkler 7 gün geçerli
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-slate-700 px-5">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 pb-2.5 pt-1 mr-5 text-xs font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-purple-600 text-purple-600 dark:text-purple-400 dark:border-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            {t.label}
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              tab === t.key ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <div className="mx-5 mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-gray-400">
          {tab === 'aktif' ? 'Aktif link yok.' : tab === 'gecmis' ? 'Süresi dolmuş link yok.' : 'İptal edilmiş link yok.'}
        </p>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-slate-700">
          {shown.map(token => {
            const expired = isPast(new Date(token.expires_at))
            const revoked = revokedJtis.has(token.jti)

            return (
              <div key={token.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                    {token.students?.full_name ?? 'Bilinmeyen Öğrenci'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    {profileMap.get(token.issued_by) ?? 'Bilinmeyen'} tarafından ·{' '}
                    {formatDistanceToNow(parseISO(token.created_at), { addSuffix: true })}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  {revoked ? (
                    <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                      İptal
                    </span>
                  ) : expired ? (
                    <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400">
                      Süresi doldu
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-500 dark:text-slate-400 tabular-nums">
                        {formatDistanceToNow(parseISO(token.expires_at), { addSuffix: false })} kaldı
                      </span>
                      <button
                        onClick={() => handleRevoke(token)}
                        disabled={isPending && revokingId === token.id}
                        className="text-[11px] font-semibold px-2 py-1 rounded-full bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/70 transition-colors disabled:opacity-50"
                      >
                        {isPending && revokingId === token.id ? '…' : 'İptal Et'}
                      </button>
                    </div>
                  )}
                  <p className="text-[10px] text-gray-400 mt-0.5 tabular-nums">
                    {format(parseISO(token.expires_at), 'd MMM yyyy')} bitiş
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
