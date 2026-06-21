function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function OgretmenAktiviteLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Başlık */}
      <div className="space-y-1.5">
        <Sk className="h-6 w-44" />
        <Sk className="h-3 w-52" />
      </div>

      {/* Özet kartlar */}
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 text-center space-y-2">
            <Sk className="h-8 w-10 mx-auto" />
            <Sk className="h-3 w-24 mx-auto" />
          </div>
        ))}
      </div>

      {/* Öğretmen özet tablosu */}
      <div className="space-y-2">
        <Sk className="h-3 w-28" />
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 dark:border-slate-700/50 last:border-0">
              <Sk className="h-4 flex-1" />
              <Sk className="h-4 w-12" />
              <Sk className="h-4 w-10" />
              <Sk className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* Aktivite akışı */}
      <div className="space-y-2">
        <Sk className="h-3 w-28" />
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl divide-y divide-gray-50 dark:divide-slate-700/50">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Sk className="h-8 w-8 rounded-full shrink-0" />
              <Sk className="h-4 flex-1" />
              <Sk className="h-3 w-16 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
