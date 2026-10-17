'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { konuEkle, konuDurumu } from '@/app/actions/mentor-takip'
import { SEVIYE_ADI, programYuzde, dogrulukYuzde, okumaGecmisi, takipHaftaEtiketi } from '@/src/domains/mentor/takip/takipMath'
import { dersKisa } from '@/src/domains/mentor/lib/bultenMath'
import type { SekmeProps } from './TakipIstemci'

const DURUM_AD = ['Başlanmadı', 'Çalışılıyor', 'Oturdu'] as const
const DURUM_RENK = ['border-gray-300 dark:border-slate-600', 'border-amber-500 bg-amber-50 dark:bg-amber-950', 'border-green-600 bg-green-50 dark:bg-green-950']

export default function DosyaSekmesi({ v }: SekmeProps) {
  const router = useRouter()
  const [durum, setDurum] = useState(v.konuDurumu)
  const [ders, setDers] = useState('Matematik'); const [yeni, setYeni] = useState('')
  const [hata, setHata] = useState<string | null>(null)
  const [, basla] = useTransition()
  const dersler = [...new Set(['Matematik', ...v.konular.map(k => k.ders)])]
  const tikla = (id: string) => {
    const eski = durum[id] ?? 0, sonraki = ((eski + 1) % 3) as 0 | 1 | 2
    setDurum(d => ({ ...d, [id]: sonraki }))
    basla(async () => { const r = await konuDurumu(v.ogrenci.id, id, sonraki); if (r.error) { setDurum(d => ({ ...d, [id]: eski })); setHata(r.error) } })
  }
  return (
    <div className="space-y-8">
      <section aria-label="Konu haritası">
        <h2 className="text-base font-semibold mb-2">Konu haritası <span className="text-xs font-normal text-gray-500 dark:text-slate-400">(tıkla: başlanmadı → çalışılıyor → oturdu)</span></h2>
        {dersler.map(d => {
          const ks = v.konular.filter(k => k.ders === d)
          if (!ks.length) return null
          return (
            <div key={d} className="mb-3">
              <h3 className="text-sm font-semibold mb-1">{d}</h3>
              <div className="flex flex-wrap gap-2">
                {ks.map(k => (
                  <button key={k.id} type="button" onClick={() => tikla(k.id)} aria-label={`${k.ad}: ${DURUM_AD[durum[k.id] ?? 0]}`}
                    className={`px-2 py-1 rounded border text-sm ${DURUM_RENK[durum[k.id] ?? 0]}`}>
                    {k.ad} <span className="text-xs">· {DURUM_AD[durum[k.id] ?? 0]}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
        <form className="flex flex-wrap gap-2 items-end mt-2" onSubmit={e => {
          e.preventDefault()
          basla(async () => { const r = await konuEkle(v.ogrenci.id, ders, yeni); if (r.error) setHata(r.error); else { setYeni(''); setHata(null); router.refresh() } })
        }}>
          <label className="text-sm">Ders<input list="dersler" className="block rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-base md:text-sm w-36" value={ders} onChange={e => setDers(e.target.value)} required /></label>
          <datalist id="dersler">{['Matematik', 'Fizik', 'Kimya', 'Biyoloji', 'Türk Dili ve Edebiyatı', 'Tarih', 'Coğrafya', 'İngilizce', 'Felsefe'].map(x => <option key={x} value={x} />)}</datalist>
          <label className="text-sm">Konu<input className="block rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-base md:text-sm w-56" value={yeni} onChange={e => setYeni(e.target.value)} required /></label>
          <button className="px-3 py-1.5 rounded border border-gray-300 dark:border-slate-600 text-sm">Konu ekle</button>
          {hata && <span role="alert" className="text-sm text-red-700 dark:text-red-400">{hata}</span>}
        </form>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Eklenen konu bu sınıf ve dersin okul listesine kalıcı olarak geçer.</p>
      </section>

      <section aria-label="Okuduğu kitaplar">
        <h2 className="text-base font-semibold mb-2">Okuduğu kitaplar</h2>
        {(() => { const ok = okumaGecmisi(v.gecmis.map(h => ({ hafta: h.hafta, okuma: h.okuma })))
          return ok.length === 0 ? <p className="text-sm text-gray-500 dark:text-slate-400">Henüz kayıt yok.</p> : (
            <ul className="text-sm space-y-1">{ok.map(k => <li key={k.kitap + k.bas}>{k.kitap} — {takipHaftaEtiketi(k.bas)}{k.son !== k.bas && ` → ${takipHaftaEtiketi(k.son)}`} · {k.sayfa} sayfa {k.bitti && '· bitti ✓'}</li>)}</ul>) })()}
      </section>

      <section aria-label="Geçmiş haftalar">
        <h2 className="text-base font-semibold mb-2">Geçmiş haftalar</h2>
        <table className="w-full text-sm border-collapse">
          <thead><tr className="text-left text-xs text-gray-500 dark:text-slate-400 border-b border-gray-300 dark:border-slate-600">
            <th className="py-1">Hafta</th><th>Seviye</th><th>Program</th><th>Soru</th><th>Doğruluk</th><th>Ders bazında</th><th>Okuma</th><th /></tr></thead>
          <tbody>{v.gecmis.slice().reverse().map(h => {
            const p = programYuzde(h.ozet), d = dogrulukYuzde(h.ozet)
            return (
              <tr key={h.hafta} className="border-b border-gray-100 dark:border-slate-700">
                <td className="py-1">{takipHaftaEtiketi(h.hafta)}{h.kapali && <span title="Hafta kapatıldı" aria-label="kapalı"> 🔒</span>}</td><td>{SEVIYE_ADI[h.seviye]}</td>
                <td>{h.ozet.islendi && p !== null ? `%${p}` : '—'}</td><td>{h.ozet.soru || '—'}</td>
                <td>{d === null ? '—' : `%${d}`}</td>
                <td className="text-xs">{h.dersler.length === 0 ? '—' : h.dersler.map((x, i) => (
                  <span key={x.ders} className={x.yuzde < 50 ? 'text-red-700 dark:text-red-400 font-semibold' : ''}>{i > 0 && ' · '}{dersKisa(x.ders)} %{x.yuzde}</span>))}</td>
                <td>{h.ozet.okuma_sayfa || '—'}</td>
                <td className="whitespace-nowrap"><Link className="text-blue-600 hover:underline" href={`/mentorluk/${v.ogrenci.id}/takip?hafta=${h.hafta}&sekme=sonuc`}>Aç</Link>
                  {' · '}<a className="text-blue-600 hover:underline" target="_blank" rel="noopener" href={`/mentorluk/${v.ogrenci.id}/takip/sonuc-kagidi?hafta=${h.hafta}`}>Yazdır</a></td>
              </tr>)
          })}</tbody>
        </table>
      </section>
    </div>
  )
}
