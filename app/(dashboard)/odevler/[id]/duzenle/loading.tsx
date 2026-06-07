function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function OdevDuzenleLoading() {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-5 space-y-1.5">
        <Sk className="h-6 w-32" />
        <Sk className="h-3 w-44" />
      </div>
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Sk className="h-3 w-20" />
            <Sk className="h-10 w-full rounded-xl" />
          </div>
        ))}
        <div className="flex gap-3 pt-2">
          <Sk className="h-10 w-24 rounded-xl" />
          <Sk className="h-10 flex-1 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
