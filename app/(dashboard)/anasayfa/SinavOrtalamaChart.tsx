'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'

type DataPoint = { title: string; ortalama: number; katilimci: number }

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

function barColor(avg: number) {
  if (avg >= 70) return '#6366f1'
  if (avg >= 50) return '#f59e0b'
  return '#ef4444'
}

export default function SinavOrtalamaChart({ data }: { data: DataPoint[] }) {
  const isDark = useIsDark()

  const gridColor  = isDark ? '#334155' : '#e5e7eb'
  const textColor  = isDark ? '#94a3b8' : '#9ca3af'
  const refColor   = isDark ? '#475569' : '#d1d5db'
  const tooltipBg  = isDark ? '#1e293b' : '#ffffff'
  const tooltipBrd = isDark ? '#334155' : '#e5e7eb'
  const tooltipTxt = isDark ? '#e2e8f0' : '#374151'

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
        <XAxis
          dataKey="title"
          tick={{ fontSize: 9, fill: textColor }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: textColor }}
          axisLine={false}
          tickLine={false}
          domain={[0, 100]}
          width={32}
        />
        <ReferenceLine y={50} stroke={refColor} strokeDasharray="3 3" />
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
            return [`${value} puan · ${d.katilimci} öğrenci`, 'Ortalama'] as [string, string]
          }}
          labelStyle={{ fontWeight: 600, marginBottom: 2 }}
        />
        <Bar dataKey="ortalama" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={barColor(entry.ortalama)} fillOpacity={isDark ? 0.85 : 0.9} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
