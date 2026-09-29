import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { fetchAll } from '@/src/shared/utils/fetchAll'
import { todayLocalISO } from '@/src/shared/date'
import { isMudurOrAbove } from '@/src/shared/types'
import { dersAnahtari } from '@/src/domains/homework/lib/stats'
import { odevTakibi, GECIKME_GUNU, RISK_ESIGI, type TakipOdev, type TakipTeslim } from '@/src/domains/homework/lib/odev-takibi'

export const metadata = { title: 'Ödev Takibi' }

const KONTROL_EDILEN_ILK = 10

const kutu = 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 md:p-5 mb-4'
const baslik = 'text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3'
const soluk = 'text-xs text-gray-500 dark:text-slate-400'

export default async function OdevTakibiPage({ searchParams }: { searchParams: Promise<{ ders?: string | string[] }> }) {
  const profile = await getCurrentProfile()
  if (!profile?.school_id || !isMudurOrAbove(profile.role)) redirect('/anasayfa')

  const dersParam = (await searchParams).ders
  const ders = typeof dersParam === 'string' && dersParam.trim() ? dersParam : null

  const sid = profile.school_id
  const supabase = await createClient()

  // fetchAll hata fırlatır → error.tsx; eksik veriyle "0 ödev" gibi yanıltıcı ekran gösterilmez
  const [homeworks, submissions, students, classes, profiles] = await Promise.all([
    fetchAll<TakipOdev>((f, t) => supabase
      .from('homeworks')
      .select('id, title, subject, class_id, teacher_id, due_date, assigned_date')
      .eq('school_id', sid).is('deleted_at', null).eq('is_template', false)
      .order('id').range(f, t)),
    fetchAll<TakipTeslim>((f, t) => supabase
      .from('homework_submissions')
      // yalnız öğretmenin işaretledikleri — otomatik açılan boş satırlar 'yapılmadı' değildir
      .select('homework_id, student_id, status, marked_at, homeworks!inner(id)')
      .eq('school_id', sid).not('marked_at', 'is', null)
      .is('homeworks.deleted_at', null).eq('homeworks.is_template', false)
      .order('id').range(f, t)),
    fetchAll<{ id: string; full_name: string; class_id: string }>((f, t) => supabase
      .from('students').select('id, full_name, class_id')
      .eq('school_id', sid).is('deleted_at', null)
      .order('id').range(f, t)),
    fetchAll<{ id: string; name: string }>((f, t) => supabase
      .from('classes').select('id, name').eq('school_id', sid)
      .order('id').range(f, t)),
    fetchAll<{ id: string; full_name: string }>((f, t) => supabase
      .from('profiles').select('id, full_name').eq('school_id', sid)
      .order('id').range(f, t)),
  ])

  const r = odevTakibi({
    homeworks, submissions, students, ders,
    ogretmenler: new Map(profiles.map(p => [p.id, p.full_name])),
    siniflar: new Map(classes.map(c => [c.id, c.name])),
    bugun: todayLocalISO(),
  })
  const seciliDers = ders ? r.dersler.find(d => d.anahtar === dersAnahtari(ders)) ?? null : null
  const gecikmisIds = new Set(r.gecikenler.map(g => g.id))

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Ödev Takibi</h1>
        <Link href="/yonetim" className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">← Okul Durumu</Link>
      </div>

      {r.dersler.length === 0 ? (
        <p className={kutu + ' text-sm text-gray-600 dark:text-slate-400'}>Henüz verilmiş ödev yok.</p>
      ) : (
        <>
          <nav aria-label="Derse göre süz" className="flex flex-wrap gap-2 mb-4">
            <Cip href="/yonetim/odevler" secili={!seciliDers}>Tümü</Cip>
            {r.dersler.map(d => (
              <Cip key={d.anahtar} href={`/yonetim/odevler?ders=${encodeURIComponent(d.anahtar)}`} secili={seciliDers?.anahtar === d.anahtar}>
                {d.ad}
              </Cip>
            ))}
          </nav>

          <section className={kutu} aria-labelledby="ders-baslik">
            <h2 id="ders-baslik" className={baslik}>Derslere göre verilen ödevler</h2>
            <ul className="divide-y divide-gray-100 dark:divide-slate-700" data-testid="ders-satirlari">
              {(seciliDers ? [seciliDers] : r.dersler).map(d => (
                <li key={d.anahtar} className="py-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0">
                    <span className="font-medium text-gray-900 dark:text-slate-100">{d.ad}</span>{' '}
                    <span className="text-gray-700 dark:text-slate-300">{d.odev} ödev</span>
                    <div className={soluk}>{d.girenler.map(g => `${g.ad} ${g.sayi}`).join(', ')}</div>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-slate-400">
                    {d.kontrolEdildi} kontrol edildi
                    {d.kontrolEdilecek > 0 && <> · <span className="text-red-700 dark:text-red-400 font-medium">{d.kontrolEdilecek} kontrol edilecek</span></>}
                    {d.bekliyor > 0 && <> · {d.bekliyor} teslimi gelmedi</>}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className={kutu} aria-labelledby="risk-baslik">
            <h2 id="risk-baslik" className={baslik}>Riskliler</h2>

            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400 mb-1">
              Öğrenciler <span className="normal-case font-normal">({RISK_ESIGI}+ yapılmadı/eksik)</span>
            </h3>
            {r.riskliOgrenciler.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">Riskli öğrenci yok.</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-slate-700 mb-4" data-testid="riskli-ogrenciler">
                {r.riskliOgrenciler.map(o => (
                  <li key={o.id} className="py-2 flex flex-wrap items-baseline justify-between gap-x-4">
                    <Link href={`/siniflar/${o.sinifId}/ogrenciler/${o.id}`} className="font-medium text-gray-900 dark:text-slate-100 hover:underline">
                      {o.ad} <span className={soluk}>{o.sinif}</span>
                    </Link>
                    <span className="text-sm text-gray-700 dark:text-slate-300">
                      <span className="text-red-700 dark:text-red-400 font-semibold">{o.toplam}</span>{' '}
                      <span className={soluk}>({o.dersler.map(d => `${d.ad} ${d.sayi}`).join(', ')})</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400 mb-1">
              Bekleyen kontroller <span className="normal-case font-normal">({GECIKME_GUNU} günden fazla)</span>
            </h3>
            {r.gecikenler.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-slate-400">Geciken kontrol yok.</p>
            ) : (
              <p className="text-sm text-red-700 dark:text-red-400" data-testid="geciken-ozet">
                {r.gecikenler.length} ödev {GECIKME_GUNU} günden uzun süredir kontrol bekliyor — aşağıda kırmızı.
              </p>
            )}
          </section>

          <section className={kutu} aria-labelledby="edilecek-baslik">
            <h2 id="edilecek-baslik" className={baslik}>Kontrol edilecek ({r.kontrolEdilecek.length})</h2>
            {r.kontrolEdilecek.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-slate-400">Teslimi geçmiş, kontrol bekleyen ödev yok.</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-slate-700" data-testid="kontrol-edilecek">
                {r.kontrolEdilecek.map(k => (
                  <OdevSatiri key={k.id} k={k} sag={
                    <span className={gecikmisIds.has(k.id) ? 'text-red-700 dark:text-red-400 font-semibold' : 'text-gray-600 dark:text-slate-400'}>
                      {k.gun} gündür bekliyor
                    </span>
                  } />
                ))}
              </ul>
            )}
          </section>

          <section className={kutu} aria-labelledby="edilen-baslik">
            <h2 id="edilen-baslik" className={baslik}>Kontrol edilen ({r.kontrolEdilen.length})</h2>
            {r.kontrolEdilen.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-slate-400">Henüz kontrol edilmiş ödev yok.</p>
            ) : (
              <KontrolEdilenListe satirlar={r.kontrolEdilen} />
            )}
          </section>
        </>
      )}
    </div>
  )
}

function Cip({ href, secili, children }: { href: string; secili: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={secili ? 'page' : undefined}
      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
        secili
          ? 'bg-blue-600 border-blue-600 text-white'
          : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
      }`}
    >
      {children}
    </Link>
  )
}

function OdevSatiri({ k, sag }: { k: { id: string; title: string; subject: string; sinif: string; ogretmen: string }; sag: React.ReactNode }) {
  return (
    <li className="py-2">
      <Link href={`/odevler/${k.id}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 hover:bg-gray-50 dark:hover:bg-slate-700/40 rounded -mx-1 px-1">
        <span className="min-w-0">
          <span className="font-medium text-gray-900 dark:text-slate-100">{k.title}</span>
          <span className={'block ' + soluk}>{k.subject} · {k.sinif} · {k.ogretmen}</span>
        </span>
        <span className="text-sm">{sag}</span>
      </Link>
    </li>
  )
}

function KontrolEdilenListe({ satirlar }: { satirlar: { id: string; title: string; subject: string; sinif: string; ogretmen: string; yapildi: number; eksik: number; yapilmadi: number }[] }) {
  const satir = (k: (typeof satirlar)[number]) => (
    <OdevSatiri key={k.id} k={k} sag={
      <span className="text-gray-700 dark:text-slate-300">
        {k.yapildi} yapıldı · {k.eksik} eksik · <span className={k.yapilmadi > 0 ? 'text-red-700 dark:text-red-400' : ''}>{k.yapilmadi} yapılmadı</span>
      </span>
    } />
  )
  const ilk = satirlar.slice(0, KONTROL_EDILEN_ILK)
  const kalan = satirlar.slice(KONTROL_EDILEN_ILK)
  return (
    <>
      <ul className="divide-y divide-gray-100 dark:divide-slate-700" data-testid="kontrol-edilen">{ilk.map(satir)}</ul>
      {kalan.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-sm text-blue-700 dark:text-blue-400 py-2">+{kalan.length} daha</summary>
          <ul className="divide-y divide-gray-100 dark:divide-slate-700">{kalan.map(satir)}</ul>
        </details>
      )}
    </>
  )
}
