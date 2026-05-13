export default function DosyaLoading() {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <div className="h-7 w-48 bg-gray-200 dark:bg-slate-800 rounded animate-pulse" />
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5 space-y-3">
          <div className="h-4 w-40 bg-gray-100 dark:bg-slate-800 rounded animate-pulse" />
          {[...Array(3)].map((_, j) => (
            <div key={j} className="h-4 w-full bg-gray-100 dark:bg-slate-800 rounded animate-pulse" />
          ))}
        </div>
      ))}
    </div>
  )
}
