function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function MufredatLoading() {
  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 font-sans text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <Sk className="h-5 w-56" />
        <Sk className="h-9 w-28 rounded-lg" />
      </div>
      <div className="flex gap-4 mb-6 mt-2">
        <Sk className="h-4 w-20" />
        <Sk className="h-4 w-24" />
        <Sk className="h-4 w-28" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="mb-4">
          <Sk className="h-7 w-20 mb-1 rounded" />
          {Array.from({ length: 3 }).map((_, j) => (
            <div key={j} className="flex items-center gap-3 border-b border-gray-100 py-1.5">
              <Sk className="h-3.5 w-16 shrink-0" />
              <Sk className="h-3.5 flex-1" />
              <Sk className="h-3.5 w-20 shrink-0" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
