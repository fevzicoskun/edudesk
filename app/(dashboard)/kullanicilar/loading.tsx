function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function KullanicilarLoading() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="space-y-1.5">
        <Sk className="h-6 w-28" />
        <Sk className="h-3 w-44" />
      </div>
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 space-y-3">
        <Sk className="h-4 w-32" />
        <div className="flex gap-2">
          <Sk className="h-10 flex-1 rounded-xl" />
          <Sk className="h-10 w-32 rounded-xl" />
        </div>
        <Sk className="h-10 w-full rounded-xl" />
        <Sk className="h-10 w-28 rounded-xl" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 flex items-center gap-3">
            <Sk className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Sk className="h-4 w-32" />
              <Sk className="h-3 w-20" />
            </div>
            <Sk className="h-6 w-20 rounded-full" />
            <Sk className="h-7 w-7 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}
