'use client'

export default function SearchInput({
  show, value, onChange, resultCount,
}: {
  show: boolean
  value: string
  onChange: (v: string) => void
  resultCount: number
}) {
  if (!show) return null
  return (
    <>
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
        </svg>
        <input
          type="text"
          placeholder="Öğrenci ara..."
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full pl-9 pr-8 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-700 dark:text-slate-300 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 placeholder:text-gray-400 transition-all"
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      {value && (
        <p className="text-xs text-gray-400 mb-3">
          {resultCount === 0 ? 'Sonuç bulunamadı.' : `${resultCount} öğrenci gösteriliyor`}
        </p>
      )}
    </>
  )
}
