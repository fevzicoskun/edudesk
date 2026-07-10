// Abonelik bitiş uyarısı — yalnız müdür/MY görür, snooze yok (tahsilat baskısı bilinçli).
export default function AbonelikUyariSeridi({ kalan }: { kalan: number }) {
  return (
    <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 px-4 py-2.5 text-center print:hidden">
      <p className="text-sm text-amber-800 dark:text-amber-300">
        Okulunuzun aboneliği{' '}
        <strong>{kalan === 0 ? 'bugün' : `${kalan} gün sonra`}</strong> sona erecek.
        Kesinti yaşamamak için lütfen bizimle iletişime geçin.
      </p>
    </div>
  )
}
