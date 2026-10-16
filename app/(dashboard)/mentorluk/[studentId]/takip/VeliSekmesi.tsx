'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { takipVeliMesaji, konuAdlari } from '@/src/domains/mentor/takip/veliMesaji'
import { whatsappLink } from '@/src/domains/mentor/lib/bultenMath'
import type { SekmeProps } from './TakipIstemci'

export default function VeliSekmesi({ v, veri }: SekmeProps) {
  const otomatik = takipVeliMesaji({ ogrenciAdi: v.ogrenci.ad, pazartesi: v.hafta, veri, onceki: v.onceki?.ozet ?? null, konular: konuAdlari(v.konular, v.konuDurumu), mentorAdi: v.mentorAdi })
  const [metin, setMetin] = useState(otomatik)
  const [kopyalandi, setKopyalandi] = useState(false)
  useEffect(() => setMetin(otomatik), [otomatik])
  return (
    <div className="space-y-3 max-w-2xl">
      <label className="text-sm block">Veliye gidecek mesaj (düzenleyebilirsiniz)
        <textarea rows={16} className="mt-1 w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2 text-base md:text-sm" value={metin} onChange={e => setMetin(e.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 text-sm"
          onClick={async () => { await navigator.clipboard.writeText(metin); setKopyalandi(true); setTimeout(() => setKopyalandi(false), 2000) }}>
          {kopyalandi ? 'Kopyalandı ✓' : 'Mesajı kopyala'}
        </button>
        <a href={whatsappLink(metin, v.ogrenci.veliTelefon)} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm">WhatsApp&apos;ta gönder</a>
        <Link href={`/mentorluk/${v.ogrenci.id}/takip/veli-raporu?hafta=${v.hafta}`} className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 text-sm">Veli raporunu yazdır</Link>
      </div>
      <p className="text-xs text-gray-500 dark:text-slate-400">Düzenlemeniz kaydedilmez; mesaj her açılışta güncel verilerden yeniden oluşur.</p>
    </div>
  )
}
