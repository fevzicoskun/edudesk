function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function DersProgramiLoading() {
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-1.5">
          <Sk className="h-6 w-44" />
          <Sk className="h-3 w-64" />
        </div>
        <Sk className="h-9 w-32 rounded-lg" />
      </div>
      <div className="space-y-5">
        {[0, 1].map(s => (
          <div key={s}>
            <Sk className="h-4 w-36 mb-3" />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 flex items-center justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <Sk className="h-4 w-40" />
                    <Sk className="h-3 w-24" />
                  </div>
                  <div className="flex gap-2">
                    <Sk className="h-7 w-20 rounded-lg" />
                    <Sk className="h-7 w-12 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
