function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function YeniOdevLoading() {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-6 space-y-1.5">
        <Sk className="h-6 w-32" />
        <Sk className="h-4 w-48" />
      </div>
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 space-y-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Sk className="h-3.5 w-24" />
            <Sk className={`h-10 w-full ${i === 3 ? 'h-28' : ''}`} />
          </div>
        ))}
        <Sk className="h-10 w-full" />
      </div>
    </div>
  )
}
