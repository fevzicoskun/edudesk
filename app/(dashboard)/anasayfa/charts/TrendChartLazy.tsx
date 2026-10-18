'use client'

import dynamic from 'next/dynamic'

// recharts (~99 KB gzip) statik import'la öğretmen/MY ana sayfasına da iniyordu; grafik yalnız müdür
// trend kartında. ssr:false yalnız client component'ten geçerli — VeliDevamsizlikChartLazy ile aynı desen.
// Yer tutucu grafikle aynı yükseklikte (h-48): yüklenince sayfa kaymaz.
const TrendChartLazy = dynamic(() => import('./TrendChart'), {
  ssr: false,
  loading: () => <div className="h-48 w-full rounded-lg bg-gray-100 dark:bg-slate-700/40 animate-pulse" />,
})

export default TrendChartLazy
