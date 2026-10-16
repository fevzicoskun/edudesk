// app/(dashboard)/mentorluk/[studentId]/takip/page.tsx
import { notFound, redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { isTeachingRole } from '@/src/shared/types'
import { todayLocalISO } from '@/src/shared/date'
import { weekStartOf } from '@/src/domains/studyPlan/planMath'
import { pazartesiMi } from '@/src/domains/mentor/lib/bultenMath'
import { TakipService } from '@/src/domains/mentor/services/TakipService'
import TakipIstemci, { type Sekme } from './TakipIstemci'

export const metadata = { title: 'Haftalık Takip' }
const SEKMELER: Sekme[] = ['plan', 'sonuc', 'veli', 'dosya']

export default async function TakipPage({ params, searchParams }: {
  params: Promise<{ studentId: string }>; searchParams: Promise<{ hafta?: string; sekme?: string }>
}) {
  const profile = await getCurrentProfile()
  if (!profile?.school_id || !isTeachingRole(profile.role)) redirect('/anasayfa')
  const { studentId } = await params
  const sp = await searchParams
  const hafta = sp.hafta && pazartesiMi(sp.hafta) ? sp.hafta : weekStartOf(todayLocalISO())
  const v = await TakipService.sayfaVerisi(studentId, hafta)
  if (!v) notFound() // bayrak kapalı / mentörü değil / öğrenci yok — hepsi aynı 404 (varlık sızdırma yok)
  const sekme: Sekme = SEKMELER.find(s => s === sp.sekme) ?? 'plan'
  return <TakipIstemci key={`${studentId}-${hafta}`} v={v} sekme={sekme} />
}
