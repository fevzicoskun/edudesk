function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function DevamsizlarLoading() {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Sk className="h-5 w-5 shrink-0" />
        <div className="space-y-1.5">
          <Sk className="h-6 w-52" />
          <Sk className="h-3 w-44" />
        </div>
      </div>
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
              <Sk className="h-4 w-16" />
              <Sk className="h-3 w-10" />
            </div>
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="flex items-center gap-3">
                  <Sk className="h-8 w-8 rounded-full shrink-0" />
                  <Sk className="h-4 flex-1" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
