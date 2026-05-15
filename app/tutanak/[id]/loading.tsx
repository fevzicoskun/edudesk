function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function TutanakLoading() {
  return (
    <div className="min-h-screen bg-white">
      <div className="px-6 py-2 border-b border-gray-100 flex items-center gap-4">
        <Sk className="h-4 w-16" />
      </div>
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex flex-col sm:flex-row gap-3">
          <Sk className="h-10 flex-1" />
          <Sk className="h-10 flex-1" />
          <Sk className="h-10 w-32" />
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-8 py-8 space-y-4">
        <div className="text-center space-y-2 border-b-2 border-gray-200 pb-4">
          <Sk className="h-3.5 w-20 mx-auto" />
          <Sk className="h-4 w-44 mx-auto" />
          <Sk className="h-5 w-56 mx-auto" />
          <Sk className="h-5 w-64 mx-auto mt-3" />
        </div>
        <div className="grid grid-cols-2 gap-4 border border-gray-200 rounded p-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Sk key={i} className="h-4 w-full" />
          ))}
        </div>
        <Sk className="h-32 w-full" />
        <div className="grid grid-cols-2 gap-8 pt-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Sk className="h-4 w-full" />
              <Sk className="h-4 w-full" />
              <Sk className="h-8 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
