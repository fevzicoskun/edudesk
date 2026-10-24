import { cache } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { isTeachingRole } from '@/src/shared/types'
import { VeliToplantisiService } from '@/src/domains/mentor/deneme/VeliToplantisiService'
import PrintButton from '@/components/PrintButton'
import VeliToplantisiKagidi from './VeliToplantisiKagidi'

type Props = { params: Promise<{ studentId: string }> }

// Başlık ve sayfa aynı veriyi okur: istek başına tek sorgu
const veri = cache((studentId: string) => VeliToplantisiService.veri(studentId))

// Chrome "PDF olarak kaydet" dosya adını başlıktan alır
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const v = await veri((await params).studentId)
  return { title: v ? { absolute: `${v.ogrenci.ad} - Veli Toplantısı` } : 'Veli Toplantısı' }
}

export default async function VeliToplantisiPage({ params }: Props) {
  const profile = await getCurrentProfile()
  if (!profile?.school_id || !isTeachingRole(profile.role)) redirect('/anasayfa')
  const { studentId } = await params
  const v = await veri(studentId)
  if (!v) notFound()
  return (
    <div className="p-4 md:p-6 print:p-0">
      {/* Kâğıt boşluğu body dolgusuyla: @page kenarı > 0 olunca Chrome tarih/URL basar (globals.css) */}
      <style>{'@page { size: A4; margin: 0 } @media print { body { padding: 12mm !important } }'}</style>
      <div className="flex justify-between items-center gap-3 mb-4 max-w-[210mm] mx-auto print:hidden">
        <Link href={`/mentorluk/${studentId}`} className="text-sm text-gray-600 dark:text-slate-400 hover:text-blue-600">← Öğrenciye dön</Link>
        <PrintButton />
      </div>
      {/* Ekranda A4 önizleme: koyu temada da beyaz kâğıt (kagit sınıfı genel koyu tema kurallarından muaf); iki sayfaya taşabilir */}
      <div className="overflow-x-auto print:overflow-visible">
        <div className="kagit w-[210mm] mx-auto bg-white text-gray-900 shadow-lg p-[12mm] print:w-auto print:shadow-none print:p-0">
          <VeliToplantisiKagidi v={v} />
        </div>
      </div>
    </div>
  )
}
