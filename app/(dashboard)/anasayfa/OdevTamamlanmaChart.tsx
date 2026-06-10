'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

type DataPoint = {
  id: string
  title: string
  yapildi: number
  eksik: number
  diger: number
  yapildiCount: number
  total: number
}

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
  const router = useRouter()

  const gridColor  = isDark ? '#334155' : '#e5e7eb'
  const textColor  = isDark ? '#94a3b8' : '#9ca3af'
  const tooltipBg  = isDark ? '#1e293b' : '#ffffff'
  const tooltipBrd = isDark ? '#334155' : '#e5e7eb'
  const tooltipTxt = isDark ? '#e2e8f0' : '#374151'

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart
          data={data}
          margin={{ top: 4, right: 4, left: -18, bottom: 0 }}
          onClick={(payload) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const id = (payload as any)?.activePayload?.[0]?.payload?.id as string | undefined
            if (id) router.push(`/odevler/${id}`)
          }}
          style={{ cursor: 'pointer' }}
        >
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
          formatter={(value, name, props) => {
            const p = props.payload as DataPoint
            const label = LABEL[String(name)] ?? String(name)
            if (String(name) === 'yapildi' && p.total > 0) {
              return [`%${value} (${p.yapildiCount}/${p.total})`, label] as [string, string]
            }
            return [`%${value}`, label] as [string, string]
          }}
          labelStyle={{ fontWeight: 600, marginBottom: 2 }}
        />
        <Bar dataKey="yapildi" name="Yapıldı"    stackId="a" fill="#22c55e" />
        <Bar dataKey="eksik"   name="Eksik"      stackId="a" fill="#f59e0b" />
        <Bar dataKey="diger"   name="Yapılmadı"  stackId="a" fill="#ef4444" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
