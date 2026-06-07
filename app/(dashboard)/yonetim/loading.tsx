function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function YonetimLoading() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div className="space-y-1.5">
        <Sk className="h-6 w-36" />
        <Sk className="h-3 w-52" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 space-y-3">
            <Sk className="h-8 w-16" />
            <Sk className="h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Sk className="h-8 w-8 rounded-full shrink-0" />
            <Sk className="h-4 flex-1" />
            <Sk className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
