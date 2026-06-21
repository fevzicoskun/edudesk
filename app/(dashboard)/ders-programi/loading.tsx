function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function DersProgramiLoading() {
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Başlık + aksiyon */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Sk className="h-6 w-40" />
          <Sk className="h-3 w-56" />
        </div>
        <Sk className="h-9 w-32 rounded-lg" />
      </div>

      {/* Haftalık çizelge ızgarası: saat sütunu + 5 gün */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {/* Gün başlıkları */}
        <div className="grid grid-cols-6 gap-px bg-gray-100 dark:bg-slate-700 p-px">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 px-2 py-2">
              <Sk className="h-4 w-full" />
            </div>
          ))}
        </div>
        {/* Periyot satırları */}
        {Array.from({ length: 8 }).map((_, r) => (
          <div key={r} className="grid grid-cols-6 gap-px bg-gray-100 dark:bg-slate-700 p-px">
            {Array.from({ length: 6 }).map((_, c) => (
              <div key={c} className="bg-white dark:bg-slate-800 px-2 py-3">
                <Sk className="h-7 w-full rounded-md" />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Nöbet kartı */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
        <Sk className="h-4 w-32" />
        <Sk className="h-9 w-full rounded-lg" />
      </div>
    </div>
  )
}
