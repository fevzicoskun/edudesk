function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function OdevlerLoading() {
  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-red-50/10 to-slate-50 dark:from-slate-950 dark:to-slate-950">
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        {/* Başlık */}
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-1.5">
            <Sk className="h-6 w-24" />
            <Sk className="h-3 w-36" />
          </div>
          <Sk className="h-10 w-28 rounded-xl" />
        </div>

        {/* 3 stat kart */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 px-4 py-3.5 space-y-2">
              <Sk className="h-8 w-10" />
              <Sk className="h-3 w-14" />
            </div>
          ))}
        </div>

        {/* Filtre barı */}
        <Sk className="h-12 w-full mb-4 rounded-xl" />

        {/* Ödev kartları */}
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
              <div className="h-0.5 bg-gray-100 dark:bg-slate-700" />
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <Sk className="h-5 w-48" />
                  <Sk className="h-6 w-16 rounded-full" />
                </div>
                <div className="flex gap-2">
                  <Sk className="h-5 w-20 rounded-md" />
                  <Sk className="h-5 w-24" />
                </div>
                <Sk className="h-4 w-full" />
                <div className="flex justify-between pt-1">
                  <Sk className="h-4 w-28" />
                  <Sk className="h-4 w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
