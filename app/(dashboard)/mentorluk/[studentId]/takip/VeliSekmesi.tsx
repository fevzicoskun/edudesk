'use client'
import { useState } from 'react'
import YazdirBaglantisi from './YazdirBaglantisi'
import { takipVeliMesaji } from '@/src/domains/mentor/takip/veliMesaji'
import { whatsappLink } from '@/src/domains/mentor/lib/bultenMath'
import type { SekmeProps } from './TakipIstemci'

/** Mesaj haftanın verisinden otomatik dolar; düzenlenirse o haftanın kaydına (gorusme.veliMesaji) yazılır. */
export default function VeliSekmesi({ v, veri, degistir, bosalt }: SekmeProps) {
  const otomatik = takipVeliMesaji({
    ogrenciAdi: v.ogrenci.ad, pazartesi: v.hafta, veri, onceki: v.onceki?.ozet ?? null,
    okul: v.okulOdevleri, kitaplar: v.kitaplar, mentorAdi: v.mentorAdi,
  })
  const duzenlendi = veri.gorusme.veliMesaji !== null
  const metin = veri.gorusme.veliMesaji ?? otomatik
  const kapali = !!v.kayit?.kapaliAt
  const [kopyalandi, setKopyalandi] = useState(false)
  return (
    <div className="space-y-3 max-w-2xl">
      <label className="text-sm block">Veliye gidecek mesaj {kapali ? '(hafta kapalı)' : '(düzenleyebilirsiniz; düzenleme bu haftaya kaydedilir)'}
        <textarea rows={14} readOnly={kapali} className="mt-1 w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2 text-base md:text-sm" value={metin}
          onChange={e => degistir(h => ({ ...h, gorusme: { ...h.gorusme, veliMesaji: e.target.value } }))} />
      </label>
      <p className="text-xs text-gray-500 dark:text-slate-400" role="status">
        {duzenlendi ? 'Düzenlenmiş mesaj (haftanın verisi değişirse kendiliğinden güncellenmez).' : 'Haftanın verisinden otomatik oluşturuldu.'}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 text-sm"
          onClick={async () => { await navigator.clipboard.writeText(metin); setKopyalandi(true); setTimeout(() => setKopyalandi(false), 2000) }}>
          {kopyalandi ? 'Kopyalandı ✓' : 'Mesajı kopyala'}
        </button>
        <a href={whatsappLink(metin, v.ogrenci.veliTelefon)} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm">WhatsApp&apos;ta gönder</a>
        {!kapali && duzenlendi && (
          <button type="button" className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 text-sm"
            onClick={() => { if (confirm('Düzenlemeleriniz silinip mesaj haftanın verisinden yeniden oluşturulsun mu?')) degistir(h => ({ ...h, gorusme: { ...h.gorusme, veliMesaji: null } }), true) }}>
            Yeniden oluştur
          </button>
        )}
        <YazdirBaglantisi href={`/mentorluk/${v.ogrenci.id}/takip/veli-raporu?hafta=${v.hafta}`} bosalt={bosalt} className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 text-sm">Veli raporunu yazdır</YazdirBaglantisi>
      </div>
    </div>
  )
}
