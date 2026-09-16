export default function Loading() {
  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto animate-pulse">
      <div className="h-6 w-40 bg-gray-200 dark:bg-slate-700 rounded mb-4" />
      <div className="h-11 bg-gray-100 dark:bg-slate-800 rounded-2xl mb-6" />
      <div className="space-y-2">
        {[0, 1, 2].map(i => <div key={i} className="h-[72px] bg-gray-100 dark:bg-slate-800 rounded-2xl" />)}
      </div>
    </div>
  )
}
