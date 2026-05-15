function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function SinifDetayLoading() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <Sk className="h-4 w-20 mb-3" />
      <div className="mb-5 space-y-1.5">
        <Sk className="h-6 w-32" />
        <Sk className="h-4 w-40" />
      </div>
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5 mb-5">
        <div className="flex justify-between mb-3">
          <Sk className="h-4 w-28" />
          <Sk className="h-8 w-32 rounded-lg" />
        </div>
        <div className="flex gap-2">
          <Sk className="h-10 flex-1" />
          <Sk className="h-10 w-24" />
          <Sk className="h-10 w-16" />
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 flex items-center gap-3">
            <Sk className="h-4 w-6 shrink-0" />
            <div className="flex-1 space-y-1">
              <Sk className="h-4 w-40" />
              <Sk className="h-3 w-16" />
            </div>
            <Sk className="h-7 w-7 rounded-lg shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
