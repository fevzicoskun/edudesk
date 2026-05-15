function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function OgrenciDetayLoading() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <Sk className="h-4 w-24 mb-3" />
      <div className="mb-5 space-y-1.5">
        <Sk className="h-6 w-44" />
        <Sk className="h-4 w-32" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5 mb-4 space-y-3">
          <Sk className="h-4 w-28" />
          {Array.from({ length: 4 }).map((_, j) => (
            <div key={j} className="flex items-center justify-between gap-3">
              <Sk className="h-4 flex-1" />
              <Sk className="h-6 w-20 rounded-full shrink-0" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
