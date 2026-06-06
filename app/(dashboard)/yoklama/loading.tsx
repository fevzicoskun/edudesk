function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function YoklamaLoading() {
  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-5 space-y-1.5">
        <Sk className="h-6 w-28" />
        <Sk className="h-3 w-48" />
      </div>
      {/* Sınıf seçici */}
      <div className="flex gap-2 mb-5 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <Sk key={i} className="h-9 w-20 shrink-0 rounded-lg" />
        ))}
      </div>
      {/* Öğrenci satırları */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
          <Sk className="h-5 w-32" />
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 dark:border-slate-800 last:border-0">
            <Sk className="h-4 w-5 shrink-0" />
            <Sk className="h-4 flex-1" />
            <div className="flex gap-2">
              <Sk className="h-8 w-16 rounded-lg" />
              <Sk className="h-8 w-16 rounded-lg" />
              <Sk className="h-8 w-16 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
