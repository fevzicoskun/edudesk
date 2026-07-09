function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function RandevularLoading() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div className="space-y-1.5">
        <Sk className="h-6 w-44" />
        <Sk className="h-3 w-60" />
      </div>
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4">
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 20 }).map((_, i) => (
            <Sk key={i} className="h-12" />
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 flex items-center gap-3">
            <Sk className="h-10 w-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Sk className="h-4 w-40" />
              <Sk className="h-3 w-24" />
            </div>
            <Sk className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
