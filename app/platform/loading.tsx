function Sk({ className }: { className?: string }) {
  return <div className={`bg-slate-800 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function PlatformLoading() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Sk className="h-7 w-32" />
          <Sk className="h-3 w-24" />
        </div>
        <Sk className="h-9 w-28 rounded-xl" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4 space-y-2">
            <Sk className="h-3 w-20" />
            <Sk className="h-8 w-14" />
          </div>
        ))}
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Sk className="h-4 flex-1" />
            <Sk className="h-6 w-16 rounded-full" />
            <Sk className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
