import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { isTeachingRole } from '@/src/shared/types'
import { todayLocalISO } from '@/src/shared/date'
import { haftaBasi, haftaBaslangicMi, takipHaftaEtiketi } from '@/src/domains/mentor/takip/takipMath'
import { MentorService } from '@/src/domains/mentor/services/MentorService'
import { TakipService } from '@/src/domains/mentor/services/TakipService'
import PrintButton from '@/components/PrintButton'
import OgrenciKagidi from '../[studentId]/takip/OgrenciKagidi'

type Props = { searchParams: Promise<{ hafta?: string }> }
const haftaOf = (h?: string) => h && haftaBaslangicMi(h) ? h : haftaBasi(todayLocalISO())

// Chrome "PDF olarak kaydet" dosya adını başlıktan alır: "Haftalık Çalışma Planları 23–29 Ekim" (okul eki yok)
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return { title: { absolute: `Haftalık Çalışma Planları ${takipHaftaEtiketi(haftaOf((await searchParams).hafta))}` } }
}

/** Planı kayıtlı tüm mentör öğrencilerinin kâğıtları, öğrenci başına bir A4. */
export default async function TakipKagitlariPage({ searchParams }: Props) {
  const profile = await getCurrentProfile()
  if (!profile?.school_id || !isTeachingRole(profile.role)) redirect('/anasayfa')
  if (!(await TakipService.acikMi())) notFound()
  const hafta = haftaOf((await searchParams).hafta)
  const rows = await MentorService.getMyMentorships()
  // Bu haftaya dokunulmamış ama planı geçen haftadan devam eden öğrenci de dahil (taslak = geçen haftanın kopyası)
  const planli = await TakipService.planliOgrenciler(rows.map(r => r.student_id), hafta)
  // ponytail: öğrenci başına sayfaVerisi (birkaç sorgu); 40+ öğrencide toplu sorguya geç
  const veriler = (await Promise.all(rows.filter(r => planli.has(r.student_id)).map(r => TakipService.sayfaVerisi(r.student_id, hafta))))
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.ogrenci.ad.localeCompare(b.ogrenci.ad, 'tr'))
  await Promise.all(veriler.map(v => TakipService.kagitBasildi(v.ogrenci.id, hafta))) // "yeni ödev" uyarısı için
  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto print:p-0 print:max-w-none">
      <div className="flex justify-between items-start mb-4 print:hidden">
        <div>
          <Link href="/mentorluk" className="text-sm text-gray-600 dark:text-slate-400 hover:text-blue-600">← Mentörlüğüm</Link>
          <h1 className="text-lg font-bold mt-1">Haftalık planlar · {takipHaftaEtiketi(hafta)}</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">{veriler.length} öğrenci · hiç planı olmayanlar listede yok</p>
        </div>
        {veriler.length > 0 && <PrintButton />}
      </div>
      {veriler.length === 0
        ? <p className="text-sm text-gray-500 dark:text-slate-400 py-10 text-center">Bu hafta planı hazırlanmış öğrenci yok.</p>
        : veriler.map(v => (
            <section key={v.ogrenci.id} aria-label={v.ogrenci.ad} className="break-after-page last:break-after-auto mb-8 print:mb-0">
              <OgrenciKagidi v={v} veri={v.taslak} />
            </section>
          ))}
    </div>
  )
}
