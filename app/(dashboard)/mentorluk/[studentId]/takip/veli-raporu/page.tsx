import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { isTeachingRole } from '@/src/shared/types'
import { todayLocalISO } from '@/src/shared/date'
import { haftaBasi } from '@/src/domains/mentor/takip/takipMath'
import { pazartesiMi, haftaEtiketi } from '@/src/domains/mentor/lib/bultenMath'
import { ozetHesapla, programYuzde, dogrulukYuzde } from '@/src/domains/mentor/takip/takipMath'
import { takipVeliMesaji, konuAdlari } from '@/src/domains/mentor/takip/veliMesaji'
import { TakipService } from '@/src/domains/mentor/services/TakipService'
import PrintButton from '@/components/PrintButton'

export const metadata = { title: 'Haftalık Mentörlük Raporu' }

/** Veliye kâğıt olarak verilecek A4: 4 özet kutusu + otomatik mesaj. */
export default async function VeliRaporuPage({ params, searchParams }: { params: Promise<{ studentId: string }>; searchParams: Promise<{ hafta?: string }> }) {
  const profile = await getCurrentProfile()
  if (!profile?.school_id || !isTeachingRole(profile.role)) redirect('/anasayfa')
  const { studentId } = await params
  const h = (await searchParams).hafta
  const v = await TakipService.sayfaVerisi(studentId, h && pazartesiMi(h) ? h : haftaBasi(todayLocalISO()))
  if (!v) notFound()
  const o = ozetHesapla(v.taslak.icerik), p = programYuzde(o), d = dogrulukYuzde(o)
  const mo = v.taslak.icerik.mentorOdevleri
  const metin = takipVeliMesaji({ ogrenciAdi: v.ogrenci.ad, pazartesi: v.hafta, veri: v.taslak, onceki: v.onceki?.ozet ?? null, konular: konuAdlari(v.konular, v.konuDurumu), mentorAdi: v.mentorAdi })
  const kutular: [string, string][] = [
    ['Program', p === null ? '—' : `%${p}`], ['Soru / doğruluk', `${o.soru} · ${d === null ? '—' : `%${d}`}`],
    ['Mentör ödevi', `${mo.filter(m => m.yapti).length}/${mo.length}`], ['Okuma', `${o.okuma_sayfa} sayfa`],
  ]
  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto print:p-0 print:max-w-none">
      <div className="flex justify-between items-center mb-4 print:hidden">
        <Link href={`/mentorluk/${studentId}/takip?hafta=${v.hafta}&sekme=veli`} className="text-sm text-gray-600 dark:text-slate-400 hover:text-blue-600">← Veli mesajına dön</Link>
        <PrintButton />
      </div>
      <article className="text-sm text-black bg-white">
        <p className="text-xs">{v.okulAdi}</p>
        <h1 className="text-lg font-bold">Haftalık Mentörlük Raporu</h1>
        <p className="mb-3">{v.ogrenci.ad} · {v.ogrenci.sinifAdi} · {haftaEtiketi(v.hafta)}</p>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {kutular.map(([b, x]) => (
            <div key={b} className="border border-gray-400 p-2"><p className="text-xs">{b}</p><p className="text-base font-bold">{x}</p></div>
          ))}
        </div>
        <pre className="whitespace-pre-wrap font-sans">{metin}</pre>
      </article>
    </div>
  )
}
