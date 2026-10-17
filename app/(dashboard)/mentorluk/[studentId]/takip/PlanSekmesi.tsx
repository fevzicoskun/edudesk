'use client'
import { useState, useTransition } from 'react'
import YazdirBaglantisi from './YazdirBaglantisi'
import { kitapEkle, kitapSil } from '@/app/actions/mentor-takip'
import { GUNLER, SEVIYE_ADI, miktarYaz, varsayilanHedef, type Gorev, type Seviye } from '@/src/domains/mentor/takip/takipMath'
import { sinifSablonu } from '@/src/domains/mentor/takip/sablonlar'
import { dersKisa } from '@/src/domains/mentor/lib/bultenMath'
import type { SekmeProps } from './TakipIstemci'

const kutu = 'w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-base md:text-sm'
const yeniId = () => crypto.randomUUID()
const sayfaNo = (s: string) => (s === '' ? null : Math.min(5000, Math.max(1, Math.trunc(Number(s)) || 1)))

export default function PlanSekmesi({ v, veri, degistir, bosalt }: SekmeProps) {
  const [kitaplar, setKitaplar] = useState(v.kitaplar)
  const [kitapAdi, setKitapAdi] = useState(''); const [kitapDers, setKitapDers] = useState('')
  const [hata, setHata] = useState<string | null>(null)
  const [, basla] = useTransition()
  const gorev = (id: string, p: Partial<Gorev>, hemen = false) =>
    degistir(h => ({ ...h, icerik: { ...h.icerik, gorevler: h.icerik.gorevler.map(g => g.id === id ? { ...g, ...p } : g) } }), hemen)
  const konuListesi = (ders: string | null) => v.konular.filter(k => k.ders === (ders ?? ''))

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end gap-4">
        <fieldset>
          <legend className="text-sm font-medium mb-1">Seviye</legend>
          <div className="flex gap-1">
            {SEVIYE_ADI.map((ad, i) => (
              <button key={ad} type="button" aria-pressed={veri.seviye === i}
                onClick={() => degistir(h => ({ ...h, seviye: i as Seviye, soruHedefi: varsayilanHedef(v.ogrenci.sinif, i as Seviye) }), true)}
                className={`px-3 py-1.5 rounded border text-sm ${veri.seviye === i ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 dark:border-slate-600'}`}>{ad}</button>
            ))}
          </div>
        </fieldset>
        <label className="text-sm">Soru hedefi
          <input type="number" min={0} inputMode="numeric" className={`${kutu} w-24 block`} value={veri.soruHedefi}
            onChange={e => degistir(h => ({ ...h, soruHedefi: Math.max(0, Math.trunc(Number(e.target.value) || 0)) }))} />
        </label>
        <button type="button" className="text-sm text-gray-600 dark:text-slate-400 underline"
          onClick={() => { if (confirm('Program sınıf şablonuna dönsün mü? Bu haftaki görevler silinir.')) degistir(h => ({ ...h, icerik: { ...h.icerik, gorevler: sinifSablonu(v.ogrenci.sinif) } }), true) }}>
          Sınıf şablonuna dön
        </button>
        <YazdirBaglantisi href={`/mentorluk/${v.ogrenci.id}/takip/kagit?hafta=${v.hafta}`} bosalt={bosalt} className="ml-auto px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium">Kâğıdı yazdır</YazdirBaglantisi>
      </section>

      <section aria-label="Program">
        {GUNLER.map((gunAdi, gun) => {
          const satirlar = veri.icerik.gorevler.filter(g => g.gun === gun)
          return (
            <div key={gunAdi} className="mb-3">
              <h3 className="text-sm font-semibold mb-1">{gunAdi}</h3>
              {satirlar.map(g => (
                <div key={g.id} className={`grid grid-cols-12 gap-2 items-center py-1 ${g.ders === 'Matematik' ? 'font-semibold' : ''}`}>
                  <input aria-label="Görev" maxLength={120} required className={`${kutu} col-span-12 md:col-span-4`} value={g.ad} onChange={e => gorev(g.id, { ad: e.target.value })}
                    onBlur={() => { if (!g.ad.trim()) gorev(g.id, { ad: 'Görev' }, true) }} />
                  <span className="col-span-3 md:col-span-1 text-sm tabular-nums">{miktarYaz(g, veri.seviye)}</span>
                  <input aria-label="Miktar" type="number" min={1} max={600} className={`${kutu} col-span-3 md:col-span-1`} value={g.miktar ?? ''}
                    onChange={e => gorev(g.id, { miktar: e.target.value ? Math.min(600, Math.max(1, Math.trunc(Number(e.target.value)))) : null })} />
                  <select aria-label="Birim" className={`${kutu} col-span-3 md:col-span-1`} value={g.birim} onChange={e => gorev(g.id, { birim: e.target.value as Gorev['birim'] }, true)}>
                    <option value="dk">dk</option><option value="soru">soru</option><option value="serbest">serbest</option>
                  </select>
                  <input aria-label="Konu" maxLength={120} list={`konu-${g.id}`} className={`${kutu} col-span-9 md:col-span-3`} value={g.konu} placeholder="Konu" onChange={e => gorev(g.id, { konu: e.target.value })} />
                  <datalist id={`konu-${g.id}`}>{konuListesi(g.ders).map(k => <option key={k.id} value={k.ad} />)}</datalist>
                  <label className="col-span-2 md:col-span-1 text-xs flex items-center gap-1">
                    <input type="checkbox" checked={g.soruSatiri} onChange={e => gorev(g.id, { soruSatiri: e.target.checked }, true)} /> Soru
                  </label>
                  <button type="button" aria-label={`${g.ad} görevini sil`} className="col-span-1 text-red-700 dark:text-red-400 text-sm"
                    onClick={() => { if (confirm(`"${g.ad}" silinsin mi?`)) degistir(h => ({ ...h, icerik: { ...h.icerik, gorevler: h.icerik.gorevler.filter(x => x.id !== g.id) } }), true) }}>Sil</button>
                  <div className="col-span-12 flex flex-wrap items-center gap-2 font-normal md:pl-4">
                    <select aria-label="Kitap" className={`${kutu} w-auto max-w-56`} value={g.kitapId ?? ''}
                      onChange={e => { const k = kitaplar.find(x => x.id === e.target.value); gorev(g.id, k ? { kitapId: k.id, kitapAdi: k.ad } : { kitapId: null, kitapAdi: '', sayfaBas: null, sayfaSon: null }, true) }}>
                      <option value="">Kitap yok</option>
                      {g.kitapId && !kitaplar.some(k => k.id === g.kitapId) && <option value={g.kitapId}>{g.kitapAdi}</option>}
                      {kitaplar.map(k => <option key={k.id} value={k.id}>{k.ad}{k.ders && ` · ${k.ders}`}</option>)}
                    </select>
                    {g.kitapId ? (
                      <span className="flex items-center gap-1 text-sm">s.
                        <input aria-label="Başlangıç sayfası" type="number" min={1} max={5000} inputMode="numeric" className={`${kutu} w-20`} value={g.sayfaBas ?? ''}
                          onChange={e => gorev(g.id, { sayfaBas: sayfaNo(e.target.value) })} />–
                        <input aria-label="Bitiş sayfası" type="number" min={1} max={5000} inputMode="numeric" className={`${kutu} w-20`} value={g.sayfaSon ?? ''}
                          onChange={e => gorev(g.id, { sayfaSon: sayfaNo(e.target.value) })} />
                        {g.sayfaBas != null && g.sayfaSon != null && g.sayfaSon < g.sayfaBas && <span role="alert" className="text-red-700 dark:text-red-400">bitiş başlangıçtan küçük</span>}
                      </span>
                    ) : (
                      <input aria-label="Sayfa" maxLength={60} className={`${kutu} w-32`} value={g.sayfa} placeholder="Sayfa (serbest)" onChange={e => gorev(g.id, { sayfa: e.target.value })} />
                    )}
                  </div>
                </div>
              ))}
              <button type="button" className="text-sm text-blue-600 hover:underline"
                onClick={() => degistir(h => ({ ...h, icerik: { ...h.icerik, gorevler: [...h.icerik.gorevler, { id: yeniId(), gun, ad: 'Yeni görev', ders: null, miktar: 30, birim: 'dk', soruSatiri: false, konu: '', sayfa: '', yapti: false, soru: null, dogru: null }] } }), true)}>
                + {gunAdi} görevi ekle
              </button>
            </div>
          )
        })}
      </section>

      <section aria-label="Okul ödevleri" className="space-y-3">
        {([
          ['Tamamlanmamış ödevler', v.okulOdevleri.tamamlanmamis, 'Yapılmadı işaretli, teslimi geçmiş ödev yok.', 'öğretmen yapıldı işaretleyene kadar her hafta görünür'],
          ['Bu hafta teslim', v.okulOdevleri.buHafta, 'Bu hafta son teslimli okul ödevi yok.', null],
          ['Gelecek hafta teslim', v.okulOdevleri.gelecek, 'Gelecek hafta teslimli verilmiş ödev yok.', 'şu ana kadar verilmiş olanlar'],
        ] as const).map(([baslik, liste, bos, not]) => (
          <div key={baslik}>
            <h2 className="text-base font-semibold mb-1">{baslik}{not && <span className="text-xs font-normal text-gray-500 dark:text-slate-400"> ({not})</span>}</h2>
            {liste.length === 0
              ? <p className="text-sm text-gray-500 dark:text-slate-400">{bos}</p>
              : <ul className="text-sm space-y-1">{liste.map(o => <li key={o.id} className={baslik === 'Tamamlanmamış ödevler' ? 'text-red-700 dark:text-red-400' : ''}>{dersKisa(o.subject)} — {o.title} <span className="text-gray-500 dark:text-slate-400">({o.due_date.slice(8, 10)}.{o.due_date.slice(5, 7)})</span></li>)}</ul>}
          </div>
        ))}
      </section>

      <section aria-label="Mentör ödevleri">
        <h2 className="text-base font-semibold mb-1">Kitaplar ve mentör ödevleri</h2>
        <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">Buraya eklenen kitap, yukarıdaki görevlere bağlanabilir.</p>
        {veri.icerik.mentorOdevleri.map(m => (
          <div key={m.id} className="grid grid-cols-12 gap-2 items-center py-1">
            <select aria-label="Kitap" className={`${kutu} col-span-12 md:col-span-4`} value={m.kitapId ?? ''}
              onChange={e => { const k = kitaplar.find(x => x.id === e.target.value); if (k) degistir(h => ({ ...h, icerik: { ...h.icerik, mentorOdevleri: h.icerik.mentorOdevleri.map(x => x.id === m.id ? { ...x, kitapId: k.id, kitapAdi: k.ad } : x) } }), true) }}>
              {!kitaplar.some(k => k.id === m.kitapId) && <option value={m.kitapId ?? ''}>{m.kitapAdi}</option>}
              {kitaplar.map(k => <option key={k.id} value={k.id}>{k.ad}</option>)}
            </select>
            <input aria-label="Konu" maxLength={120} className={`${kutu} col-span-6 md:col-span-4`} value={m.konu} placeholder="Konu"
              onChange={e => degistir(h => ({ ...h, icerik: { ...h.icerik, mentorOdevleri: h.icerik.mentorOdevleri.map(x => x.id === m.id ? { ...x, konu: e.target.value } : x) } }))} />
            <input aria-label="Sayfalar" maxLength={60} className={`${kutu} col-span-4 md:col-span-3`} value={m.sayfalar} placeholder="s. 45–52"
              onChange={e => degistir(h => ({ ...h, icerik: { ...h.icerik, mentorOdevleri: h.icerik.mentorOdevleri.map(x => x.id === m.id ? { ...x, sayfalar: e.target.value } : x) } }))} />
            <button type="button" aria-label="Mentör ödevini sil" className="col-span-2 md:col-span-1 text-red-700 dark:text-red-400 text-sm"
              onClick={() => { if (confirm('Bu ödev silinsin mi?')) degistir(h => ({ ...h, icerik: { ...h.icerik, mentorOdevleri: h.icerik.mentorOdevleri.filter(x => x.id !== m.id) } }), true) }}>Sil</button>
          </div>
        ))}
        {kitaplar.length > 0 && (
          <button type="button" className="text-sm text-blue-600 hover:underline"
            onClick={() => degistir(h => ({ ...h, icerik: { ...h.icerik, mentorOdevleri: [...h.icerik.mentorOdevleri, { id: yeniId(), kitapId: kitaplar[0].id, kitapAdi: kitaplar[0].ad, konu: '', sayfalar: '', yapti: false }] } }), true)}>
            + Mentör ödevi ekle
          </button>
        )}
        <form className="mt-3 flex flex-wrap gap-2 items-end" onSubmit={e => {
          e.preventDefault()
          basla(async () => {
            const r = await kitapEkle(v.ogrenci.id, kitapAdi, kitapDers)
            if (r.error || !r.kitap) { setHata(r.error ?? 'Kitap eklenemedi.'); return }
            setKitaplar(k => [...k, r.kitap!]); setKitapAdi(''); setKitapDers(''); setHata(null)
          })
        }}>
          <label className="text-sm">Kitap adı<input maxLength={120} className={`${kutu} block w-56`} value={kitapAdi} onChange={e => setKitapAdi(e.target.value)} required /></label>
          <label className="text-sm">Ders<input maxLength={60} className={`${kutu} block w-32`} value={kitapDers} onChange={e => setKitapDers(e.target.value)} /></label>
          <button className="px-3 py-1.5 rounded border border-gray-300 dark:border-slate-600 text-sm">Kitap ekle</button>
          {hata && <span role="alert" className="text-sm text-red-700 dark:text-red-400">{hata}</span>}
        </form>
        {kitaplar.length > 0 && (
          <ul className="mt-2 text-sm flex flex-wrap gap-2">
            {kitaplar.map(k => (
              <li key={k.id} className="px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-800">{k.ad}{k.ders && ` · ${k.ders}`}
                <button type="button" aria-label={`${k.ad} kitabını sil`} className="ml-1 text-red-700 dark:text-red-400"
                  onClick={() => { if (confirm(`"${k.ad}" silinsin mi? Eski haftalarda adı görünmeye devam eder.`)) basla(async () => { const r = await kitapSil(v.ogrenci.id, k.id); if (!r.error) setKitaplar(x => x.filter(y => y.id !== k.id)); else setHata(r.error) }) }}>×</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Okuma">
        <h2 className="text-base font-semibold mb-2">Okuma</h2>
        <label className="text-sm">Okuduğu kitap
          <input maxLength={150} className={`${kutu} block max-w-md`} value={veri.icerik.okuma?.kitap ?? ''} placeholder="Kitap adı"
            onChange={e => degistir(h => ({ ...h, icerik: { ...h.icerik, okuma: e.target.value.trim() ? { kitap: e.target.value, sayfa: h.icerik.okuma?.sayfa ?? null, bitti: h.icerik.okuma?.bitti ?? false } : null } }))} />
        </label>
      </section>

      <section aria-label="Hafta içi düzen">
        <label className="text-sm">Hafta içi düzen (kâğıda basılır)
          <input maxLength={300} className={`${kutu} block`} value={veri.icerik.duzen} onChange={e => degistir(h => ({ ...h, icerik: { ...h.icerik, duzen: e.target.value } }))} />
        </label>
      </section>
    </div>
  )
}
