// app/(dashboard)/mentorluk/bulten/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { isTeachingRole } from '@/src/shared/types'
import { yazdirmaBasligi } from '@/src/shared/utils'
import { todayLocalISO, addDaysISO } from '@/src/shared/date'
import { BultenService } from '@/src/domains/mentor/services/BultenService'
import { haftaSec, pazartesiMi, haftaEtiketi, whatsappLink } from '@/src/domains/mentor/lib/bultenMath'
import BultenIstemci from './BultenIstemci'

export const metadata = { title: yazdirmaBasligi('Haftalık Veli Bülteni') }

const ikincil = 'inline-flex items-center justify-center min-h-[44px] px-3 rounded-xl border border-gray-200 dark:border-slate-700 text-sm text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-slate-500'

export default async function BultenPage({ searchParams }: { searchParams: Promise<{ hafta?: string | string[] }> }) {
  const profile = await getCurrentProfile()
  if (!profile?.school_id || !isTeachingRole(profile.role)) redirect('/anasayfa')
  const istenen = (await searchParams).hafta
  const hafta = typeof istenen === 'string' && pazartesiMi(istenen) ? istenen : haftaSec(todayLocalISO())
  const b = await BultenService.getBulten(hafta)
  const eksikli = b.ogrenciler.filter(o => o.eksikler.length).length
  const gorsel = (q: string) => `/api/bulten/gorsel?${q}&hafta=${hafta}`

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <Link href="/mentorluk" className="text-sm text-gray-600 dark:text-slate-400 hover:text-blue-600">← Mentörlüğüm</Link>
      <div className="flex flex-wrap items-center justify-between gap-3 mt-1 mb-1">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Haftalık veli bülteni</h1>
        <nav aria-label="Hafta" className="flex items-center gap-2">
          <Link href={`/mentorluk/bulten?hafta=${addDaysISO(hafta, -7)}`} className={ikincil} aria-label="Önceki hafta">‹</Link>
          <span className="text-sm font-semibold text-gray-800 dark:text-slate-200 min-w-[7rem] text-center">{haftaEtiketi(hafta)}</span>
          <Link href={`/mentorluk/bulten?hafta=${addDaysISO(hafta, 7)}`} className={ikincil} aria-label="Sonraki hafta">›</Link>
        </nav>
      </div>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
        Geçen hafta {haftaEtiketi(addDaysISO(hafta, -7))} · {b.ogrenciler.length} öğrenci · {eksikli} öğrencinin eksiği var
      </p>

      {b.ogrenciler.length === 0 ? (
        <div className="text-center border border-dashed border-gray-200 dark:border-slate-700 rounded-2xl p-8">
          <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">Mentörlüğünüzde öğrenci yok</p>
          <Link href="/mentorluk" className={`${ikincil} mt-3`}>Mentörlüğüme öğrenci ekle</Link>
        </div>
      ) : (
        <BultenIstemci
          hafta={hafta}
          gruplar={b.siniflar.map(s => ({
            class_name: s.class_name,
            odevlerUrl: gorsel(`tur=odevler&sinif=${s.class_id}`),
            ozetUrl: gorsel(`tur=ozet&sinif=${s.class_id}`),
          }))}
          ogrenciler={b.ogrenciler.map(o => ({
            student_id: o.student_id, full_name: o.full_name, class_name: o.class_name, eksikSayisi: o.eksikler.length,
            mesaj: o.mesaj, whatsapp: whatsappLink(o.mesaj, o.telefon), gorselUrl: gorsel(`tur=ogrenci&ogrenci=${o.student_id}`),
          }))}
        />
      )}
    </div>
  )
}
