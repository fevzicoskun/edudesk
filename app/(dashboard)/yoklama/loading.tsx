export default function YoklamaLoading() {
  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div className="h-7 w-32 bg-gray-200 dark:bg-slate-800 rounded animate-pulse" />
      <div className="flex gap-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-9 w-16 bg-gray-200 dark:bg-slate-800 rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl divide-y">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="h-4 w-4 bg-gray-100 dark:bg-slate-800 rounded animate-pulse" />
            <div className="h-4 flex-1 bg-gray-100 dark:bg-slate-800 rounded animate-pulse" />
            <div className="flex gap-1">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="h-7 w-12 bg-gray-100 dark:bg-slate-800 rounded-full animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
