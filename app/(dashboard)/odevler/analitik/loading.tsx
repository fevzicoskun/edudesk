function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function AnalitikLoading() {
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="space-y-1.5">
        <Sk className="h-6 w-36" />
        <Sk className="h-3 w-52" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 space-y-2">
            <Sk className="h-7 w-10" />
            <Sk className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 space-y-3">
        <Sk className="h-4 w-28" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Sk className="h-3 w-20 shrink-0" />
            <Sk className="h-5 flex-1 rounded-full" />
            <Sk className="h-3 w-8" />
          </div>
        ))}
      </div>
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 space-y-3">
        <Sk className="h-4 w-36" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Sk className="h-4 w-4 shrink-0" />
            <Sk className="h-4 flex-1" />
            <Sk className="h-6 w-12 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
