'use client'
import Link from 'next/link'
import { useCallback, useState, useTransition } from 'react'
import { haftaKaydet, haftaKilidiAc } from '@/app/actions/mentor-takip'
import { haftaKaydir, haftaBasi, takipHaftaEtiketi } from '@/src/domains/mentor/takip/takipMath'

import { todayLocalISO } from '@/src/shared/date'
import type { HaftaVerisi } from '@/src/domains/mentor/takip/takipMath'
import type { SayfaVerisi } from '@/src/domains/mentor/services/TakipService'
import { useOtoKayit, type KayitDurumu } from './useOtoKayit'
import PlanSekmesi from './PlanSekmesi'
import SonucSekmesi from './SonucSekmesi'
import VeliSekmesi from './VeliSekmesi'
import DosyaSekmesi from './DosyaSekmesi'

export type Sekme = 'plan' | 'sonuc' | 'veli' | 'dosya'
export type SekmeProps = {
  v: SayfaVerisi; veri: HaftaVerisi; degistir: (f: (h: HaftaVerisi) => HaftaVerisi, hemen?: boolean) => void
  /** Bekleyen kaydı yaz; true = kaydedildi (yazdırmadan önce) */
  bosalt: () => Promise<boolean>
  /** Taslak haftayı da kayda dönüştürür (Kâğıdı yazdır, Herkese uygula) */
  kaydiZorla: () => Promise<boolean>
}
// Task 6: sonuc: 'Sonuç' · Task 8: veli: 'Veli mesajı' · Task 9: dosya: 'Öğrenci dosyası'
const SEKME_ADI: Partial<Record<Sekme, string>> = { plan: 'Plan', sonuc: 'Sonuç', veli: 'Veli mesajı', dosya: 'Öğrenci dosyası' }

function Durum({ d, tekrar }: { d: KayitDurumu; tekrar: () => void }) {
  if (d.tur === 'kaydediliyor') return <span role="status" className="text-sm text-gray-500 dark:text-slate-400">Kaydediliyor…</span>
  if (d.tur === 'kaydedildi') return <span role="status" className="text-sm text-green-700 dark:text-green-400">Kaydedildi · {d.saat}</span>
  if (d.tur === 'cakisma') return <span role="alert" className="text-sm text-red-700 dark:text-red-400">Başka bir ekranda değişti ya da bu sayfa eski kaldı; son değişiklikler kaydedilmedi — <button className="underline" onClick={() => location.reload()}>yenileyin</button></span>
  if (d.tur === 'hata') return <span role="alert" className="text-sm text-red-700 dark:text-red-400">Kaydedilemedi: {d.mesaj} · <button className="underline" onClick={tekrar}>Tekrar dene</button></span>
  return null
}

function KapaliBandi({ v }: { v: SayfaVerisi }) {
  const [hata, setHata] = useState<string | null>(null)
  const [bekliyor, basla] = useTransition()
  const tarih = new Date(v.kayit!.kapaliAt!).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' })
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 px-3 py-2 text-sm">
      <span>🔒 Bu hafta {tarih} tarihinde kapatıldı; plan, sonuç ve okul ödevi durumu sabit.</span>
      <button type="button" disabled={bekliyor} className="underline"
        onClick={() => { if (confirm('Kilit açılsın mı? Okul ödevleri yeniden ödev modülünden canlı okunur.')) basla(async () => {
          const r = await haftaKilidiAc(v.ogrenci.id, v.hafta)
          if (r.error) setHata(r.error); else location.reload()
        }) }}>Kilidi aç</button>
      {hata && <span role="alert" className="text-red-700 dark:text-red-400">{hata}</span>}
    </div>
  )
}

/** key = öğrenci+hafta: sekme değişince bileşen kalır, yerel `veri` korunur; hafta değişince sıfırdan açılır. */
export default function TakipIstemci({ v, sekme: istenen }: { v: SayfaVerisi; sekme: Sekme }) {
  const sekme: Sekme = istenen in SEKME_ADI ? istenen : 'plan'
  const [veri, setVeri] = useState<HaftaVerisi>(v.taslak)
  const kaydet = useCallback((h: HaftaVerisi, sonBilinen: string | null) =>
    haftaKaydet({ studentId: v.ogrenci.id, hafta: v.hafta, ...h, sonBilinen }), [v.ogrenci.id, v.hafta])
  const { durum, anlik, bosalt, kayitli, kaydiZorla } = useOtoKayit(veri, kaydet, v.kayit?.updatedAt ?? null)
  const degistir: SekmeProps['degistir'] = (f, hemen) => { if (hemen) anlik(); setVeri(f) }
  const url = (hafta: string, s: Sekme = sekme) => `/mentorluk/${v.ogrenci.id}/takip?hafta=${hafta}&sekme=${s}`
  const props: SekmeProps = { v, veri, degistir, bosalt, kaydiZorla }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <Link href={`/mentorluk/${v.ogrenci.id}`} onClick={bosalt} className="text-sm text-gray-500 dark:text-slate-400 hover:text-blue-600">← {v.ogrenci.ad}</Link>
      <div className="mt-2 mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Haftalık Takip</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">{v.ogrenci.ad} · {v.ogrenci.sinifAdi}</p>
          <label className="mt-1 inline-flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
            Ekran süresi
            <input type="text" maxLength={40} placeholder="ör. günde 3 sa" disabled={!!v.kayit?.kapaliAt}
              value={veri.icerik.ekranSuresi ?? ''}
              onChange={e => { const ekranSuresi = e.target.value; degistir(h => ({ ...h, icerik: { ...h.icerik, ekranSuresi } })) }}
              className="w-36 px-2 py-1 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-base sm:text-sm" />
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Link aria-label="Önceki hafta" onClick={bosalt} href={url(haftaKaydir(v.hafta, -1))} className="px-2 py-1 rounded border border-gray-300 dark:border-slate-600">‹</Link>
          <span className="text-sm font-medium tabular-nums">{takipHaftaEtiketi(v.hafta)}</span>
          {!kayitli && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">Taslak, henüz kaydedilmedi</span>}
          <Link aria-label="Sonraki hafta" onClick={bosalt} href={url(haftaKaydir(v.hafta, 1))} className="px-2 py-1 rounded border border-gray-300 dark:border-slate-600">›</Link>
          <Link onClick={bosalt} href={url(haftaBasi(todayLocalISO()))} className="text-sm text-blue-600 hover:underline">Bu hafta</Link>
        </div>
        <Durum d={durum} tekrar={() => void bosalt()} />
      </div>
      {Object.keys(SEKME_ADI).length > 1 && (
        <nav aria-label="Takip sekmeleri" className="flex gap-1 border-b border-gray-200 dark:border-slate-700 mb-5 overflow-x-auto">
          {(Object.keys(SEKME_ADI) as Sekme[]).map(s => (
            <Link key={s} href={url(v.hafta, s)} onClick={bosalt} aria-current={s === sekme ? 'page' : undefined}
              className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 ${s === sekme ? 'border-blue-600 text-blue-700 dark:text-blue-400 font-semibold' : 'border-transparent text-gray-600 dark:text-slate-400'}`}>
              {SEKME_ADI[s]}
            </Link>
          ))}
        </nav>
      )}
      {v.kayit?.kapaliAt && <KapaliBandi v={v} />}
      {/* Kapalı hafta salt okunur: fieldset tüm alanları/düğmeleri kapatır; yazdırma bağlantıları (a) çalışır */}
      <fieldset disabled={!!v.kayit?.kapaliAt} className="min-w-0">
        {sekme === 'plan' && <PlanSekmesi {...props} />}
        {sekme === 'sonuc' && <SonucSekmesi {...props} />}
      </fieldset>
      {sekme === 'veli' && <VeliSekmesi {...props} />}
      {sekme === 'dosya' && <DosyaSekmesi {...props} />}
    </div>
  )
}
