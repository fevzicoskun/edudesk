'use client'

import { useEffect, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

type DataPoint = { hafta: string; oran: number; devamsiz: number; toplam: number }

function useIsDark() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const check = () => setDark(document.documentElement.classList.contains('dark'))
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return dark
}

export default function YoklamaTrendChart({ data }: { data: DataPoint[] }) {
  const isDark = useIsDark()

  const gridColor  = isDark ? '#334155' : '#e5e7eb'
  const textColor  = isDark ? '#94a3b8' : '#9ca3af'
  const STROKE     = '#ef4444'
  const tooltipBg  = isDark ? '#1e293b' : '#ffffff'
  const tooltipBrd = isDark ? '#334155' : '#e5e7eb'
  const tooltipTxt = isDark ? '#e2e8f0' : '#374151'

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="devGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={STROKE} stopOpacity={isDark ? 0.3 : 0.15} />
            <stop offset="95%" stopColor={STROKE} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
        <XAxis
          dataKey="hafta"
          tick={{ fontSize: 10, fill: textColor }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: textColor }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => `%${v}`}
          domain={[0, 'auto']}
          width={32}
        />
        <Tooltip
          contentStyle={{
            background: tooltipBg,
            border: `1px solid ${tooltipBrd}`,
            borderRadius: '0.5rem',
            fontSize: '12px',
            color: tooltipTxt,
          }}
          formatter={(value, _name, item) => {
            const d = (item as { payload: DataPoint }).payload
            return [`%${value}  (${d.devamsiz}/${d.toplam} öğrenci)`, 'Devamsızlık'] as [string, string]
          }}
          labelStyle={{ fontWeight: 600, marginBottom: 2 }}
        />
        <Area
          type="monotone"
          dataKey="oran"
          stroke={STROKE}
          strokeWidth={2}
          fill="url(#devGrad)"
          dot={{ fill: STROKE, strokeWidth: 0, r: 3 }}
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
