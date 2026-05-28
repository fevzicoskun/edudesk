'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

type DataPoint = { title: string; yapildi: number; eksik: number; diger: number }

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

const LABEL: Record<string, string> = { yapildi: 'Yapıldı', eksik: 'Eksik', diger: 'Yapılmadı' }

export default function OdevTamamlanmaChart({ data }: { data: DataPoint[] }) {
  const isDark = useIsDark()

  const gridColor  = isDark ? '#334155' : '#e5e7eb'
  const textColor  = isDark ? '#94a3b8' : '#9ca3af'
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
          tickFormatter={v => `${v}%`}
          domain={[0, 100]}
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
          formatter={(value, name) => [`%${value}`, LABEL[String(name)] ?? String(name)] as [string, string]}
          labelStyle={{ fontWeight: 600, marginBottom: 2 }}
        />
        <Bar dataKey="yapildi" name="Yapıldı"    stackId="a" fill="#22c55e" />
        <Bar dataKey="eksik"   name="Eksik"      stackId="a" fill="#f59e0b" />
        <Bar dataKey="diger"   name="Yapılmadı"  stackId="a" fill="#ef4444" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
