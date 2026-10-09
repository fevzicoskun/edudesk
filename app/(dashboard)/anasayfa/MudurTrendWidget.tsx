// app/(dashboard)/anasayfa/MudurTrendWidget.tsx
import Link from 'next/link'
import { requireSchoolId } from '@/src/shared/auth'
import { getSchoolTrends } from '@/src/domains/dashboard/queries/schoolTrends'
import { filledWeekCount } from '@/src/domains/dashboard/lib/trendMath'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import TrendChart from './charts/TrendChart'

const MIN_WEEKS = 2

export default async function MudurTrendWidget() {
  const school_id = await requireSchoolId()
  const { absence: absenceTrend, activity: activityTrend, coverage: coverageTrend, classAbs: classAbsence } = await getSchoolTrends(school_id)

  const enoughAbsence = filledWeekCount(absenceTrend) >= MIN_WEEKS
  const enoughActivity = filledWeekCount(activityTrend) >= MIN_WEEKS
  const enoughCoverage = coverageTrend.filter(p => p.expected > 0).length >= MIN_WEEKS

  const maxClassRate = classAbsence[0]?.rate ?? 0

  // Yalnız verisi yeten trendler grafik olur; tek grafik tam genişlik alır (yanında boş "birikiyor" kartı kalmasın).
  // Verisi biriken trendler tek, küçük bir bilgi satırında toplanır.
  const trendler = [
    { ad: 'Devamsızlık oranı', yeter: enoughAbsence, hafta: filledWeekCount(absenceTrend), data: absenceTrend, renk: '#ef4444' },
    { ad: 'Öğretmen aktivite oranı', yeter: enoughActivity, hafta: filledWeekCount(activityTrend), data: activityTrend, renk: '#10b981' },
    { ad: 'Yoklama kapsama oranı', yeter: enoughCoverage, hafta: coverageTrend.filter(p => p.expected > 0).length, data: coverageTrend, renk: '#3b82f6' },
  ]
  const grafikler = trendler.filter(t => t.yeter)
  const birikenler = trendler.filter(t => !t.yeter)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {grafikler.map((t, i) => (
        // tek sayıdaysa son grafik satırı tek başına doldurur
        <Card key={t.ad} className={grafikler.length % 2 === 1 && i === grafikler.length - 1 ? 'lg:col-span-2' : ''}>
          <CardHeader><CardTitle className="text-sm">{t.ad} (haftalık)</CardTitle></CardHeader>
          <CardContent>
            <TrendChart data={t.data} color={t.renk} format="percent" />
          </CardContent>
        </Card>
      ))}

      {birikenler.length > 0 && (
        <p className="lg:col-span-2 text-sm text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3">
          Trend için veri birikiyor (en az {MIN_WEEKS} hafta gerekiyor):{' '}
          {birikenler.map(t => `${t.ad.toLocaleLowerCase('tr')} — ${t.hafta} hafta`).join(' · ')}
        </p>
      )}

      {/* Sınıf karşılaştırması */}
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-sm">Sınıf karşılaştırması — devamsızlık</CardTitle></CardHeader>
        <CardContent>
          {classAbsence.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-slate-400">Henüz yoklama girilmemiş.</p>
          ) : (
            <ul className="space-y-2">
              {classAbsence.map(c => (
                <li key={c.classId}>
                  <Link href={`/siniflar/${c.classId}`} className="flex items-center gap-3 group">
                    <span className="w-16 shrink-0 text-sm text-gray-700 dark:text-slate-300 group-hover:underline">{c.name}</span>
                    <span className="flex-1 h-3 rounded bg-gray-100 dark:bg-slate-800 overflow-hidden">
                      <span
                        className="block h-full bg-red-400"
                        style={{ width: `${maxClassRate === 0 ? 0 : Math.round((c.rate / maxClassRate) * 100)}%` }}
                      />
                    </span>
                    <span className="w-12 shrink-0 text-right text-sm tabular-nums text-gray-600 dark:text-slate-400">%{Math.round(c.rate * 100)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
