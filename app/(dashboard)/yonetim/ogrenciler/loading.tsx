function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function OgrencilerLoading() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-5 space-y-1.5">
        <Sk className="h-6 w-28" />
        <Sk className="h-3 w-40" />
      </div>
      <Sk className="h-10 w-full mb-4 rounded-xl" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 flex items-center gap-3">
            <Sk className="h-4 w-8 shrink-0" />
            <Sk className="h-4 flex-1" />
            <Sk className="h-4 w-20" />
            <Sk className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
