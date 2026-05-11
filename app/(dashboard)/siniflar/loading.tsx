function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function SiniflarLoading() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-5 space-y-1.5">
        <Sk className="h-6 w-24" />
        <Sk className="h-3 w-40" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 flex items-center gap-4">
            <Sk className="h-10 w-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Sk className="h-4 w-32" />
              <Sk className="h-3 w-20" />
            </div>
            <Sk className="h-8 w-20 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}
