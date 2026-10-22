import { cache } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { isTeachingRole } from '@/src/shared/types'
import { todayLocalISO } from '@/src/shared/date'
import { haftaBasi, haftaBaslangicMi, takipHaftaEtiketi } from '@/src/domains/mentor/takip/takipMath'
import { TakipService } from '@/src/domains/mentor/services/TakipService'
import PrintButton from '@/components/PrintButton'
import OgrenciKagidi from '../OgrenciKagidi'

type Props = { params: Promise<{ studentId: string }>; searchParams: Promise<{ hafta?: string }> }

// Başlık ve sayfa aynı veriyi okur: istek başına tek sorgu
const veri = cache((studentId: string, h?: string) =>
  TakipService.sayfaVerisi(studentId, h && haftaBaslangicMi(h) ? h : haftaBasi(todayLocalISO())))

// Chrome "PDF olarak kaydet" dosya adını başlıktan alır: "Ad Soyad - Haftalık Çalışma Planı 23–29 Ekim" (okul eki yok)
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const v = await veri((await params).studentId, (await searchParams).hafta)
  return { title: v ? { absolute: `${v.ogrenci.ad} - Haftalık Çalışma Planı ${takipHaftaEtiketi(v.hafta)}` } : 'Haftalık Çalışma Planı' }
}

export default async function KagitPage({ params, searchParams }: Props) {
  const profile = await getCurrentProfile()
  if (!profile?.school_id || !isTeachingRole(profile.role)) redirect('/anasayfa')
  const { studentId } = await params
  const v = await veri(studentId, (await searchParams).hafta)
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
