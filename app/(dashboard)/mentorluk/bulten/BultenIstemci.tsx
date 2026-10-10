// app/(dashboard)/mentorluk/bulten/BultenIstemci.tsx
'use client'
import { useEffect, useState } from 'react'
import { bultenGonderildi } from '@/app/actions/mentor'

type Grup = { class_name: string; odevlerUrl: string; ozetUrl: string }
type Ogr = { student_id: string; full_name: string; class_name: string; eksikSayisi: number; mesaj: string; whatsapp: string; gorselUrl: string }

const dugme = 'inline-flex items-center justify-center min-h-[44px] px-3 rounded-xl border border-gray-200 dark:border-slate-700 text-sm text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-slate-500'
const ana = 'inline-flex items-center justify-center min-h-[44px] px-3 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700'

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

/** Paylaş: iOS Safari dokunma iznini share() öncesindeki uzun await'te düşürür → PNG `hazirla` olunca ÖNCEDEN
 *  File olarak alınır; dokununca navigator.share beklemesiz çağrılır. Desteklenmiyorsa yalnız "Görseli indir". */
function PaylasIndir({ url, ad, metin, hazirla, onGonder }: { url: string; ad: string; metin?: string; hazirla: boolean; onGonder?: () => void }) {
  const [paylasilir, setPaylasilir] = useState(false)
  const [dosya, setDosya] = useState<File | null>(null)
  const [durum, setDurum] = useState('')
  useEffect(() => {
    const deneme = new File([''], 'x.png', { type: 'image/png' })
    setPaylasilir(typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [deneme] }))
  }, [])
  useEffect(() => {
    if (!paylasilir || !hazirla || dosya) return
    let iptal = false
    pngDosyasi(url, ad).then(f => { if (!iptal) setDosya(f) }, () => { if (!iptal) setDurum('Görsel hazırlanamadı, Görseli indir ile deneyin') })
    return () => { iptal = true }
  }, [paylasilir, hazirla, dosya, url, ad])
  return (
    <>
      {paylasilir && (
        <button type="button" className={ana} disabled={!dosya} aria-busy={!dosya} onClick={() => {
          if (!dosya) return
          onGonder?.()
          // await YOK: share() dokunmayla aynı görev içinde çağrılmalı
          navigator.share({ files: [dosya], ...(metin ? { text: metin } : {}) })
            .catch((e: Error) => { if (e.name !== 'AbortError') setDurum('Paylaşılamadı, Görseli indir ile deneyin') })
        }}>{dosya ? 'Paylaş' : 'Hazırlanıyor…'}</button>
      )}
      <a className={dugme} href={url} download={`${ad}.png`}>Görseli indir</a>
      {durum && <span role="status" className="text-sm text-red-600 dark:text-red-400">{durum}</span>}
    </>
  )
}

/** Bilgisayar: Windows paylaşım menüsü WhatsApp Desktop'a yalnız metni geçirir. Bunun yerine kart panoya PNG
 *  kopyalanır ve wa.me sohbeti metin yazılı açılır; mentör Ctrl+V ile görseli ekler. Yalnız fare/dokunmatik-dışı cihazda. */
function MasaustuGonder({ url, whatsapp, onGonder }: { url: string; whatsapp: string; onGonder: () => void }) {
  const [masaustu, setMasaustu] = useState(false)
  const [durum, setDurum] = useState<{ ok: boolean; metin: string } | null>(null)
  useEffect(() => {
    setMasaustu(typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches
      && typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write)
  }, [])
  if (!masaustu) return null
  return (
    <>
      <button type="button" className={ana} onClick={() => {
        // ikisi de tıklamayla aynı görevde başlar: pano için Blob sözü (Chrome destekler), sekme senkron açılır
        const kopya = navigator.clipboard.write([new ClipboardItem({
          'image/png': fetch(url).then(r => { if (!r.ok) throw new Error('görsel'); return r.blob() }),
        })])
        window.open(whatsapp, '_blank', 'noopener')
        onGonder()
        kopya.then(
          () => setDurum({ ok: true, metin: 'Sohbet açıldı, metin hazır. Görsel panoda: sohbette Ctrl+V ile yapıştırıp gönderin.' }),
          () => setDurum({ ok: false, metin: 'Görsel panoya kopyalanamadı. Sohbet açıldı; görseli "Görseli indir" ile ekleyin.' }),
        )
      }}>WhatsApp&apos;a gönder (görsel + metin)</button>
      {durum && <span role="status" className={`text-sm ${durum.ok ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{durum.metin}</span>}
    </>
  )
}

export default function BultenIstemci({ hafta, gruplar, ogrenciler, gonderilenler }: { hafta: string; gruplar: Grup[]; ogrenciler: Ogr[]; gonderilenler: string[] }) {
  // işaret sunucuda (bulten_gonderimleri): idare ana sayfası mentör başına ilerlemeyi buradan görür
  const [gonderildi, setGonderildi] = useState<Record<string, boolean>>(() => Object.fromEntries(gonderilenler.map(id => [id, true])))
  const [kayitHatasi, setKayitHatasi] = useState('')
  const [kopyalandi, setKopyalandi] = useState('')
  // satır bir kez açılınca kişisel görsel paylaşım için önceden hazırlanır (kapalı satırlar için istek atılmaz)
  const [acik, setAcik] = useState<Record<string, boolean>>({})
  const isaretle = (id: string, v: boolean) => {
    setGonderildi(g => ({ ...g, [id]: v }))
    bultenGonderildi(id, hafta, v).then(
      r => { if (r.error) { setGonderildi(g => ({ ...g, [id]: !v })); setKayitHatasi(r.error) } else setKayitHatasi('') },
      () => { setGonderildi(g => ({ ...g, [id]: !v })); setKayitHatasi('Kaydedilemedi, tekrar deneyin.') },
    )
  }
  // gönder/paylaş/kopyala düğmeleri işareti kendiliğinden koyar
  const gonderdi = (id: string) => { if (!gonderildi[id]) isaretle(id, true) }

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
                <div className="flex flex-wrap gap-2"><PaylasIndir url={url} ad={`${g.class_name} ${baslik}`} hazirla /></div>
              </figure>
            ))}
          </div>
        ))}
      </section>

      <section aria-labelledby="veli-baslik">
        <h2 id="veli-baslik" className="text-base font-bold text-gray-900 dark:text-slate-100 mb-1">Velilere kişisel mesaj</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">
          {ogrenciler.filter(o => gonderildi[o.student_id]).length}/{ogrenciler.length} gönderildi. Paylaş, WhatsApp ve Kopyala düğmeleri işareti kendiliğinden koyar.
        </p>
        {kayitHatasi && <p role="alert" className="text-sm text-red-600 dark:text-red-400 mb-3">{kayitHatasi}</p>}
        <ul className="divide-y divide-gray-200 dark:divide-slate-700 border border-gray-200 dark:border-slate-700 rounded-2xl">
          {ogrenciler.map(o => (
            <li key={o.student_id}>
              <details className="group" onToggle={e => { const a = (e.currentTarget as HTMLDetailsElement).open; if (a) setAcik(x => ({ ...x, [o.student_id]: true })) }}>
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
                    <PaylasIndir url={o.gorselUrl} ad={o.full_name} metin={o.mesaj} hazirla={!!acik[o.student_id]} onGonder={() => gonderdi(o.student_id)} />
                    <MasaustuGonder url={o.gorselUrl} whatsapp={o.whatsapp} onGonder={() => gonderdi(o.student_id)} />
                    <a className={dugme} href={o.whatsapp} target="_blank" rel="noopener noreferrer" onClick={() => gonderdi(o.student_id)}>WhatsApp&apos;ta aç</a>
                    <button type="button" className={dugme} onClick={async () => {
                      try { await navigator.clipboard.writeText(o.mesaj); setKopyalandi(o.student_id); gonderdi(o.student_id) } catch { setKopyalandi('') }
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
