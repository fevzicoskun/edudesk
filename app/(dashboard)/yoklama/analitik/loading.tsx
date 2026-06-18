export default function Loading() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto animate-pulse">
      <div className="h-8 w-48 bg-gray-200 dark:bg-slate-700 rounded-lg mb-6" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[0, 1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 dark:bg-slate-800 rounded-xl" />)}
      </div>
      <div className="h-48 bg-gray-100 dark:bg-slate-800 rounded-xl mb-4" />
      <div className="h-48 bg-gray-100 dark:bg-slate-800 rounded-xl" />
    </div>
  )
}
