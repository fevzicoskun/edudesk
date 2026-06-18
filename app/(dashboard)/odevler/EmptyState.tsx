import EmptyState from '@/app/components/EmptyState'

const ODEV_ICON = (
  <svg className="w-8 h-8 text-gray-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
)

export default function OdevlerEmptyState({ hasFilters, canWrite }: { hasFilters: boolean; canWrite: boolean }) {
  if (hasFilters) {
    return (
      <EmptyState
        icon={ODEV_ICON}
        title="Bu kriterlere uygun ödev bulunamadı"
        description="Farklı filtreler deneyin veya filtreyi temizleyin."
        secondaryAction={{ label: 'Filtreyi Sıfırla', href: '/odevler' }}
      />
    )
  }
  return (
    <EmptyState
      icon={ODEV_ICON}
      title="Henüz ödev yok"
      description="Sınıflarınıza ödev tanımlamak için yeni bir ödev oluşturun."
      action={canWrite ? { label: 'İlk Ödevi Oluştur', href: '/odevler/yeni' } : undefined}
    />
  )
}
