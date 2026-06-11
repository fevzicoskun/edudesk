import Link from 'next/link'

export default function EmptyState({ hasFilters, canWrite }: { hasFilters: boolean; canWrite: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-gray-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </div>
      {hasFilters ? (
        <>
          <p className="text-gray-900 dark:text-slate-100 font-semibold text-base">Bu kriterlere uygun ödev bulunamadı</p>
          <p className="text-gray-400 text-sm mt-1 max-w-xs">Farklı filtreler deneyin veya filtreyi temizleyin.</p>
          <Link
            href="/odevler"
            className="mt-5 flex items-center gap-2 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
          >
            Filtreyi Sıfırla
          </Link>
        </>
      ) : (
        <>
          <p className="text-gray-900 dark:text-slate-100 font-semibold text-base">Henüz ödev yok</p>
          <p className="text-gray-400 text-sm mt-1 max-w-xs">Sınıflarınıza ödev tanımlamak için yeni bir ödev oluşturun.</p>
          {canWrite && (
            <Link
              href="/odevler/yeni"
              className="mt-5 flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-blue-500/25"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              İlk Ödevi Oluştur
            </Link>
          )}
        </>
      )}
    </div>
  )
}
