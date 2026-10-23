'use client'
import { useState, useTransition } from 'react'
import YazdirBaglantisi from './YazdirBaglantisi'
import { oncekiPlan, herkeseUygula, haftaSil } from '@/app/actions/mentor-takip'
import Link from 'next/link'
import { GUNLER, SEVIYE_ADI, seviyeDegistir, sablonaDon, gunlukAralik, gunSirasi, okulGunleri, type Gorev, type Seviye, takipHaftaEtiketi } from '@/src/domains/mentor/takip/takipMath'
import { BOS_SAATLER, duzenMetni, netSure, otomatikDuzenMi, planlananDk, saatlerVarMi, sureKisa } from '@/src/domains/mentor/takip/calismaSaatleri'
import { ilkAcikGun, odevEtiketi, odevGorevi, planDisi } from '@/src/domains/mentor/takip/odevYerlesim'
import { dersKisa } from '@/src/domains/mentor/lib/bultenMath'
import { planUyarilari } from '@/src/domains/mentor/takip/planKagidi'
import type { HomeworkRecord } from '@/src/domains/homework/lib/stats'
import type { SekmeProps } from './TakipIstemci'

// hucre: satır içi alan (genişlik çağrıda); kutu: tam genişlik form alanı
const hucre = 'rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-base md:text-sm'
const kutu = 'w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-base md:text-sm'
const yeniId = () => crypto.randomUUID()
const bosGorev = (gun: number, grup?: string): Gorev => ({
  id: yeniId(), gun, ad: 'Yeni görev', ders: null, miktar: 30, birim: 'dk', soruSatiri: false, konu: '', sayfa: '', yapti: false, soru: null, dogru: null, ...(grup && { grup }),
})
// Etiket rengi ek bilgi; metin tek başına ayırt eder (gecikmiş / yarın teslim / teslim gg.aa)
const ETIKET_RENK = { gecikmis: 'text-red-700 dark:text-red-400 font-semibold', yarin: 'text-amber-700 dark:text-amber-400 font-semibold', tarih: 'text-gray-500 dark:text-slate-400' }
const sayfaNo = (s: string) => (s === '' ? null : Math.min(5000, Math.max(1, Math.trunc(Number(s)) || 1)))

export default function PlanSekmesi({ v, veri, degistir, kaydiZorla }: SekmeProps) {
  const kitaplar = v.kitaplar // öğrencinin kalıcı kitapları (Öğrenci dosyası → Kitaplar)
  const [bilgi, setBilgi] = useState<string | null>(null)
  const [ustHata, setUstHata] = useState<string | null>(null)
  const [isliyor, basla] = useTransition()
  const kopyala = () => basla(async () => {
    setBilgi(null); setUstHata(null)
    const r = await oncekiPlan(v.ogrenci.id, v.hafta)
    if (r.error || !r.veri) { setUstHata(r.error ?? 'Kopyalanamadı.'); return }
    if (v.kayit && !confirm(`Bu haftanın planı ve girilmiş sonuçları, ${takipHaftaEtiketi(r.kaynak!)} haftasının planıyla değiştirilsin mi?`)) return
    const yeni = r.veri
    // Bu haftanın okul ödevi görevleri ve gizlenenleri kalır (önceki hafta planı yalnız elle görevleri getirir)
    degistir(h => ({ ...yeni, icerik: { ...yeni.icerik, gorevler: [...yeni.icerik.gorevler, ...h.icerik.gorevler.filter(g => g.odevId)], gizliOdevler: h.icerik.gizliOdevler } }), true)
    setBilgi(`${takipHaftaEtiketi(r.kaynak!)} haftasının planı kopyalandı; kitap sayfaları kaldığı yerden devam ediyor.`)
  })
  const herkese = () => {
    if (!confirm('Bu plan (bağlı kitaplar ve sayfalar dahil), bu hafta planı olmayan diğer mentör öğrencilerinize kopyalansın mı?')) return
    basla(async () => {
      setBilgi(null); setUstHata(null)
      if (!(await kaydiZorla())) { setUstHata('Önce kayıt hatasını giderin.'); return }
      const r = await herkeseUygula(v.ogrenci.id, v.hafta)
      if (r.error) { setUstHata(r.error); return }
      setBilgi(`${r.uygulanan} öğrenciye uygulandı${r.atlanan ? `; bu hafta planı olan ${r.atlanan} öğrenci atlandı` : ''}.`)
    })
  }
  // Her gün görevinde değişiklik beş kopyanın hepsine uygulanır (grup); güne özelde yalnız o satıra
  const ayni = (g: Gorev) => (x: Gorev) => (g.grup ? x.grup === g.grup : x.id === g.id)
  const gorev = (g: Gorev, p: Partial<Gorev>, hemen = false) =>
    degistir(h => ({ ...h, icerik: { ...h.icerik, gorevler: h.icerik.gorevler.map(x => ayni(g)(x) ? { ...x, ...p } : x) } }), hemen)
  // Otomatik ödev görevi silinince bu hafta tekrar gelmesin: gizli listeye girer, "Plana girmeyen ödevler"de kalır
  const sil = (g: Gorev) => {
    if (!confirm(`"${g.ad}" silinsin mi?${g.grup ? ' (Pzt–Cum her günden)' : ''}${g.odevId ? ' Ödev bu hafta plana tekrar gelmez.' : ''}`)) return
    degistir(h => ({ ...h, icerik: {
      ...h.icerik, gorevler: h.icerik.gorevler.filter(x => !ayni(g)(x)),
      ...(g.odevId && { gizliOdevler: [...new Set([...(h.icerik.gizliOdevler ?? []), g.odevId])] }),
    } }), true)
  }
  const kayitlar = new Map(v.odevKayitlari.map(o => [o.id, o]))
  const ilkGun = ilkAcikGun(v.hafta, v.bugun)
  const planaEkle = (o: HomeworkRecord) => degistir(h => ({ ...h, icerik: {
    ...h.icerik, gizliOdevler: (h.icerik.gizliOdevler ?? []).filter(x => x !== o.id),
    gorevler: [...h.icerik.gorevler.filter(x => x.odevId !== o.id), odevGorevi(o, ilkGun)],
  } }), true)
  const disarida = planDisi(v.disaridaOdevler, veri.icerik.gizliOdevler ?? [], v.odevKayitlari, veri.icerik.gorevler)
  // Kâğıt açıldıktan sonra VERİLMİŞ ödev (giriş zamanı değil: kaydedilmemiş birleşme her açılışta yeniden kurulur)
  const yeniMi = (g: Gorev) => !!(g.odevId && v.kagitBasildiAt && (kayitlar.get(g.odevId)?.created_at ?? '') > v.kagitBasildiAt)
  const yeniSayisi = veri.icerik.gorevler.filter(yeniMi).length
  const saatVar = saatlerVarMi(v.saatler)
  /** Gün başlığı: planlanan / müsait; aşım yalnız uyarı. Saat girilmemişse yalnız planlanan. */
  const gunSayaci = (gun: number) => {
    const plan = planlananDk(veri.icerik.gorevler, gun)
    if (!saatVar) return plan ? <span className="text-xs font-normal text-gray-500 dark:text-slate-400"> · {sureKisa(plan)}</span> : null
    const m = netSure(v.saatler!.gunler[gun])
    const asim = plan > m
    return (
      <span className={`text-xs ${asim ? 'text-amber-700 dark:text-amber-400 font-semibold' : 'font-normal text-gray-500 dark:text-slate-400'}`}>
        {' · '}{sureKisa(plan)} / {sureKisa(m)}{asim && (m === 0 ? ' · Çalışma saati yok' : ` · ${sureKisa(plan - m)} fazla`)}
      </span>
    )
  }

  // Okul ödevinden gelen görev: ad, süre, gün değişir; durum dersin öğretmeninin işaretinden
  const odevSatiri = (g: Gorev) => {
    const e = g.teslim ? odevEtiketi(g.teslim, v.bugun) : null
    return (
      <div key={g.id} aria-label={`Ödev: ${g.ad}`} className="flex flex-wrap items-center gap-2 py-1">
        <input aria-label="Görev" maxLength={120} className={`${hucre} flex-1 min-w-40`} value={g.ad}
          onChange={x => gorev(g, { ad: x.target.value })} onBlur={() => { if (!g.ad.trim()) gorev(g, { ad: 'Ödev' }, true) }} />
        <input aria-label="Miktar" type="number" min={1} max={600} className={`${hucre} w-20`} value={g.miktar ?? ''}
          onChange={x => gorev(g, { miktar: x.target.value ? Math.min(600, Math.max(1, Math.trunc(Number(x.target.value)))) : null })} />
        <span className="text-sm">dk</span>
        <select aria-label="Gün" className={`${hucre} w-20`} value={g.gun} onChange={x => gorev(g, { gun: Number(x.target.value) }, true)}>
          {gunSirasi(v.hafta).map(i => <option key={i} value={i}>{GUNLER[i]}</option>)}
        </select>
        {e && <span className={`text-xs ${ETIKET_RENK[e.tur]}`}>{e.metin}</span>}
        {yeniMi(g) && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">yeni</span>}
        {g.yapti && <span className="text-xs text-green-700 dark:text-green-400">✓ yapıldı (öğretmen işaretledi)</span>}
        <button type="button" aria-label={`${g.ad} görevini sil`} className="text-red-700 dark:text-red-400 text-sm ml-auto" onClick={() => sil(g)}>Sil</button>
      </div>
    )
  }
  // Her gün bloğu: grubun ilk (Pazartesi) kopyası temsil eder
  const herGun = veri.icerik.gorevler.filter((g, i, t) => g.grup && t.findIndex(x => x.grup === g.grup) === i)

  // Bileşen DEĞİL düz fonksiyon: render içinde tanımlı bileşen her tuşta yeniden kurulur, kutu odağı kaybolur
  const satir = (g: Gorev) => g.odevId ? odevSatiri(g) : (
      <div key={g.grup ?? g.id} className={`flex flex-wrap items-center gap-2 py-1 ${g.ders === 'Matematik' ? 'font-semibold' : ''}`}>
        <input aria-label="Görev" maxLength={120} required className={`${hucre} flex-1 min-w-40`} value={g.ad}
          onChange={e => gorev(g, { ad: e.target.value })} onBlur={() => { if (!g.ad.trim()) gorev(g, { ad: 'Görev' }, true) }} />
        <input aria-label="Miktar" type="number" min={1} max={600} className={`${hucre} w-20`} value={g.miktar ?? ''} disabled={g.birim === 'serbest'}
          onChange={e => gorev(g, { miktar: e.target.value ? Math.min(600, Math.max(1, Math.trunc(Number(e.target.value)))) : null })} />
        <select aria-label="Birim" className={`${hucre} w-24`} value={g.birim} onChange={e => gorev(g, { birim: e.target.value as Gorev['birim'] }, true)}>
          <option value="dk">dk</option><option value="soru">soru</option><option value="serbest">serbest</option>
        </select>
        <label className="text-xs flex items-center gap-1 font-normal">
          <input type="checkbox" checked={g.soruSatiri}
            onChange={e => gorev(g, e.target.checked ? { soruSatiri: true } : { soruSatiri: false, kitapId: null, kitapAdi: '', sayfaBas: null, sayfaSon: null }, true)} /> Soru
        </label>
        {g.soruSatiri && (
          <span className="flex items-center gap-1 text-sm font-normal">
            <select aria-label="Kitap" className={`${hucre} w-44`} value={g.kitapId ?? ''}
              onChange={e => { const k = kitaplar.find(x => x.id === e.target.value); gorev(g, k ? { kitapId: k.id, kitapAdi: k.ad } : { kitapId: null, kitapAdi: '', sayfaBas: null, sayfaSon: null }, true) }}>
              <option value="">Kitap yok</option>
              {g.kitapId && !kitaplar.some(k => k.id === g.kitapId) && <option value={g.kitapId}>{g.kitapAdi}</option>}
              {kitaplar.map(k => <option key={k.id} value={k.id}>{k.ad}{k.ders && ` · ${k.ders}`}</option>)}
            </select>
            {g.kitapId && <>
              <input aria-label="Başlangıç sayfası" type="number" min={1} max={5000} inputMode="numeric" placeholder="baş" className={`${hucre} w-20`} value={g.sayfaBas ?? ''}
                onChange={e => gorev(g, { sayfaBas: sayfaNo(e.target.value) })} />–
              <input aria-label="Bitiş sayfası" type="number" min={1} max={5000} inputMode="numeric" placeholder="son" className={`${hucre} w-20`} value={g.sayfaSon ?? ''}
                onChange={e => gorev(g, { sayfaSon: sayfaNo(e.target.value) })} />
              {g.sayfaBas != null && g.sayfaSon != null && g.sayfaSon < g.sayfaBas && <span role="alert" className="text-red-700 dark:text-red-400">bitiş başlangıçtan küçük</span>}
            </>}
          </span>
        )}
        <button type="button" aria-label={`${g.ad} görevini sil`} className="text-red-700 dark:text-red-400 text-sm ml-auto" onClick={() => sil(g)}>Sil</button>
        {/* Önizleme Sil'den sonra: basis-full satırı Sil'i alt satıra itmesin (2026-10-17) */}
        {g.grup && g.soruSatiri && g.kitapId && g.sayfaBas != null && (g.sayfaSon ?? g.sayfaBas) >= g.sayfaBas && (
          <p aria-label="Günlük sayfa dağılımı" className="basis-full text-xs font-normal text-gray-500 dark:text-slate-400 pl-1">
            {okulGunleri(v.hafta).map((gun, i) => { const a = gunlukAralik(g.sayfaBas!, g.sayfaSon ?? g.sayfaBas!, i); return `${GUNLER[gun]} ${a ? (a[0] === a[1] ? a[0] : `${a[0]}–${a[1]}`) : '—'}` }).join(' · ')}
          </p>
        )}
      </div>
  )

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end gap-4">
        <fieldset>
          <legend className="text-sm font-medium mb-1">Seviye</legend>
          <div className="flex gap-1">
            {SEVIYE_ADI.map((ad, i) => (
              <button key={ad} type="button" aria-pressed={veri.seviye === i}
                onClick={() => degistir(h => seviyeDegistir(h, i as Seviye, v.ogrenci.sinif), true)}
                className={`px-3 py-1.5 rounded border text-sm ${veri.seviye === i ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 dark:border-slate-600'}`}>{ad}</button>
            ))}
          </div>
        </fieldset>
        <label className="text-sm">Soru hedefi
          <input type="number" min={0} inputMode="numeric" className={`${kutu} w-24 block`} value={veri.soruHedefi}
            onChange={e => degistir(h => ({ ...h, soruHedefi: Math.max(0, Math.trunc(Number(e.target.value) || 0)) }))} />
        </label>
        <button type="button" className="text-sm text-gray-600 dark:text-slate-400 underline"
          onClick={() => { if (confirm('Program sınıf şablonuna dönsün mü? Elle girilen görevler silinir; okul ödevleri kalır.')) degistir(h => ({ ...h, icerik: { ...h.icerik, gorevler: sablonaDon(h.icerik, v.ogrenci.sinif, h.seviye) } }), true) }}>
          Sınıf şablonuna dön
        </button>
        <button type="button" disabled={isliyor} className="text-sm text-blue-700 dark:text-blue-400 underline" onClick={kopyala}>Geçen haftayı kopyala</button>
        <button type="button" disabled={isliyor} className="text-sm text-blue-700 dark:text-blue-400 underline" onClick={herkese}>Bu planı tüm mentör öğrencilerime uygula</button>
        {v.kayit && (
          <button type="button" disabled={isliyor} className="text-sm text-red-700 dark:text-red-400 underline"
            onClick={() => { if (confirm(`${takipHaftaEtiketi(v.hafta)} haftasının planı ve girilmiş sonuçları kalıcı olarak silinsin mi? (Kitaplar ve çalışma saatleri kalır.)`)) basla(async () => {
              const r = await haftaSil(v.ogrenci.id, v.hafta)
              if (r.error) setUstHata(r.error); else location.reload()
            }) }}>Bu haftanın planını sil</button>
        )}
        <YazdirBaglantisi href={`/mentorluk/${v.ogrenci.id}/takip/kagit?hafta=${v.hafta}`} bosalt={kaydiZorla} className="ml-auto px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium">Kâğıdı yazdır</YazdirBaglantisi>
      </section>

      {!saatVar && <p className="text-sm text-gray-600 dark:text-slate-400 -mt-3">Çalışma saatleri girilmemiş — <Link className="text-blue-700 dark:text-blue-400 underline" href={`/mentorluk/${v.ogrenci.id}/takip?hafta=${v.hafta}&sekme=dosya`}>Öğrenci dosyası&apos;ndan ekleyin</Link></p>}
      {/* Kâğıtta da görünen sorunlar planı hazırlarken mentöre (2026-10-24): sığmaz sayfa aralığı, tatile yığılan gecikmiş */}
      {(() => { const u = planUyarilari(veri.icerik.gorevler, v.hafta, v.bugun); return u.length > 0 && (
        <div role="status" aria-label="Kâğıt uyarıları" className="-mt-3 rounded border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
          <p className="font-semibold">Kâğıtta dikkat:</p>
          <ul className="list-disc pl-5">{u.map(x => <li key={x}>{x}</li>)}</ul>
        </div>
      ) })()}
      {yeniSayisi > 0 && <p role="status" className="text-sm -mt-3 text-amber-800 dark:text-amber-300">Kâğıt yazdırıldıktan sonra {yeniSayisi} yeni ödev eklendi — tekrar yazdır.</p>}
      {(bilgi || ustHata) && <p role={ustHata ? 'alert' : 'status'} className={`text-sm -mt-3 ${ustHata ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>{ustHata ?? bilgi}</p>}
      <section aria-label="Program" className="space-y-5">
        <div>
          <h2 className="text-base font-semibold">Hafta içi her gün <span className="text-xs font-normal text-gray-500 dark:text-slate-400">(Pzt–Cum her güne yazılır)</span></h2>
          {herGun.map(satir)}
          <button type="button" className="text-sm text-blue-600 hover:underline"
            onClick={() => { const grup = `h-${yeniId()}`; degistir(h => ({ ...h, icerik: { ...h.icerik, gorevler: [...h.icerik.gorevler, ...[0, 1, 2, 3, 4].map(gun => bosGorev(gun, grup))] } }), true) }}>
            + Her gün görevi ekle
          </button>
        </div>
        <div>
          <h2 className="text-base font-semibold">Güne özel</h2>
          {gunSirasi(v.hafta).map(gun => {
            const gunAdi = GUNLER[gun]
            const satirlar = veri.icerik.gorevler.filter(g => g.gun === gun && !g.grup)
            return (
              <div key={gunAdi} className="mt-2">
                <h3 className="text-sm font-semibold">{gunAdi}{gunSayaci(gun)}</h3>
                {satirlar.map(satir)}
                <button type="button" className="text-sm text-blue-600 hover:underline"
                  onClick={() => degistir(h => ({ ...h, icerik: { ...h.icerik, gorevler: [...h.icerik.gorevler, bosGorev(gun)] } }), true)}>
                  + {gunAdi} görevi ekle
                </button>
              </div>
            )
          })}
        </div>
      </section>

      {veri.icerik.otoOdev && !v.kayit?.kapaliAt && (
        <section aria-label="Plana girmeyen ödevler">
          <h2 className="text-base font-semibold mb-1">Plana girmeyen ödevler <span className="text-xs font-normal text-gray-500 dark:text-slate-400">(silinenler, sığmayan ya da 3 haftadan eski gecikmişler, gelecek hafta teslim)</span></h2>
          {disarida.length === 0 ? <p className="text-sm text-gray-500 dark:text-slate-400">Yok — yapılmamış ödevlerin hepsi planda.</p> : (
            <ul className="text-sm space-y-1">{disarida.map(o => { const e = o.due_date ? odevEtiketi(o.due_date, v.bugun) : null; return (
              <li key={o.id} className="flex flex-wrap items-center gap-2">{dersKisa(o.subject)} — {o.title}
                {e && <span className={`text-xs ${ETIKET_RENK[e.tur]}`}>{e.metin}</span>}
                <button type="button" className="text-xs text-blue-700 dark:text-blue-400 underline" onClick={() => planaEkle(o)}>Plana ekle</button>
              </li>) })}</ul>)}
        </section>
      )}

      {/* Kapalı hafta: kapatma anındaki görüntü; işaretsiz eski plan: ödevler elle takip edilir, liste olarak */}
      {(!veri.icerik.otoOdev || v.kayit?.kapaliAt) && <section aria-label="Okul ödevleri" className="space-y-3">
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
      </section>}

      <section aria-label="Okuma">
        <h2 className="text-base font-semibold mb-2">Okuma</h2>
        <label className="text-sm">Okuduğu kitap
          <input maxLength={150} className={`${kutu} block max-w-md`} value={veri.icerik.okuma?.kitap ?? ''} placeholder="Kitap adı"
            onChange={e => degistir(h => ({ ...h, icerik: { ...h.icerik, okuma: e.target.value.trim() ? { kitap: e.target.value, sayfa: h.icerik.okuma?.sayfa ?? null, bitti: h.icerik.okuma?.bitti ?? false } : null } }))} />
        </label>
      </section>

      <section aria-label="Hafta içi düzen">
        {/* Boş = öğrencinin çalışma saatlerinden otomatik; mentör yazarsa o basılır */}
        <label className="text-sm">Hafta içi düzen (kâğıda basılır)
          <input maxLength={300} className={`${kutu} block`} value={otomatikDuzenMi(veri.icerik.duzen) ? '' : veri.icerik.duzen}
            placeholder={duzenMetni(v.saatler ?? BOS_SAATLER) || 'Çalışma saatleri girilince otomatik oluşur'}
            onChange={e => degistir(h => ({ ...h, icerik: { ...h.icerik, duzen: e.target.value } }))} />
        </label>
        {!otomatikDuzenMi(veri.icerik.duzen) && (
          <button type="button" className="text-sm text-blue-700 dark:text-blue-400 underline mt-1"
            onClick={() => degistir(h => ({ ...h, icerik: { ...h.icerik, duzen: '' } }), true)}>Saatlerden oluştur</button>
        )}
      </section>
    </div>
  )
}
