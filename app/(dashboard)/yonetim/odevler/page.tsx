import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { isMudurOrAbove } from '@/src/shared/types'
import { dersAnahtari } from '@/src/domains/homework/lib/stats'
import { GECIKME_GUNU, RISK_ACIKLAMA, riskDersMetni, type RiskliOgrenci } from '@/src/domains/homework/lib/odev-takibi'
import { odevTakibiVerisi } from '@/src/domains/homework/queries/odevTakibiVerisi'

export const metadata = { title: 'Ödev Takibi' }

const KONTROL_EDILEN_ILK = 10
const RISKLI_ILK = 10

const kutu = 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 md:p-5 mb-4'
const baslik = 'text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3'
const soluk = 'text-xs text-gray-500 dark:text-slate-400'
const tabloBaslik = 'text-left text-xs text-gray-500 dark:text-slate-400 border-b border-gray-200 dark:border-slate-700'

export default async function OdevTakibiPage({ searchParams }: { searchParams: Promise<{ ders?: string | string[] }> }) {
  const profile = await getCurrentProfile()
  if (!profile?.school_id || !isMudurOrAbove(profile.role)) redirect('/anasayfa')

  const dersParam = (await searchParams).ders
  const ders = typeof dersParam === 'string' && dersParam.trim() ? dersParam : null

  const r = await odevTakibiVerisi(await createClient(), profile.school_id, ders)
  const seciliDers = ders ? r.dersler.find(d => d.anahtar === dersAnahtari(ders)) ?? null : null
  const gecikmisIds = new Set(r.gecikenler.map(g => g.id))

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Ödev Takibi</h1>
        <Link href="/anasayfa" className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">← Ana sayfa</Link>
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

          {/* idarenin harekete geçeceği yer en üstte */}
          <section className={kutu} aria-labelledby="edilecek-baslik">
            <h2 id="edilecek-baslik" className={baslik}>Kontrol edilecek ({r.kontrolEdilecek.length})</h2>
            {r.kontrolEdilecek.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-slate-400">Teslimi geçmiş, kontrol bekleyen ödev yok.</p>
            ) : (
              <>
                {r.gecikenler.length > 0 && (
                  <p className="text-sm text-red-700 dark:text-red-400 mb-1" data-testid="geciken-ozet">
                    {r.gecikenler.length} ödev {GECIKME_GUNU} günden uzun süredir kontrol bekliyor (kırmızı olanlar).
                  </p>
                )}
                <ul className="divide-y divide-gray-100 dark:divide-slate-700" data-testid="kontrol-edilecek">
                  {r.kontrolEdilecek.map(k => (
                    <OdevSatiri key={k.id} k={k} sag={
                      <span className={gecikmisIds.has(k.id) ? 'text-red-700 dark:text-red-400 font-semibold' : 'text-gray-600 dark:text-slate-400'}>
                        {k.gun} gündür bekliyor
                      </span>
                    } />
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className={kutu} aria-labelledby="ders-baslik">
            <h2 id="ders-baslik" className={baslik}>Derslere göre</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="ders-satirlari">
                <thead>
                  <tr className={tabloBaslik}>
                    <th scope="col" className="py-2 pr-3 font-medium">Ders</th>
                    <th scope="col" className="py-2 pr-3 font-medium text-right">Ödev</th>
                    <th scope="col" className="py-2 pr-3 font-medium text-right">Tamamlanma</th>
                    <th scope="col" className="py-2 pr-3 font-medium text-right">Riskli</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Kontrol</th>
                    <th scope="col" className="py-2 font-medium hidden md:table-cell">Veren</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                  {(seciliDers ? [seciliDers] : r.dersler).map(d => (
                    <tr key={d.anahtar} className="align-top">
                      <td className="py-2.5 pr-3">
                        <span className="font-medium text-gray-900 dark:text-slate-100">{d.ad}</span>
                        {/* telefonda Veren sütunu yok — ders adının altında */}
                        <span className={'block md:hidden ' + soluk}>{d.girenler.map(g => `${g.ad} ${g.sayi}`).join(', ')}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-gray-800 dark:text-slate-200">{d.odev}</td>
                      <td className="py-2.5 pr-3 text-right"><Yuzde v={d.tamamlanma} /></td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {d.riskli > 0
                          ? <span className="text-red-700 dark:text-red-400 font-semibold" title="Bu derste riskli öğrenci">{d.riskli} öğr.</span>
                          : <span className={soluk}>—</span>}
                      </td>
                      <td className="py-2.5 pr-3 min-w-28 md:min-w-44">
                        <Cubuk deger={d.kontrolEdildi} toplam={d.kontrolEdildi + d.kontrolEdilecek} />
                        <span className={soluk}>
                          {d.kontrolEdildi} kontrol edildi
                          {d.kontrolEdilecek > 0 && <> · <span className="text-red-700 dark:text-red-400 font-medium">{d.kontrolEdilecek} kontrol edilecek</span></>}
                          {d.bekliyor > 0 && <> · {d.bekliyor} teslimi gelmedi</>}
                        </span>
                      </td>
                      <td className={'py-2.5 min-w-40 hidden md:table-cell ' + soluk}>{d.girenler.map(g => `${g.ad} ${g.sayi}`).join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={kutu} aria-labelledby="sinif-baslik">
            <h2 id="sinif-baslik" className={baslik}>Sınıflara göre tamamlanma</h2>
            <ul className="space-y-2.5" data-testid="sinif-satirlari">
              {r.siniflar.map(c => (
                <li key={c.id} className="grid grid-cols-[auto_1fr_3rem] items-center gap-3 text-sm">
                  <span className="font-medium text-gray-900 dark:text-slate-100 min-w-12">{c.ad}</span>
                  <span>
                    <Cubuk deger={c.tamamlanma ?? 0} toplam={100} renk={oranRengi(c.tamamlanma)} />
                    <span className={soluk}>{c.odev} ödev</span>
                  </span>
                  <span className="text-right"><Yuzde v={c.tamamlanma} /></span>
                </li>
              ))}
            </ul>
          </section>

          <section className={kutu} aria-labelledby="risk-baslik">
            <h2 id="risk-baslik" className={baslik + ' !mb-1'}>Riskli öğrenciler ({r.riskliOgrenciler.length})</h2>
            <p className={soluk + ' mb-2'}>
              {RISK_ACIKLAMA}
            </p>
            {r.riskliOgrenciler.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-slate-400">Riskli öğrenci yok.</p>
            ) : (
              <>
                <RiskliListe ogrenciler={r.riskliOgrenciler.slice(0, RISKLI_ILK)} testId="riskli-ogrenciler" />
                {r.riskliOgrenciler.length > RISKLI_ILK && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-sm text-blue-700 dark:text-blue-400 py-2">
                      Tümü sınıflara göre ({r.riskliOgrenciler.length})
                    </summary>
                    {sinifGruplari(r.riskliOgrenciler).map(([sinifAd, liste]) => (
                      <details key={sinifAd} className="border-l-2 border-gray-200 dark:border-slate-700 pl-3 mb-1">
                        <summary className="cursor-pointer text-sm py-1.5 text-gray-800 dark:text-slate-200">
                          <span className="font-medium">{sinifAd}</span> <span className={soluk}>{liste.length} öğrenci</span>
                        </summary>
                        <RiskliListe ogrenciler={liste} />
                      </details>
                    ))}
                  </details>
                )}
              </>
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

function oranRengi(v: number | null) {
  return v === null ? 'bg-gray-300 dark:bg-slate-600' : v >= 80 ? 'bg-green-500' : v >= 60 ? 'bg-amber-500' : 'bg-red-500'
}

function Yuzde({ v }: { v: number | null }) {
  if (v === null) return <span className={soluk}>—</span>
  const renk = v >= 80 ? 'text-green-700 dark:text-green-400' : v >= 60 ? 'text-amber-700 dark:text-amber-400' : 'text-red-700 dark:text-red-400'
  return <span className={'font-semibold tabular-nums ' + renk}>%{v}</span>
}

/** Görsel oran çubuğu — sayısı yanında yazılı, ekran okuyucudan gizli */
function Cubuk({ deger, toplam, renk = 'bg-blue-500' }: { deger: number; toplam: number; renk?: string }) {
  const w = toplam > 0 ? Math.round((deger / toplam) * 100) : 0
  return (
    <span aria-hidden className="block h-1.5 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden mb-1">
      <span className={'block h-full rounded-full ' + renk} style={{ width: `${w}%` }} />
    </span>
  )
}

function sinifGruplari(ogrenciler: RiskliOgrenci[]): [string, RiskliOgrenci[]][] {
  const m = new Map<string, RiskliOgrenci[]>()
  for (const o of ogrenciler) m.set(o.sinif, [...(m.get(o.sinif) ?? []), o])
  return [...m].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'tr'))
}

function RiskliListe({ ogrenciler, testId }: { ogrenciler: RiskliOgrenci[]; testId?: string }) {
  return (
    <ul className="divide-y divide-gray-100 dark:divide-slate-700" data-testid={testId}>
      {ogrenciler.map(o => (
        <li key={o.id} className="py-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
          <Link href={`/siniflar/${o.sinifId}/ogrenciler/${o.id}`} className="font-medium text-gray-900 dark:text-slate-100 hover:underline">
            {o.ad} <span className={soluk}>{o.sinif}</span>
          </Link>
          <span className="text-sm text-red-700 dark:text-red-400 tabular-nums">{o.dersler.map(riskDersMetni).join(' · ')}</span>
        </li>
      ))}
    </ul>
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

function DurumCubugu({ y, e, n }: { y: number; e: number; n: number }) {
  const t = y + e + n
  if (t === 0) return null
  const w = (x: number) => ({ width: `${(x / t) * 100}%` })
  return (
    <span aria-hidden className="flex h-1.5 rounded-full overflow-hidden bg-gray-100 dark:bg-slate-700 mb-1">
      <span className="bg-green-500" style={w(y)} />
      <span className="bg-amber-400" style={w(e)} />
      <span className="bg-red-500" style={w(n)} />
    </span>
  )
}

function KontrolEdilenListe({ satirlar }: { satirlar: { id: string; title: string; subject: string; sinif: string; ogretmen: string; yapildi: number; eksik: number; yapilmadi: number }[] }) {
  const satir = (k: (typeof satirlar)[number]) => (
    <OdevSatiri key={k.id} k={k} sag={
      <span className="inline-block min-w-48 text-gray-700 dark:text-slate-300">
        <DurumCubugu y={k.yapildi} e={k.eksik} n={k.yapilmadi} />
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
