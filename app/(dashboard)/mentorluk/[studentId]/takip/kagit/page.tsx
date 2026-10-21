import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { isTeachingRole } from '@/src/shared/types'
import { todayLocalISO } from '@/src/shared/date'
import { haftaBasi } from '@/src/domains/mentor/takip/takipMath'
import { pazartesiMi } from '@/src/domains/mentor/lib/bultenMath'
import { TakipService } from '@/src/domains/mentor/services/TakipService'
import PrintButton from '@/components/PrintButton'
import OgrenciKagidi from '../OgrenciKagidi'

export const metadata = { title: 'Haftalık Çalışma Planı' }

export default async function KagitPage({ params, searchParams }: { params: Promise<{ studentId: string }>; searchParams: Promise<{ hafta?: string }> }) {
  const profile = await getCurrentProfile()
  if (!profile?.school_id || !isTeachingRole(profile.role)) redirect('/anasayfa')
  const { studentId } = await params
  const h = (await searchParams).hafta
  const v = await TakipService.sayfaVerisi(studentId, h && pazartesiMi(h) ? h : haftaBasi(todayLocalISO()))
  if (!v) notFound()
  // Kâğıt açıldı = yazdırma niyeti: sonra verilen ödevler planda "yeni" görünür (kayıt yoksa/kapalıysa yazılmaz)
  await TakipService.kagitBasildi(studentId, v.hafta)
  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto print:p-0 print:max-w-none">
      <div className="flex justify-between items-center mb-4 print:hidden">
        <Link href={`/mentorluk/${studentId}/takip?hafta=${v.hafta}`} className="text-sm text-gray-600 dark:text-slate-400 hover:text-blue-600">← Plana dön</Link>
        <PrintButton />
      </div>
      <OgrenciKagidi v={v} veri={v.taslak} />
    </div>
  )
}
