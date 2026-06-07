import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { YoklamaTrendItem } from '@/src/domains/dashboard/types'

const YoklamaTrendChart = dynamic(() => import('./YoklamaTrendChart'), { ssr: false })

export default function YoklamaTrendWidget({ data }: { data: YoklamaTrendItem[] }) {
  return (
    <Card className="border-gray-200 dark:border-slate-700 shadow-sm">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-semibold text-gray-700 dark:text-slate-300">
          Devamsızlık Trendi
        </CardTitle>
        <p className="text-xs text-gray-400 dark:text-slate-500">Son 8 hafta · %</p>
      </CardHeader>
      <CardContent className="pt-2 pb-4">
        {data.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-sm text-gray-400 dark:text-slate-500">
            Henüz yoklama kaydı yok.
          </div>
        ) : (
          <YoklamaTrendChart data={data} />
        )}
      </CardContent>
    </Card>
  )
}
