export default function OgretmenRaporLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-16 bg-gray-100 dark:bg-slate-800 rounded-xl" />
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map(i => <div key={i} className="h-20 bg-gray-100 dark:bg-slate-800 rounded-xl" />)}
      </div>
      <div className="h-80 bg-gray-100 dark:bg-slate-800 rounded-xl" />
    </div>
  )
}
