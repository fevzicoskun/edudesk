'use client'
import {
  GUNLER, miktarYaz, ozetHesapla, okulDurumYaz, programYuzde, dogrulukYuzde, fark, kitapSayfaYaz,
  sonucSatirlari, sonucNet, sonucDogruluk, sonucUyarisi, dersDogruluk, type Gorev, type Gorusme, type Sonuc,
} from '@/src/domains/mentor/takip/takipMath'
import { dersKisa } from '@/src/domains/mentor/lib/bultenMath'
import type { SekmeProps } from './TakipIstemci'

const kutu = 'rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-base md:text-sm'
const netYaz = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
const sayi = (s: string) => (s === '' ? null : Math.max(0, Math.trunc(Number(s)) || 0))
const GORUSME: [keyof Gorusme, string][] = [['iyi', 'İyi giden'], ['zor', 'Zorlandığı'], ['hedef', 'Gelecek hafta kendi hedefi'], ['odak', 'Gelecek haftanın odağı'], ['evde', 'Evde veliden ricam']]

function Kart({ baslik, deger, alt }: { baslik: string; deger: string; alt?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-slate-700 p-3">
      <p className="text-xs text-gray-500 dark:text-slate-400">{baslik}</p>
      <p className="text-lg font-bold tabular-nums">{deger}</p>
      {alt && <p className="text-xs text-gray-500 dark:text-slate-400">{alt}</p>}
    </div>
  )
}

export default function SonucSekmesi({ v, veri, degistir }: SekmeProps) {
  const o = ozetHesapla(veri.icerik)
  const p = programYuzde(o), d = dogrulukYuzde(o), f = fark(o, v.onceki?.ozet ?? null)
  const mo = veri.icerik.mentorOdevleri
  const gorev = (id: string, x: Partial<Gorev>, hemen = false) =>
    degistir(h => ({ ...h, icerik: { ...h.icerik, gorevler: h.icerik.gorevler.map(g => g.id === id ? { ...g, ...x } : g) } }), hemen)
  const satirlar = sonucSatirlari(veri.icerik, v.kitaplar)
  const dersler = dersDogruluk(satirlar)
  const net = satirlar.reduce((t, s) => t + (sonucNet(s) ?? 0), 0)
  // Satırın tamamı saklanır (ad/ders/sayfa girildiği anki hâliyle); hiç sayı girilmemiş satır saklanmaz
  const sonucYaz = (anahtar: string, x: Partial<Sonuc>) => degistir(h => ({
    ...h, icerik: { ...h.icerik, sonuclar: sonucSatirlari(h.icerik, v.kitaplar)
      .map(s => s.anahtar === anahtar ? { ...s, ...x } : s)
      .filter(s => [s.cozulen, s.dogru, s.yanlis, s.bos].some(n => n !== null)) },
  }))

  return (
    <div className="space-y-6">
      <section aria-label="Özet" className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kart baslik="Program" deger={p === null ? '—' : `%${p}`} alt={`${o.gorev_yapilan}/${o.gorev_toplam}`} />
        <Kart baslik="Soru" deger={`${o.soru}`} alt={`hedef ${veri.soruHedefi}${o.soru ? ` · net ${netYaz(net)}` : ''}`} />
        <Kart baslik="Doğruluk" deger={d === null ? '—' : `%${d}`} alt={f === null ? undefined : `${f >= 0 ? '↑' : '↓'} ${Math.abs(f)} puan`} />
        <Kart baslik="Mentör ödevi" deger={`${mo.filter(m => m.yapti).length}/${mo.length}`} />
        <Kart baslik="Okuma" deger={`${o.okuma_sayfa} sf`} />
      </section>

      {dersler.length > 0 && (
        <p aria-label="Ders bazında doğruluk" className="text-sm -mt-3">
          <span className="text-gray-500 dark:text-slate-400">Ders bazında doğruluk: </span>
          {dersler.map((x, i) => <span key={x.ders} className={x.yuzde < 50 ? 'text-red-700 dark:text-red-400 font-semibold' : ''}>{i > 0 && ' · '}{x.ders} %{x.yuzde}</span>)}
        </p>
      )}

      <section aria-label="Soru sonuçları">
        <h2 className="text-base font-semibold mb-2">Soru sonuçları</h2>
        {satirlar.length === 0 ? <p className="text-sm text-gray-500 dark:text-slate-400">Bu haftanın planında soru görevi yok.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead><tr className="text-left text-xs text-gray-500 dark:text-slate-400 border-b border-gray-300 dark:border-slate-600">
                <th className="py-1 pr-2">Kitap / ders</th><th className="pr-2">Sayfa</th><th>Çözülen</th><th>Doğru</th><th>Yanlış</th><th>Boş</th><th className="pl-2">Net</th><th className="pl-2">Doğruluk</th></tr></thead>
              <tbody>
                {satirlar.map(s => {
                  const uyari = sonucUyarisi(s), d = sonucDogruluk(s), n = sonucNet(s)
                  const alan = (k: 'cozulen' | 'dogru' | 'yanlis' | 'bos', ad: string) => (
                    <input aria-label={ad} type="number" min={0} inputMode="numeric" className={`${kutu} w-16`} value={s[k] ?? ''}
                      disabled={k !== 'cozulen' && s.cozulen === null}
                      onChange={e => {
                        const x = sayi(e.target.value)
                        if (k === 'cozulen') sonucYaz(s.anahtar, { cozulen: x, ...(x === null ? { dogru: null, yanlis: null, bos: null } : s.dogru !== null && s.dogru > x && { dogru: x }) })
                        else sonucYaz(s.anahtar, { [k]: k === 'dogru' && x !== null ? Math.min(x, s.cozulen ?? 0) : x })
                      }} />
                  )
                  return (
                    <tr key={s.anahtar} aria-label={s.ad} className="border-b border-gray-100 dark:border-slate-700 align-top">
                      <td className="py-1 pr-2">{s.ad}{s.ders !== s.ad && <span className="text-gray-500 dark:text-slate-400"> · {s.ders}</span>}
                        {uyari && <p role="alert" className="text-xs text-amber-700 dark:text-amber-400">{uyari}</p>}</td>
                      <td className="pr-2 whitespace-nowrap">{s.sayfa}</td>
                      <td>{alan('cozulen', 'Çözülen')}</td><td>{alan('dogru', 'Doğru')}</td><td>{alan('yanlis', 'Yanlış')}</td><td>{alan('bos', 'Boş')}</td>
                      <td className="pl-2 tabular-nums">{n === null ? '—' : netYaz(n)}</td>
                      <td className={`pl-2 tabular-nums ${d !== null && d < 50 ? 'text-red-700 dark:text-red-400 font-semibold' : ''}`}>{d === null ? '—' : `%${d}`}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-label="Görevler">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base font-semibold">Görevler</h2>
        <button type="button" className="px-3 py-1.5 rounded border border-gray-300 dark:border-slate-600 text-sm"
          onClick={() => degistir(h => ({ ...h, icerik: { ...h.icerik, gorevler: h.icerik.gorevler.map(g => ({ ...g, yapti: true })) } }), true)}>
          Tümü yapıldı
        </button>
      </div>
      <table className="w-full text-sm border-collapse">
        <thead><tr className="text-left text-xs text-gray-500 dark:text-slate-400 border-b border-gray-300 dark:border-slate-600">
          <th className="py-1">Gün</th><th>Görev</th><th>Süre</th><th>Yaptı</th></tr></thead>
        <tbody>
          {veri.icerik.gorevler.slice().sort((a, b) => a.gun - b.gun).map(g => (
            <tr key={g.id} aria-label={`${GUNLER[g.gun]} ${g.ad}`} className={`border-b border-gray-100 dark:border-slate-700 ${g.ders === 'Matematik' ? 'font-semibold' : ''}`}>
              <td className="py-1 pr-2">{GUNLER[g.gun]}</td>
              <td className="pr-2">{g.ad}{(g.konu || kitapSayfaYaz(g)) && <span className="text-gray-500 dark:text-slate-400"> · {[g.konu, kitapSayfaYaz(g)].filter(Boolean).join(' · ')}</span>}</td>
              <td className="pr-2 whitespace-nowrap">{miktarYaz(g, veri.seviye)}</td>
              <td><input type="checkbox" aria-label="Yaptı" className="w-5 h-5" checked={g.yapti} onChange={e => gorev(g.id, { yapti: e.target.checked }, true)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      </section>

      <section aria-label="Okul ödevleri">
        <h2 className="text-base font-semibold mb-2">Okul ödevleri <span className="text-xs font-normal text-gray-500 dark:text-slate-400">(dersin öğretmeninin işareti)</span></h2>
        {v.okulOdevleri.buHafta.length === 0 ? <p className="text-sm text-gray-500 dark:text-slate-400">Bu hafta okul ödevi yok.</p>
          : <ul className="text-sm space-y-1">{v.okulOdevleri.buHafta.map(x => (
              <li key={x.id}>{dersKisa(x.subject)} — {x.title}: <b className={x.status === 'yapilmadi' ? 'text-red-700 dark:text-red-400' : ''}>{okulDurumYaz(x)}</b></li>))}</ul>}
      </section>

      {mo.length > 0 && (
        <section aria-label="Mentör ödevleri">
          <h2 className="text-base font-semibold mb-2">Mentör ödevleri</h2>
          {mo.map(m => (
            <label key={m.id} className="flex items-center gap-2 text-sm py-1">
              <input type="checkbox" className="w-5 h-5" checked={m.yapti}
                onChange={e => degistir(h => ({ ...h, icerik: { ...h.icerik, mentorOdevleri: h.icerik.mentorOdevleri.map(x => x.id === m.id ? { ...x, yapti: e.target.checked } : x) } }), true)} />
              {m.kitapAdi} — {m.konu} {m.sayfalar}
            </label>
          ))}
        </section>
      )}

      {veri.icerik.okuma && (
        <section aria-label="Okuma" className="flex flex-wrap items-end gap-4 text-sm">
          <span className="font-semibold">Okuma: {veri.icerik.okuma.kitap}</span>
          <label>Bu hafta okuduğu sayfa
            <input type="number" min={0} inputMode="numeric" className={`${kutu} w-24 block`} value={veri.icerik.okuma.sayfa ?? ''}
              onChange={e => degistir(h => ({ ...h, icerik: { ...h.icerik, okuma: h.icerik.okuma && { ...h.icerik.okuma, sayfa: sayi(e.target.value) } } }))} />
          </label>
          <label className="flex items-center gap-2"><input type="checkbox" className="w-5 h-5" checked={veri.icerik.okuma.bitti}
            onChange={e => degistir(h => ({ ...h, icerik: { ...h.icerik, okuma: h.icerik.okuma && { ...h.icerik.okuma, bitti: e.target.checked } } }), true)} /> Kitabı bitirdi</label>
        </section>
      )}

      <section aria-label="Görüşme" className="grid md:grid-cols-2 gap-3">
        {GORUSME.map(([k, ad]) => (
          <label key={k} className="text-sm">{ad}
            <textarea rows={2} maxLength={k === 'hedef' ? 300 : 1000} className={`${kutu} w-full block`} value={veri.gorusme[k]}
              onChange={e => degistir(h => ({ ...h, gorusme: { ...h.gorusme, [k]: e.target.value } }))} />
          </label>
        ))}
      </section>
    </div>
  )
}
