import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { OdevTamamlanmaItem } from '@/src/domains/dashboard/types'

const OdevTamamlanmaChart = dynamic(() => import('./OdevTamamlanmaChart'), { ssr: false })

export default function OdevTamamlanmaWidget({ data }: { data: OdevTamamlanmaItem[] }) {
  return (
    <Card className="border-gray-200 dark:border-slate-700 shadow-sm">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-semibold text-gray-700 dark:text-slate-300">
          Ödev Tamamlanma Oranları
        </CardTitle>
        <p className="text-xs text-gray-400 dark:text-slate-500">Son 6 ödev · %</p>
      </CardHeader>
      <CardContent className="pt-2 pb-4">
        {data.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-sm text-gray-400 dark:text-slate-500">
            Geçmiş ödev bulunamadı.
          </div>
        ) : (
          <OdevTamamlanmaChart data={data} />
        )}
      </CardContent>
    </Card>
  )
}
