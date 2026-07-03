'use client'

import { useState } from 'react'
import Link from 'next/link'

const KAYIT_URL = 'https://www.myedudesk.com.tr/kayit'

// Müdür Başlangıç kartı: davet kodu + kopyala + WhatsApp paylaş.
// Görünürlük SetupService'te: 30 gün içinde VE okulda müdürden başka üye yok.
export default function BaslangicKartiMudur({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard izni yoksa sessiz geç — kod ekranda zaten görünür
    }
  }

  const waText = encodeURIComponent(
    `EduDesk'e katıl! Okul kodumuz: ${code}\nKayıt: ${KAYIT_URL}`,
  )

  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">
        Okulunuz hazır — şimdi ekibinizi davet edin
      </h2>
      <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 mb-4">
        Öğretmenler bu kodla kayıt olup okulunuza katılır.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-2xl font-bold tracking-widest text-gray-900 dark:text-slate-100 bg-gray-50 dark:bg-slate-700/60 border border-gray-200 dark:border-slate-600 rounded-lg px-4 py-2">
          {code}
        </span>
        <button
          type="button"
          onClick={copy}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {copied ? 'Kopyalandı ✓' : 'Kopyala'}
        </button>
        <a
          href={`https://wa.me/?text=${waText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
        >
          WhatsApp ile paylaş
        </a>
      </div>

      <p className="text-xs text-gray-500 dark:text-slate-400 mt-4">
        Sonraki adımlar:{' '}
        <Link href="/siniflar" className="text-blue-600 dark:text-blue-400 hover:underline">sınıf ekle</Link>
        {' · '}
        <Link href="/yonetim/ogrenciler" className="text-blue-600 dark:text-blue-400 hover:underline">öğrenci ekle</Link>
      </p>
    </section>
  )
}
