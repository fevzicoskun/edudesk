import Link from 'next/link'

const ACTIONS = [
  {
    href: '/yonetim#toplanti-kayitlari',
    label: 'Okul Toplantıları',
    sub: 'Ekle & Yönet',
    gradient: 'from-purple-500 to-purple-600',
    icon: (
      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: '/kullanicilar',
    label: 'Kullanıcılar',
    sub: 'Öğretmenler & Roller',
    gradient: 'from-indigo-500 to-indigo-600',
    icon: (
      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    href: '/siniflar',
    label: 'Sınıflar',
    sub: 'Listele & Yönet',
    gradient: 'from-blue-500 to-blue-600',
    icon: (
      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: '/raporlar',
    label: 'Raporlar',
    sub: 'Analiz & Export',
    gradient: 'from-teal-500 to-teal-600',
    icon: (
      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
]

export default function MudurHizliAksiyonlar() {
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Hızlı Erişim</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ACTIONS.map(a => (
          <Link
            key={a.href}
            href={a.href}
            className="flex items-center gap-3 p-3.5 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl hover:border-gray-300 dark:hover:border-slate-600 hover:shadow-md transition-all group"
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br shadow-sm ${a.gradient}`}>
              {a.icon}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-900 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {a.label}
              </p>
              <p className="text-[10px] text-gray-400 dark:text-slate-500 truncate">{a.sub}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
