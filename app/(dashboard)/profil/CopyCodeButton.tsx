'use client'

export default function CopyCodeButton({ code }: { code: string }) {
  return (
    <button
      onClick={() => navigator.clipboard.writeText(code).then(() => alert('Kopyalandı!'))}
      className="shrink-0 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors"
    >
      Kopyala
    </button>
  )
}
