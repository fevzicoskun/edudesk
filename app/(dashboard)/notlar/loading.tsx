function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function NotlarLoading() {
  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-5 space-y-1.5">
        <Sk className="h-6 w-24" />
        <Sk className="h-3 w-36" />
      </div>
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
        <Sk className="h-48 w-full rounded-lg" />
        <Sk className="h-9 w-24 rounded-lg" />
      </div>
    </div>
  )
}
