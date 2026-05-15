function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function ProfilLoading() {
  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto">
      <div className="mb-6 space-y-1.5">
        <Sk className="h-6 w-36" />
        <Sk className="h-4 w-28" />
      </div>
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Sk className="h-3.5 w-20" />
            <Sk className="h-10 w-full" />
          </div>
        ))}
        <Sk className="h-10 w-full mt-2" />
      </div>
    </div>
  )
}
