export default function HomeworkListSkeleton() {
  return (
    <div className="animate-pulse space-y-3 mt-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-16 bg-gray-100 dark:bg-slate-800 rounded-xl" />
        ))}
      </div>
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="h-28 bg-gray-100 dark:bg-slate-800 rounded-2xl" />
      ))}
    </div>
  )
}
