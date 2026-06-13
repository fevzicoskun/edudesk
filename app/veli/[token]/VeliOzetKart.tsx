import type { SubmissionRow } from './VeliOdevlerSection'

type Props = {
  devamsizliklar: { status: 'absent' | 'late' }[]
  odevler: SubmissionRow[]
  today: string
}

export default function VeliOzetKart({ devamsizliklar, odevler, today }: Props) {
  const absentCount = devamsizliklar.filter(a => a.status === 'absent').length
  const toplam = odevler.length
  const tamamlanan = odevler.filter(s => s.status === 'yapildi').length
  const oran = toplam > 0 ? Math.round((tamamlanan / toplam) * 100) : 0
  const aktif = odevler.filter(s => (s.homeworks?.due_date ?? '') >= today).length

  const devRenk = absentCount <= 2
    ? 'bg-green-50 border-green-200 text-green-700'
    : absentCount <= 5
    ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
    : 'bg-red-50 border-red-200 text-red-700'

  const odevRenk = oran >= 80
    ? 'bg-green-50 border-green-200 text-green-700'
    : oran >= 50
    ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
    : 'bg-red-50 border-red-200 text-red-700'

  return (
    <div className="grid grid-cols-3 gap-2">
      <div className={`rounded-2xl border p-3 text-center ${devRenk}`}>
        <p className="text-2xl font-bold">{absentCount}</p>
        <p className="text-[10px] font-medium mt-0.5">Devamsızlık</p>
      </div>
      <div className={`rounded-2xl border p-3 text-center ${odevRenk}`}>
        <p className="text-2xl font-bold">{oran}%</p>
        <p className="text-[10px] font-medium mt-0.5">Ödev Oranı</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-center text-gray-700">
        <p className="text-2xl font-bold">{aktif}</p>
        <p className="text-[10px] font-medium mt-0.5">Aktif Ödev</p>
      </div>
    </div>
  )
}
