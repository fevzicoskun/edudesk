import Link from 'next/link'
import { format, parseISO } from '@/src/shared/date'

type Meeting = { id: string; title: string; meeting_date: string }
type ZumreMeeting = { id: string; title: string; meeting_date: string; branch: string }

export default function MudurHaftaWidget({
  weekMeetings,
  weekZumre,
  totalMeetings,
  totalUsers,
  totalClasses,
}: {
  weekMeetings: Meeting[]
  weekZumre: ZumreMeeting[]
  totalMeetings: number
  totalUsers: number
  totalClasses: number
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Bu Hafta Önemli Olaylar */}
      <section className="lg:col-span-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Bu Hafta Önemli Olaylar</h2>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-slate-700">
          {weekMeetings.length === 0 && weekZumre.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">Bu hafta planlanmış etkinlik yok.</p>
          ) : (
            <>
              {weekMeetings.map(m => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{m.title}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Okul Toplantısı · {format(parseISO(m.meeting_date), 'd MMMM')}</p>
                  </div>
                </div>
              ))}
              {weekZumre.map(m => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{m.title}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Zümre · {m.branch} · {format(parseISO(m.meeting_date), 'd MMMM')}</p>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </section>

      {/* Hızlı Erişim */}
      <div className="space-y-3">
        {[
          { href: '/yonetim', label: 'Toplantılar', sub: `${totalMeetings} kayıt`, icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40' },
          { href: '/kullanicilar', label: 'Kullanıcılar', sub: `${totalUsers} kayıtlı`, icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40' },
          { href: '/siniflar', label: 'Sınıflar', sub: `${totalClasses} sınıf`, icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40' },
          { href: '/audit', label: 'Denetim Günlüğü', sub: 'tüm değişiklikler', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>, color: 'text-gray-600 bg-gray-50 dark:bg-slate-700' },
        ].map(item => (
          <Link key={item.href} href={item.href} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${item.color}`}>
              {item.icon}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{item.label}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">{item.sub}</p>
            </div>
            <svg className="w-4 h-4 text-gray-400 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </Link>
        ))}
      </div>
    </div>
  )
}
