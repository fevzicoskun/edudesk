function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function OdevDetayLoading() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <Sk className="h-4 w-20 mb-3" />
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5 mb-5 space-y-3">
        <Sk className="h-5 w-48" />
        <div className="flex gap-3">
          <Sk className="h-4 w-20" />
          <Sk className="h-4 w-28" />
        </div>
        <Sk className="h-4 w-full" />
        <Sk className="h-4 w-3/4" />
      </div>
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Sk key={i} className="h-8 w-20 rounded-lg" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 dark:border-slate-800 last:border-0">
            <Sk className="h-4 w-6 shrink-0" />
            <Sk className="h-4 flex-1" />
            <Sk className="h-7 w-24 rounded-lg shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
