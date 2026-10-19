'use client'

import { gunEkle } from '@/src/domains/homework/homeworkMath'

// Canlıda en sık teslim süresi 7 gün; takvim açmadan tek dokunuş.
const SECENEKLER = [
  { etiket: 'Yarın', gun: 1 },
  { etiket: '3 gün', gun: 3 },
  { etiket: '1 hafta', gun: 7 },
  { etiket: '10 gün', gun: 10 },
  { etiket: '2 hafta', gun: 14 },
]

/** Son teslim tarihi kısayolları — `baslangic` (verildiği gün) üstüne gün ekler. */
export default function HizliTeslim({ baslangic, deger, onSec }: {
  baslangic: string
  deger: string
  onSec: (tarih: string) => void
}) {
  // Verildiği gün boşken kısayolların hesaplayacağı tarih yok
  if (!gunEkle(baslangic, 0)) return null
  return (
    <div role="group" aria-label="Hızlı teslim tarihi" className="grid grid-cols-5 gap-1.5">
      {SECENEKLER.map(s => {
        const tarih = gunEkle(baslangic, s.gun)
        const secili = deger === tarih
        return (
          <button
            key={s.gun}
            type="button"
            aria-pressed={secili}
            onClick={() => onSec(tarih)}
            className={`px-1 py-2 rounded-lg text-sm font-medium border whitespace-nowrap transition-colors ${
              secili
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:text-blue-700 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600'
            }`}
          >
            {s.etiket}
          </button>
        )
      })}
    </div>
  )
}
