'use client'

import dynamic from 'next/dynamic'

// Perf raporu #8: recharts'ı veli portalı ilk yükünden ayır (server Section'dan kullanılabilsin diye
// client wrapper). ssr:false yalnızca client component'ten geçerli — OdevTamamlanmaWidget ile aynı desen.
const VeliDevamsizlikChartLazy = dynamic(() => import('./VeliDevamsizlikChart'), { ssr: false })

export default VeliDevamsizlikChartLazy
