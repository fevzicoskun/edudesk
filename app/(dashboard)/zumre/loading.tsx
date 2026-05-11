function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function ZumreLoading() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-5 space-y-1.5">
        <Sk className="h-6 w-28" />
        <Sk className="h-3 w-48" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5 space-y-3">
            <Sk className="h-5 w-40" />
            <Sk className="h-4 w-full" />
            <Sk className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  )
}
