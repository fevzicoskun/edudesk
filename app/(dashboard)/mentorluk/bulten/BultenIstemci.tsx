// app/(dashboard)/mentorluk/bulten/BultenIstemci.tsx
'use client'
import { useEffect, useState } from 'react'

type Grup = { class_name: string; odevlerUrl: string; ozetUrl: string }
type Ogr = { student_id: string; full_name: string; class_name: string; eksikSayisi: number; mesaj: string; whatsapp: string; gorselUrl: string }

const dugme = 'inline-flex items-center justify-center min-h-[44px] px-3 rounded-xl border border-gray-200 dark:border-slate-700 text-sm text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-slate-500'
const ana = 'inline-flex items-center justify-center min-h-[44px] px-3 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700'

const anahtar = (hafta: string, id: string) => `bulten:${hafta}:${id}`
function gonderildiOku(hafta: string, id: string): boolean {
  try { return localStorage.getItem(anahtar(hafta, id)) === '1' } catch { return false } // gizli sekme / engelli depolama
}
function gonderildiYaz(hafta: string, id: string, v: boolean) {
  try { if (v) localStorage.setItem(anahtar(hafta, id), '1'); else localStorage.removeItem(anahtar(hafta, id)) } catch { /* yok say */ }
}

async function pngDosyasi(url: string, ad: string): Promise<File> {
  const r = await fetch(url)
  if (!r.ok) throw new Error('Görsel oluşturulamadı')
  return new File([await r.blob()], `${ad}.png`, { type: 'image/png' })
}

function Gorsel({ url, alt }: { url: string; alt: string }) {
  const [hata, setHata] = useState(false)
  return hata
    ? <p role="status" className="text-sm text-gray-500 dark:text-slate-400 p-4 border border-dashed rounded-xl">Görsel oluşturulamadı</p>
    : <img src={url} alt={alt} loading="lazy" onError={() => setHata(true)} className="w-full max-w-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white" />
}

function PaylasIndir({ url, ad, metin }: { url: string; ad: string; metin?: string }) {
  const [paylasilir, setPaylasilir] = useState(false)
  const [durum, setDurum] = useState('')
  useEffect(() => {
    const deneme = new File([''], 'x.png', { type: 'image/png' })
    setPaylasilir(typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [deneme] }))
  }, [])
  return (
    <>
      {paylasilir && (
        <button type="button" className={ana} onClick={async () => {
          try { await navigator.share({ files: [await pngDosyasi(url, ad)], ...(metin ? { text: metin } : {}) }) }
          catch (e) { if ((e as Error).name !== 'AbortError') setDurum('Paylaşılamadı, Görseli indir ile deneyin') }
        }}>Paylaş</button>
      )}
      <a className={dugme} href={url} download={`${ad}.png`}>Görseli indir</a>
      {durum && <span role="status" className="text-sm text-red-600 dark:text-red-400">{durum}</span>}
    </>
  )
}

export default function BultenIstemci({ hafta, gruplar, ogrenciler }: { hafta: string; gruplar: Grup[]; ogrenciler: Ogr[] }) {
  const [gonderildi, setGonderildi] = useState<Record<string, boolean>>({})
  const [kopyalandi, setKopyalandi] = useState('')
  useEffect(() => { setGonderildi(Object.fromEntries(ogrenciler.map(o => [o.student_id, gonderildiOku(hafta, o.student_id)]))) }, [hafta, ogrenciler])
  const isaretle = (id: string, v: boolean) => { gonderildiYaz(hafta, id, v); setGonderildi(g => ({ ...g, [id]: v })) }

  return (
    <div className="space-y-8">
      <section aria-labelledby="grup-baslik">
        <h2 id="grup-baslik" className="text-base font-bold text-gray-900 dark:text-slate-100 mb-1">Veli grubu için</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">Bu görseller isim içermez; sınıf veli grubunda paylaşılabilir.</p>
        {gruplar.map(g => (
          <div key={g.class_name} className="grid gap-4 sm:grid-cols-2 mb-4">
            {[['Bu haftanın ödevleri', g.odevlerUrl], ['Geçen haftanın özeti', g.ozetUrl]].map(([baslik, url]) => (
              <figure key={url} className="space-y-2">
                <figcaption className="text-sm font-semibold text-gray-700 dark:text-slate-300">{g.class_name} · {baslik}</figcaption>
                <Gorsel url={url} alt={`${g.class_name} ${baslik}`} />
                <div className="flex flex-wrap gap-2"><PaylasIndir url={url} ad={`${g.class_name} ${baslik}`} /></div>
              </figure>
            ))}
          </div>
        ))}
      </section>

      <section aria-labelledby="veli-baslik">
        <h2 id="veli-baslik" className="text-base font-bold text-gray-900 dark:text-slate-100 mb-1">Velilere kişisel mesaj</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">
          {Object.values(gonderildi).filter(Boolean).length}/{ogrenciler.length} gönderildi olarak işaretli (yalnız bu cihazda).
        </p>
        <ul className="divide-y divide-gray-200 dark:divide-slate-700 border border-gray-200 dark:border-slate-700 rounded-2xl">
          {ogrenciler.map(o => (
            <li key={o.student_id}>
              <details className="group">
                <summary className="flex items-center justify-between gap-3 min-h-[44px] px-4 py-2 cursor-pointer">
                  <span className="font-medium text-gray-900 dark:text-slate-100">
                    {o.full_name} <span className="text-sm text-gray-500 dark:text-slate-400">· {o.class_name}</span>
                  </span>
                  <span className="flex items-center gap-2 text-sm">
                    <span className={o.eksikSayisi ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}>
                      {o.eksikSayisi ? `${o.eksikSayisi} eksik` : 'tebrik'}
                    </span>
                    {gonderildi[o.student_id] && <span className="text-green-700 dark:text-green-400">✓ Gönderildi</span>}
                  </span>
                </summary>
                <div className="px-4 pb-4 space-y-3">
                  <pre className="whitespace-pre-wrap text-sm bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-xl p-3 font-sans">{o.mesaj}</pre>
                  <Gorsel url={o.gorselUrl} alt={`${o.full_name} haftalık ödev kartı`} />
                  <div className="flex flex-wrap gap-2 items-center">
                    <PaylasIndir url={o.gorselUrl} ad={o.full_name} metin={o.mesaj} />
                    <a className={dugme} href={o.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp&apos;ta aç</a>
                    <button type="button" className={dugme} onClick={async () => {
                      try { await navigator.clipboard.writeText(o.mesaj); setKopyalandi(o.student_id) } catch { setKopyalandi('') }
                    }}>{kopyalandi === o.student_id ? 'Kopyalandı' : 'Kopyala'}</button>
                    <label className="inline-flex items-center gap-2 min-h-[44px] text-sm text-gray-700 dark:text-slate-300">
                      <input type="checkbox" className="w-5 h-5" checked={!!gonderildi[o.student_id]} onChange={e => isaretle(o.student_id, e.target.checked)} />
                      Gönderildi
                    </label>
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
