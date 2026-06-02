import Link from 'next/link'

export default function ProfilTabNav({
  active,
}: {
  active: 'profil'
}) {
  const tabs = [
    { href: '/profil', key: 'profil' as const, label: 'Profilim' },
  ]

  return (
    <div className="flex gap-1 border-b border-gray-200 dark:border-slate-700 mb-6">
      {tabs.map(t =>
        t.key === active ? (
          <span key={t.key} className="px-4 py-2 text-sm font-medium border-b-2 border-blue-600 text-blue-600">
            {t.label}
          </span>
        ) : (
          <Link
            key={t.key}
            href={t.href}
            className="px-4 py-2 text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
          >
            {t.label}
          </Link>
        )
      )}
    </div>
  )
}
