function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function AyarlarLoading() {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <Sk className="h-6 w-24 mb-6" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5 mb-4 space-y-4">
          <Sk className="h-5 w-40" />
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Sk className="h-3.5 w-24" />
              <Sk className="h-10 w-full rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Sk className="h-3.5 w-32" />
              <Sk className="h-10 w-full rounded-lg" />
            </div>
          </div>
          <Sk className="h-9 w-28 rounded-lg" />
        </div>
      ))}
    </div>
  )
}
