'use client'
import { GUNLER, miktarYaz, ozetHesapla, programYuzde, dogrulukYuzde, fark, type Gorev, type Gorusme } from '@/src/domains/mentor/takip/takipMath'
import { dersKisa } from '@/src/domains/mentor/lib/bultenMath'
import type { SekmeProps } from './TakipIstemci'

const kutu = 'rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-base md:text-sm'
const DURUM: Record<string, string> = { yapildi: 'Yaptı', gec: 'Geç yaptı', eksik: 'Eksik', yapilmadi: 'Yapmadı', mazeretli: 'Mazeretli' }
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

  return (
    <div className="space-y-6">
      <section aria-label="Özet" className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kart baslik="Program" deger={p === null ? '—' : `%${p}`} alt={`${o.gorev_yapilan}/${o.gorev_toplam}`} />
        <Kart baslik="Soru" deger={`${o.soru}`} alt={`hedef ${veri.soruHedefi}`} />
        <Kart baslik="Doğruluk" deger={d === null ? '—' : `%${d}`} alt={f === null ? undefined : `${f >= 0 ? '↑' : '↓'} ${Math.abs(f)} puan`} />
        <Kart baslik="Mentör ödevi" deger={`${mo.filter(m => m.yapti).length}/${mo.length}`} />
        <Kart baslik="Okuma" deger={`${o.okuma_sayfa} sf`} />
      </section>

      <table className="w-full text-sm border-collapse">
        <thead><tr className="text-left text-xs text-gray-500 dark:text-slate-400 border-b border-gray-300 dark:border-slate-600">
          <th className="py-1">Gün</th><th>Görev</th><th>Süre</th><th>Yaptı</th><th>Soru</th><th>Doğru</th></tr></thead>
        <tbody>
          {veri.icerik.gorevler.slice().sort((a, b) => a.gun - b.gun).map(g => (
            <tr key={g.id} aria-label={`${GUNLER[g.gun]} ${g.ad}`} className={`border-b border-gray-100 dark:border-slate-700 ${g.ders === 'Matematik' ? 'font-semibold' : ''}`}>
              <td className="py-1 pr-2">{GUNLER[g.gun]}</td>
              <td className="pr-2">{g.ad}{g.konu && <span className="text-gray-500 dark:text-slate-400"> · {g.konu}</span>}</td>
              <td className="pr-2 whitespace-nowrap">{miktarYaz(g, veri.seviye)}</td>
              <td><input type="checkbox" aria-label="Yaptı" className="w-5 h-5" checked={g.yapti} onChange={e => gorev(g.id, { yapti: e.target.checked }, true)} /></td>
              <td>{g.soruSatiri && <input aria-label="Soru" type="number" min={0} inputMode="numeric" className={`${kutu} w-20`} value={g.soru ?? ''}
                onChange={e => { const s = sayi(e.target.value); gorev(g.id, { soru: s, dogru: g.dogru === null || s === null ? (s === null ? null : g.dogru) : Math.min(g.dogru, s) }) }} />}</td>
              <td>{g.soruSatiri && <input aria-label="Doğru" type="number" min={0} max={g.soru ?? 0} inputMode="numeric" className={`${kutu} w-20`} value={g.dogru ?? ''} disabled={g.soru === null}
                onChange={e => { const x = sayi(e.target.value); gorev(g.id, { dogru: x === null ? null : Math.min(x, g.soru ?? 0) }) }} />}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section aria-label="Okul ödevleri">
        <h2 className="text-base font-semibold mb-2">Okul ödevleri <span className="text-xs font-normal text-gray-500 dark:text-slate-400">(dersin öğretmeninin işareti)</span></h2>
        {v.okulOdevleri.length === 0 ? <p className="text-sm text-gray-500 dark:text-slate-400">Bu hafta okul ödevi yok.</p>
          : <ul className="text-sm space-y-1">{v.okulOdevleri.map(x => (
              <li key={x.id}>{dersKisa(x.subject)} — {x.title}: <b>{x.status ? DURUM[x.status] ?? x.status : x.bekliyor ? 'Henüz kontrol edilmedi' : 'İşaretlenmedi'}</b></li>))}</ul>}
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
            <textarea rows={2} className={`${kutu} w-full block`} value={veri.gorusme[k]}
              onChange={e => degistir(h => ({ ...h, gorusme: { ...h.gorusme, [k]: e.target.value } }))} />
          </label>
        ))}
      </section>
    </div>
  )
}
