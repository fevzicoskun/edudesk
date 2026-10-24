import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { isTeachingRole } from '@/src/shared/types'
import { MentorService } from '@/src/domains/mentor/services/MentorService'
import { HomeworkService } from '@/src/domains/homework/services/HomeworkService'
import { createClient } from '@/src/infrastructure/supabase/server'
import { todayLocalISO } from '@/src/shared/date'
import { donemBasi } from '@/src/shared/utils'
import { basTarihi, mentorTablosu } from '@/src/domains/mentor/lib/mentorTablosu'
import { TakipService } from '@/src/domains/mentor/services/TakipService'
import { haftaBasi, haftaKaydir, gecenHaftaOzeti, buHaftaEtiketi } from '@/src/domains/mentor/takip/takipMath'
import OgrenciEkleKarti from './OgrenciEkleKarti'
import MentorTablosu from './MentorTablosu'
import KitapHerkeseFormu from './KitapHerkeseFormu'

export const metadata = { title: 'Mentörlük' }

const ikincilButon = 'px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700'

export default async function MentorlukPage({ searchParams }: { searchParams: Promise<{ bas?: string | string[] }> }) {
  const profile = await getCurrentProfile()
  if (!profile?.school_id) redirect('/anasayfa')
  if (!isTeachingRole(profile.role)) redirect('/anasayfa')

  const bugun = todayLocalISO()
  const bas = basTarihi((await searchParams).bas, donemBasi(), bugun)
  const [rows, adlar, supabase] = await Promise.all([
    MentorService.getMyMentorships(), MentorService.getMentorAdlari(), createClient(),
  ])

  // Ekleme kutusu için okul öğrencileri (zaten listede olanlar çıkarılır)
  const [{ data: ogrenciler }, sonuc] = await Promise.all([
    supabase
      .from('students')
      .select('id, full_name, classes(name)')
      .eq('school_id', profile.school_id)
      .is('deleted_at', null)
      .order('full_name')
      .limit(1000),
    HomeworkService.getMentorHomeworkProfiles(rows.map(r => r.student_id), bas),
  ])
  if ('error' in sonuc) throw new Error(sonuc.error)

  const listedekiler = new Set(rows.map(r => r.student_id))
  const eklenebilir = (ogrenciler ?? [])
    .filter(o => !listedekiler.has(o.id))
    .map(o => ({
      id: o.id,
      full_name: o.full_name,
      class_name: (o.classes as { name: string } | null)?.name ?? null,
      mentor: adlar.get(o.id)?.ad ?? null,
    }))

  const tablo = mentorTablosu(sonuc.ogrenciler.map(o => ({
    id: o.id, full_name: o.full_name, class_name: o.class_name, homeworks: o.homeworks,
  })))
  // Haftalık takip açık mentörde: bu haftanın durumu (Plan yok / Kâğıtta / Devam ediyor · x/y görev)
  const takipAcik = await TakipService.acikMi()
  const ids = rows.map(r => r.student_id)
  const [durum, gecenDurum] = takipAcik
    ? await Promise.all([TakipService.durumlar(ids, haftaBasi(bugun)), TakipService.durumlar(ids, haftaKaydir(haftaBasi(bugun), -1))])
    : [null, null]
  const gecen = gecenDurum ? Object.fromEntries(ids.map(id => [id, gecenHaftaOzeti(gecenDurum.get(id) ?? null)])) : undefined
  const takip = durum ? Object.fromEntries(rows.map(r => [r.student_id, buHaftaEtiketi(durum.get(r.student_id) ?? null)])) : undefined

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Mentörlüğüm</h1>
        <span className="text-sm text-gray-500 dark:text-slate-400">{rows.length} öğrenci</span>
      </div>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-5">
        Mentörlük yaptığın öğrenciler ve tüm derslerdeki ödev durumları. Notların yalnızca sana görünür.
      </p>

      {rows.length > 0 && (
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <form method="get" className="flex items-end gap-2">
            <label className="text-sm text-gray-600 dark:text-slate-400">
              Şu tarihten itibaren
              <input
                type="date" name="bas" defaultValue={bas} max={bugun}
                className="block mt-1 px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg text-base bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
              />
            </label>
            <button className={ikincilButon}>Uygula</button>
          </form>
          <div className="flex gap-2">
            <Link href={`/mentorluk/tablo?bas=${bas}`} className={ikincilButon}>Tabloyu yazdır</Link>
            <Link href={`/mentorluk/yazdir?bas=${bas}`} className={ikincilButon}>Ödev özetlerini yazdır</Link>
            <Link href="/mentorluk/bulten" className={ikincilButon}>Haftalık veli bülteni</Link>
            {takipAcik && <Link href="/mentorluk/takip-kagitlari" className={ikincilButon}>Tüm planları yazdır</Link>}
            {takipAcik && <Link href="/mentorluk/denemeler" className={ikincilButon}>Denemeler</Link>}
            {takipAcik && <Link href="/mentorluk/veli-toplantisi" className={ikincilButon}>Veli toplantısı kâğıtları</Link>}
          </div>
        </div>
      )}
      {takipAcik && rows.length > 0 && <KitapHerkeseFormu dersler={await TakipService.dersSecenekleri()} />}

      {rows.length === 0 ? (
        <div className="mb-6 text-center border border-dashed border-gray-200 dark:border-slate-700 rounded-2xl p-8">
          <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">Henüz öğrenci eklemedin</p>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Aşağıdan öğrenci ekleyerek tanıma kartını doldurmaya ve görüşme notu tutmaya başlayabilirsin.
          </p>
        </div>
      ) : (
        <div className="mb-6">
          <MentorTablosu tablo={tablo} bas={bas} takip={takip} gecen={gecen} />
        </div>
      )}

      <div className="max-w-3xl">
        <OgrenciEkleKarti ogrenciler={eklenebilir} />
      </div>

    </div>
  )
}
