function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function CizelgeLoading() {
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-5 space-y-1.5">
        <Sk className="h-6 w-44" />
        <Sk className="h-3 w-64" />
      </div>
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 flex gap-3 mb-4">
        <Sk className="h-10 w-36" />
        <Sk className="h-10 w-32" />
      </div>
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-6">
        <Sk className="h-4 w-full mb-3" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Sk key={i} className="h-8 w-full mb-2" />
        ))}
      </div>
    </div>
  )
}
