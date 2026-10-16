import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { isMudurOrAbove } from '@/src/shared/types'
import { createClient } from '@/src/infrastructure/supabase/server'
import { todayLocalISO } from '@/src/shared/date'
import { haftaSec, haftaEtiketi } from '@/src/domains/mentor/lib/bultenMath'
import { mentorListesi } from '@/src/domains/dashboard/lib/yoneticiOzeti'
import { programYuzde, dogrulukYuzde } from '@/src/domains/mentor/takip/takipMath'

export const metadata = { title: 'Mentörlük' }

const soluk = 'text-gray-500 dark:text-slate-400'

/** İdare: kim kimin mentörü. Görüşmeler okulda Metodbox'a girildiği için burada görüşme bilgisi yok (2026-10-11). */
export default async function YonetimMentorlukPage() {
  const profile = await getCurrentProfile()
  if (!profile?.school_id || !isMudurOrAbove(profile.role)) redirect('/anasayfa')
  const sid = profile.school_id

  const supabase = await createClient()
  const hafta = haftaSec(todayLocalISO())
  const [mentorluk, gonderim, ogrenci, sinif, takipOzet] = await Promise.all([
    supabase.rpc('ogrenci_mentor_adlari'),
    supabase.from('bulten_gonderimleri').select('student_id').eq('school_id', sid).eq('hafta', hafta),
    supabase.from('students').select('id, full_name, class_id').eq('school_id', sid).is('deleted_at', null).limit(1000),
    supabase.from('classes').select('id, name').eq('school_id', sid).is('deleted_at', null),
    // Haftalık takip: yalnız rakamlar (RPC görüşme notu/içerik döndürmez)
    supabase.rpc('mentor_takip_ozet'),
  ])
  for (const r of [mentorluk, gonderim, ogrenci, sinif, takipOzet]) if (r.error) throw new Error(r.error.message)
  const takip = new Map((takipOzet.data ?? []).map(t => [t.student_id, t]))

  const ogrenciler = ogrenci.data ?? []
  const siniflar = new Map((sinif.data ?? []).map(c => [c.id, c.name]))
  const kartlar = mentorListesi({
    mentorluklar: mentorluk.data ?? [],
    ogrenciler,
    siniflar,
    gonderilenler: new Set((gonderim.data ?? []).map(g => g.student_id)),
  })
  const mentorlu = new Set(kartlar.flatMap(k => k.ogrenciler.map(o => o.id)))
  const mentorsuz = new Map<string, string[]>()
  for (const o of ogrenciler) {
    if (mentorlu.has(o.id)) continue
    mentorsuz.set(o.class_id, [...(mentorsuz.get(o.class_id) ?? []), o.full_name])
  }
  const mentorsuzSiniflar = [...mentorsuz]
    .map(([id, adlar]) => ({ id, ad: siniflar.get(id) ?? '—', adlar: adlar.sort((a, b) => a.localeCompare(b, 'tr')) }))
    .sort((a, b) => a.ad.localeCompare(b.ad, 'tr', { numeric: true }))

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Mentörlük</h1>
        <p className={`text-sm mt-0.5 ${soluk}`}>
          {kartlar.length} mentör · {ogrenciler.length} öğrenciden {mentorlu.size}&apos;inin mentörü var.
        </p>
      </div>

      {kartlar.length === 0 ? (
        <p className={`text-sm ${soluk}`}>Henüz mentör ataması yok. Sınıf sayfasındaki &quot;Mentör Dağılımı&quot; kutusundan atayabilirsiniz.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {kartlar.map(k => (
            <section key={k.mentorId} aria-label={k.ad} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl">
              <header className="flex items-baseline justify-between gap-2 px-4 py-3 border-b border-gray-100 dark:border-slate-700">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">{k.ad}</h2>
                <span className={`text-xs ${soluk}`}>
                  {k.ogrenciler.length} öğrenci · bülten {k.bultenGonderilen}/{k.ogrenciler.length}
                </span>
              </header>
              <ul className="divide-y divide-gray-100 dark:divide-slate-700">
                {k.ogrenciler.map(o => (
                  <li key={o.id} className="flex items-center gap-2 px-4 py-2 text-sm">
                    <Link href={`/siniflar/${o.sinifId}/ogrenciler/${o.id}`} className="flex-1 min-w-0 truncate text-gray-900 dark:text-slate-100 hover:underline">
                      {o.ad}
                    </Link>
                    <span className={`w-12 shrink-0 text-xs ${soluk}`}>{o.sinif}</span>
                    {(() => {
                      const t = takip.get(o.id)
                      if (!t) return null
                      const d = dogrulukYuzde(t)
                      return <span className={`shrink-0 text-xs ${soluk}`} title={`Son işlenen hafta: ${haftaEtiketi(t.hafta_basi)}`}>Program %{programYuzde(t) ?? 0}{d !== null && ` · Doğruluk %${d}`}</span>
                    })()}
                    <span className={`w-20 shrink-0 text-right text-xs ${o.bulten ? 'text-emerald-700 dark:text-emerald-400' : soluk}`}>
                      {o.bulten ? 'Bülten ✓' : 'Bülten —'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <p className={`text-xs ${soluk}`}>Bülten: {haftaEtiketi(hafta)} haftası için mentörün gönder/paylaş düğmesine bastığı öğrenciler.</p>

      {mentorsuzSiniflar.length > 0 && (
        <section aria-label="Mentörü olmayanlar" className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2">
            Mentörü olmayanlar <span className={`font-normal ${soluk}`}>({ogrenciler.length - mentorlu.size})</span>
          </h2>
          <ul className="space-y-2">
            {mentorsuzSiniflar.map(s => (
              <li key={s.id} className="text-sm">
                <span className="font-medium text-gray-800 dark:text-slate-200">{s.ad}</span>
                <span className={soluk}> ({s.adlar.length}) — </span>
                <Link href={`/siniflar/${s.id}`} className="text-blue-700 dark:text-blue-400 hover:underline">Ata →</Link>
                <p className={`text-xs mt-0.5 ${soluk}`}>{s.adlar.join(', ')}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
