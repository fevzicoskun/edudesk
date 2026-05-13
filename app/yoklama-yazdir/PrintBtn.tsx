'use client'
export default function PrintBtn() {
  return (
    <button
      onClick={() => window.print()}
      className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors print:hidden"
    >
      Yazdır (Ctrl+P)
    </button>
  )
}
