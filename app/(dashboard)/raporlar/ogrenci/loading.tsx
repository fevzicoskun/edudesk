export default function OgrenciRaporLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-28 bg-gray-100 dark:bg-slate-800 rounded-xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-gray-100 dark:bg-slate-800 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-80 bg-gray-100 dark:bg-slate-800 rounded-xl" />
        <div className="h-80 bg-gray-100 dark:bg-slate-800 rounded-xl" />
      </div>
      <div className="h-80 bg-gray-100 dark:bg-slate-800 rounded-xl" />
    </div>
  )
}
