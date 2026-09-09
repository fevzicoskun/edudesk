function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}
export default function SinifPlanLoading() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <Sk className="h-4 w-20 mb-3" />
      <div className="mb-5 space-y-1.5"><Sk className="h-6 w-56" /><Sk className="h-4 w-40" /></div>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => <Sk key={i} className="h-12 w-full rounded-xl" />)}
      </div>
    </div>
  )
}
