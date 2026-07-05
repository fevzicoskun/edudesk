export default function TakvimLoading() {
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto animate-pulse">
      <div className="h-8 w-48 bg-gray-200 dark:bg-slate-700 rounded mb-6" />
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 dark:bg-slate-800 rounded" />
        ))}
      </div>
    </div>
  )
}
