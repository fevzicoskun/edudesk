function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function MatrisLoading() {
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="mb-5 flex items-center justify-between">
        <div className="space-y-1.5">
          <Sk className="h-6 w-36" />
          <Sk className="h-3 w-52" />
        </div>
        <Sk className="h-9 w-36 rounded-xl" />
      </div>
      {/* Tablo */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-auto">
        {/* Header row */}
        <div className="flex gap-2 px-4 py-3 border-b border-gray-100 dark:border-slate-700">
          <Sk className="h-4 w-6 shrink-0" />
          <Sk className="h-4 w-32 shrink-0" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Sk key={i} className="h-4 w-20 shrink-0" />
          ))}
          <Sk className="h-4 w-16 shrink-0" />
        </div>
        {/* Data rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-2 px-4 py-2.5 border-b border-gray-50 dark:border-slate-800/50 last:border-0">
            <Sk className="h-4 w-6 shrink-0" />
            <Sk className="h-4 w-32 shrink-0" />
            {Array.from({ length: 5 }).map((_, j) => (
              <Sk key={j} className="h-7 w-20 rounded-md shrink-0" />
            ))}
            <Sk className="h-4 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
