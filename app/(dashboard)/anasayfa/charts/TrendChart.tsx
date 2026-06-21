'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export type TrendChartPoint = { label: string; rate: number }

export default function TrendChart({ data, color }: { data: TrendChartPoint[]; color: string; format: 'percent' }) {
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis
            domain={[0, 1]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
            tickFormatter={(v: number) => `%${Math.round(v * 100)}`}
          />
          <Tooltip
            formatter={(v) => [`%${Math.round(Number(v) * 100)}`, 'Oran']}
            labelClassName="text-xs"
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Line type="monotone" dataKey="rate" stroke={color} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
