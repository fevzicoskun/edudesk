import { cache, type ReactNode } from 'react'
import Link from 'next/link'
import { createClient } from '@/src/infrastructure/supabase/server'
import { requireSchoolId } from '@/src/shared/auth'
import { format, parseISO, todayLocalISO, todayWeekdayTR } from '@/src/shared/date'
import { odevTakibiVerisi } from '@/src/domains/homework/queries/odevTakibiVerisi'
import { GECIKME_GUNU } from '@/src/domains/homework/lib/odev-takibi'
import { getOkulKullanim, getSchoolTeachers } from '@/src/domains/dashboard/queries/schoolStats'
import { ogretmenTakibi, bultenIlerlemesi, mentorsuzSiniflar } from '@/src/domains/dashboard/lib/yoneticiOzeti'
import { DutyService } from '@/src/domains/schedule/services/DutyService'
import { haftaSec, haftaEtiketi } from '@/src/domains/mentor/lib/bultenMath'

/** MY/müdür ana sayfasının dört bölümü (spec 2026-10-10). Ödev rakamları Ödev Takibi ile aynı kaynaktan. */

// aynı istekte Bugün, Ödev ve Öğretmen bölümleri tek okuma paylaşır
const odevVerisi = cache(async (sid: string) => odevTakibiVerisi(await createClient(), sid, null))

const kart = 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl'
const soluk = 'text-gray-500 dark:text-slate-400'
const bag = 'text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline'

function Bolum({ baslik, sag, children }: { baslik: string; sag?: ReactNode; children: ReactNode }) {
  return (
    <section className={kart} aria-label={baslik}>
      <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-slate-200">{baslik}</h2>
        {sag}
      </div>
      {children}
    </section>
  )
}

function Sayi({ deger, etiket, kotu, href }: { deger: number; etiket: string; kotu?: boolean; href?: string }) {
  const ic = (
    <>
      <p className={`text-2xl font-bold leading-none ${kotu ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-slate-100'}`}>{deger}</p>
      <p className={`text-xs mt-1 ${soluk}`}>{etiket}</p>
    </>
  )
  return href ? <Link href={href} className="block hover:opacity-80">{ic}</Link> : <div>{ic}</div>
}

// ── 1. Bugün ─────────────────────────────────────────────────────────────────

export async function BugunBolumu() {
  const [supabase, sid] = await Promise.all([createClient(), requireSchoolId()])
  const bugun = todayLocalISO()
  const gun = todayWeekdayTR()
  const [odev, nobetler, teslim, etkinlik] = await Promise.all([
    odevVerisi(sid),
    DutyService.listSchoolDuties(),
    supabase.from('homeworks').select('id', { count: 'exact', head: true })
      .eq('school_id', sid).is('deleted_at', null).eq('is_template', false).eq('due_date', bugun),
    supabase.from('school_events').select('id, title').eq('school_id', sid).is('deleted_at', null).eq('event_date', bugun),
  ])
  const nobetci = nobetler.filter(n => n.day_of_week === gun).sort((a, b) => a.teacherName.localeCompare(b.teacherName, 'tr'))
  const etkinlikler = etkinlik.data ?? []

  return (
    <Bolum baslik="Bugün">
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Sayi deger={teslim.count ?? 0} etiket="ödevin teslimi bugün" />
          <Sayi deger={odev.kontrolEdilecek.length} etiket="ödev kontrol bekliyor" href="/yonetim/odevler" />
          <Sayi deger={odev.gecikenler.length} etiket={`kontrolü ${GECIKME_GUNU} günden fazla gecikti`} kotu={odev.gecikenler.length > 0} href="/yonetim/odevler" />
        </div>
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-1.5 ${soluk}`}>Nöbetçiler</p>
          {gun > 5 ? <p className={`text-sm ${soluk}`}>Hafta sonu, nöbet yok.</p>
            : nobetci.length === 0 ? <p className={`text-sm ${soluk}`}>Bugün için nöbet bilgisi yok.</p>
            : (
              <ul className="flex flex-wrap gap-2">
                {nobetci.map((n, i) => (
                  <li key={`${n.teacher_id}-${i}`} className="text-sm rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 px-2.5 py-1">
                    <span className="font-medium text-gray-900 dark:text-slate-100">{n.teacherName}</span>
                    <span className={soluk}> · {n.location} · {n.time_range}</span>
                  </li>
                ))}
              </ul>
            )}
          <Link href="/nobet" className={`${bag} inline-block mt-1.5`}>Tüm çizelge →</Link>
        </div>
        {etkinlikler.length > 0 && (
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide mb-1.5 ${soluk}`}>Takvim</p>
            <ul className="text-sm text-gray-800 dark:text-slate-200 space-y-0.5">
              {etkinlikler.map(e => <li key={e.id}>• {e.title}</li>)}
            </ul>
          </div>
        )}
      </div>
    </Bolum>
  )
}

// ── 2. Ödev durumu ───────────────────────────────────────────────────────────

export async function OdevBolumu() {
  const odev = await odevVerisi(await requireSchoolId())
  const enRiskliDers = [...odev.dersler].sort((a, b) => b.riskli - a.riskli)[0]

  return (
    <Bolum baslik="Ödev durumu" sag={<Link href="/yonetim/odevler" className={bag}>Ödev Takibi →</Link>}>
      <div className="grid gap-4 p-4 lg:grid-cols-2">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-1.5 ${soluk}`}>Kontrol bekleyen (en eski)</p>
          {odev.kontrolEdilecek.length === 0 ? <p className="text-sm text-emerald-700 dark:text-emerald-400">Kontrol bekleyen ödev yok ✓</p> : (
            <ul className="divide-y divide-gray-100 dark:divide-slate-700/60">
              {odev.kontrolEdilecek.slice(0, 5).map(k => (
                <li key={k.id} className="py-1.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900 dark:text-slate-100 truncate">{k.subject} · {k.title}</p>
                    <p className={`text-xs ${soluk} truncate`}>{k.sinif} · {k.ogretmen}</p>
                  </div>
                  <span className={`text-xs font-semibold shrink-0 ${k.gun > GECIKME_GUNU ? 'text-red-600 dark:text-red-400' : soluk}`}>{k.gun} gün</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-sm mt-3 text-gray-800 dark:text-slate-200">
            Riskli öğrenci: <strong>{odev.riskliOgrenciler.length}</strong>
            {enRiskliDers && enRiskliDers.riskli > 0 && <span className={soluk}> · en çok {enRiskliDers.ad} ({enRiskliDers.riskli})</span>}
          </p>
        </div>
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-1.5 ${soluk}`}>Sınıflara göre tamamlanma</p>
          {odev.siniflar.length === 0 ? <p className={`text-sm ${soluk}`}>Henüz ödev yok.</p> : (
            <ul className="space-y-1.5">
              {odev.siniflar.map(s => (
                <li key={s.id} className="flex items-center gap-2 text-sm">
                  <span className="w-14 shrink-0 text-gray-800 dark:text-slate-200">{s.ad}</span>
                  <span className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
                    <span className={`block h-full ${(s.tamamlanma ?? 0) < 50 ? 'bg-red-500' : (s.tamamlanma ?? 0) < 75 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${s.tamamlanma ?? 0}%` }} />
                  </span>
                  <span className={`w-12 text-right text-xs ${soluk}`}>{s.tamamlanma == null ? '—' : `%${s.tamamlanma}`}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Bolum>
  )
}

// ── 3. Öğretmen takibi ───────────────────────────────────────────────────────

export async function OgretmenBolumu() {
  const sid = await requireSchoolId()
  const [odev, ogretmenler, kullanim] = await Promise.all([odevVerisi(sid), getSchoolTeachers(sid), getOkulKullanim()])
  const satirlar = ogretmenTakibi({ ogretmenler, odevSatirlari: odev.ogretmenler, kullanim, bugun: todayLocalISO() })

  return (
    <Bolum baslik="Öğretmen takibi" sag={<Link href="/kullanicilar" className={bag}>Kullanıcılar →</Link>}>
      {satirlar.length === 0 ? <p className={`px-4 py-6 text-center text-sm ${soluk}`}>Henüz öğretmen yok.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`text-xs text-left ${soluk}`}>
                <th className="px-4 py-2 font-medium">Öğretmen</th>
                <th className="px-2 py-2 font-medium text-right">Ödev</th>
                <th className="px-2 py-2 font-medium text-right">Kontrol</th>
                <th className="px-2 py-2 font-medium text-right">Bekleyen</th>
                <th className="px-4 py-2 font-medium text-right">Son giriş</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
              {satirlar.map(t => (
                <tr key={t.id}>
                  <td className="px-4 py-2">
                    <p className="font-medium text-gray-900 dark:text-slate-100 whitespace-nowrap">{t.ad}</p>
                    <p className={`text-xs ${soluk}`}>{t.brans ?? '—'}</p>
                  </td>
                  <td className={`px-2 py-2 text-right ${t.odev === 0 ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-gray-800 dark:text-slate-200'}`}>{t.odev}</td>
                  <td className="px-2 py-2 text-right text-gray-800 dark:text-slate-200">{t.kontrolOrani == null ? '—' : `%${t.kontrolOrani}`}</td>
                  <td className={`px-2 py-2 text-right whitespace-nowrap ${t.enEskiBekleyen != null && t.enEskiBekleyen > GECIKME_GUNU ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-800 dark:text-slate-200'}`}>
                    {t.enEskiBekleyen == null ? '—' : `${t.enEskiBekleyen} gün`}
                  </td>
                  <td className={`px-4 py-2 text-right whitespace-nowrap ${t.aktif ? soluk : 'text-red-600 dark:text-red-400 font-semibold'}`}>
                    {t.sonGun ? format(parseISO(t.sonGun), 'd MMM') : 'hiç'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Bolum>
  )
}

// ── 4. Mentörlük ve veli ─────────────────────────────────────────────────────

export async function MentorlukBolumu() {
  const [supabase, sid] = await Promise.all([createClient(), requireSchoolId()])
  const hafta = haftaSec(todayLocalISO())
  const [mentorluk, gonderim, ogrenci, sinif] = await Promise.all([
    supabase.rpc('ogrenci_mentor_adlari'),
    supabase.from('bulten_gonderimleri').select('student_id').eq('school_id', sid).eq('hafta', hafta),
    supabase.from('students').select('id, class_id, veli_telefon').eq('school_id', sid).is('deleted_at', null),
    supabase.from('classes').select('id, name').eq('school_id', sid).is('deleted_at', null),
  ])
  for (const r of [mentorluk, gonderim, ogrenci, sinif]) if (r.error) throw new Error(r.error.message)

  const mentorluklar = mentorluk.data ?? []
  const ogrenciler = ogrenci.data ?? []
  const ilerleme = bultenIlerlemesi({
    mentorluklar,
    gonderilenler: (gonderim.data ?? []).map(g => g.student_id),
    mentorAdlari: new Map(mentorluklar.map(m => [m.mentor_id, m.mentor_adi])),
  })
  const mentorlu = new Set(mentorluklar.map(m => m.student_id))
  const mentorsuz = mentorsuzSiniflar({ ogrenciler, mentorlu, siniflar: new Map((sinif.data ?? []).map(c => [c.id, c.name])) })
  const mentorsuzToplam = mentorsuz.reduce((t, s) => t + s.mentorsuz, 0)
  const telefonsuz = ogrenciler.filter(o => !o.veli_telefon?.trim()).length

  return (
    <Bolum baslik="Mentörlük ve veli">
      <div className="grid gap-4 p-4 lg:grid-cols-2">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-1.5 ${soluk}`}>Veli bülteni · {haftaEtiketi(hafta)}</p>
          {ilerleme.length === 0 ? <p className={`text-sm ${soluk}`}>Henüz mentör ataması yok.</p> : (
            <ul className="space-y-1.5">
              {ilerleme.map(m => {
                const tamam = m.gonderilen === m.toplam
                return (
                  <li key={m.mentorId} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 min-w-0 truncate text-gray-900 dark:text-slate-100">{m.ad}</span>
                    <span className="w-24 h-2 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden shrink-0">
                      <span className={`block h-full ${tamam ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${(m.gonderilen / m.toplam) * 100}%` }} />
                    </span>
                    <span className={`w-12 text-right text-xs font-semibold ${tamam ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-800 dark:text-slate-200'}`}>{m.gonderilen}/{m.toplam}</span>
                  </li>
                )
              })}
            </ul>
          )}
          <p className={`text-xs mt-2 ${soluk}`}>Mentörün bülten sayfasında gönder/paylaş düğmesine bastığı öğrenciler sayılır.</p>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-sm text-gray-800 dark:text-slate-200">
              Mentörü olmayan öğrenci: <strong className={mentorsuzToplam ? 'text-amber-700 dark:text-amber-400' : ''}>{mentorsuzToplam}</strong>/{ogrenciler.length}
            </p>
            {mentorsuz.length > 0 && (
              <ul className="flex flex-wrap gap-1.5 mt-1.5">
                {mentorsuz.map(s => (
                  <li key={s.id}>
                    <Link href={`/siniflar/${s.id}`} className="inline-block text-xs rounded-full border border-gray-200 dark:border-slate-600 px-2 py-0.5 text-gray-700 dark:text-slate-300 hover:border-indigo-300">
                      {s.ad}: {s.mentorsuz}/{s.toplam}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="text-sm text-gray-800 dark:text-slate-200">
            Veli telefonu eksik: <strong className={telefonsuz ? 'text-amber-700 dark:text-amber-400' : ''}>{telefonsuz}</strong>/{ogrenciler.length}
            {' '}<Link href="/yonetim/ogrenciler" className={bag}>Öğrenciler →</Link>
          </p>
        </div>
      </div>
    </Bolum>
  )
}
