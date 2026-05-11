function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function AnasayfaLoading() {
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Başlık */}
      <div className="mb-5 space-y-1.5">
        <Sk className="h-6 w-32" />
        <Sk className="h-4 w-56" />
      </div>

      {/* 2 hızlı kart */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="border border-gray-200 dark:border-slate-700 rounded-xl p-3 space-y-2">
            <Sk className="h-8 w-10" />
            <Sk className="h-3 w-20" />
          </div>
        ))}
      </div>

      {/* 2 kolon: liste + takvim */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
            <Sk className="h-4 w-32" />
            {Array.from({ length: 4 }).map((_, j) => (
              <Sk key={j} className="h-12 w-full" />
            ))}
          </div>
        ))}
      </div>

      {/* Submissions panel skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="border border-gray-200 dark:border-slate-700 rounded-xl p-3 space-y-2">
            <Sk className="h-8 w-10" />
            <Sk className="h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
            <Sk className="h-4 w-32" />
            {Array.from({ length: 3 }).map((_, j) => (
              <Sk key={j} className="h-10 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
