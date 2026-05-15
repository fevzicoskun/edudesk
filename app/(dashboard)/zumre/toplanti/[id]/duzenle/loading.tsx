function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function ToplantiDuzenleLoading() {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <Sk className="h-4 w-36 mb-4" />
      <Sk className="h-6 w-48 mb-6" />
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5 space-y-4">
        <div className="space-y-1.5">
          <Sk className="h-3.5 w-12" />
          <Sk className="h-10 w-full" />
        </div>
        <div className="space-y-1.5">
          <Sk className="h-3.5 w-12" />
          <Sk className="h-10 w-full" />
        </div>
        <div className="space-y-1.5">
          <Sk className="h-3.5 w-28" />
          <Sk className="h-40 w-full" />
        </div>
        <div className="flex gap-3">
          <Sk className="h-10 flex-1" />
          <Sk className="h-10 flex-1" />
        </div>
      </div>
    </div>
  )
}
