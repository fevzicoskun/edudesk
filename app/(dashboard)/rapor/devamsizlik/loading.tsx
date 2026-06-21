function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function DevamsizlikLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Başlık + Excel butonu */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Sk className="h-6 w-44" />
          <Sk className="h-3 w-64" />
        </div>
        <Sk className="h-9 w-28 rounded-lg" />
      </div>

      {/* Özet kartlar */}
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 text-center space-y-2">
            <Sk className="h-8 w-10 mx-auto" />
            <Sk className="h-3 w-20 mx-auto" />
          </div>
        ))}
      </div>

      {/* Tablo */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl overflow-hidden">
        <div className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-700 px-4 py-3">
          <Sk className="h-4 w-40" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 dark:border-slate-700/50 last:border-0">
            <Sk className="h-4 w-5 shrink-0" />
            <Sk className="h-4 flex-1" />
            <Sk className="h-4 w-16" />
            <Sk className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
