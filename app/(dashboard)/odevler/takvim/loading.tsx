function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function TakvimLoading() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-5 flex items-center justify-between">
        <div className="space-y-1.5">
          <Sk className="h-6 w-28" />
          <Sk className="h-3 w-40" />
        </div>
        <Sk className="h-9 w-24 rounded-xl" />
      </div>
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <Sk className="h-7 w-7 rounded-lg" />
          <Sk className="h-5 w-32" />
          <Sk className="h-7 w-7 rounded-lg" />
        </div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Sk key={i} className="h-4" />
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <Sk key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}
