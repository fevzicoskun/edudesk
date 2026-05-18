export default function MentorRaporlarLoading() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-10 w-72 bg-gray-200 dark:bg-slate-700 rounded-lg" />
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 space-y-2">
          <div className="flex justify-between">
            <div className="h-4 w-40 bg-gray-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-24 bg-gray-200 dark:bg-slate-700 rounded" />
          </div>
          <div className="h-3 w-full bg-gray-100 dark:bg-slate-700 rounded" />
          <div className="h-3 w-3/4 bg-gray-100 dark:bg-slate-700 rounded" />
        </div>
      ))}
    </div>
  )
}
