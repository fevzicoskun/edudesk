'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { parseISO, getMonth, getYear, format } from 'date-fns'
import { tr } from 'date-fns/locale'

type AttendanceRow = { date: string; status: 'absent' | 'late' }
type MonthData = { month: string; gelmedi: number; gecGeldi: number }

export function groupAttendanceByMonth(rows: AttendanceRow[]): MonthData[] {
  const map = new Map<string, MonthData>()
  for (const a of rows) {
    const d = parseISO(a.date)
    const key = `${getYear(d)}-${String(getMonth(d) + 1).padStart(2, '0')}`
    const label = format(d, 'MMM', { locale: tr })
    if (!map.has(key)) map.set(key, { month: label, gelmedi: 0, gecGeldi: 0 })
    const entry = map.get(key)!
    if (a.status === 'absent') entry.gelmedi++
    else if (a.status === 'late') entry.gecGeldi++
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-3)
    .map(([, v]) => v)
}

export default function VeliDevamsizlikChart({ attendance }: { attendance: AttendanceRow[] }) {
  const data = groupAttendanceByMonth(attendance)
  if (data.length === 0) return null

  return (
    <div className="mb-4">
      <p className="text-xs font-medium text-gray-500 mb-2">Son 3 Ay</p>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={data} margin={{ top: 0, right: 4, left: -28, bottom: 0 }}>
          <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(value, name) => [
              value,
              name === 'gelmedi' ? 'Gelmedi' : 'Geç Geldi',
            ]}
          />
          <Bar dataKey="gelmedi" stackId="a" fill="#ef4444" name="Gelmedi" />
          <Bar dataKey="gecGeldi" stackId="a" fill="#f97316" name="Geç Geldi" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
