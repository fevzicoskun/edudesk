function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function AuditLoading() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-5 space-y-1.5">
        <Sk className="h-6 w-28" />
        <Sk className="h-4 w-52" />
      </div>
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
          <Sk className="h-4 w-32" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-4 border-b border-gray-50 dark:border-slate-800 last:border-0">
            <Sk className="h-4 w-24 shrink-0" />
            <Sk className="h-4 flex-1" />
            <Sk className="h-6 w-16 rounded-full shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
