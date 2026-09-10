'use client'

import { useId, useRef, useState, useTransition } from 'react'
import { yenileTakvimBaglantisi } from '@/app/actions/takvimAbonelik'

export default function TakvimAboneligi({ initialUrl }: { initialUrl: string | null }) {
  const [url, setUrl] = useState(initialUrl)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const id = useId()

  function handleCopy() {
    if (!url) return
    setError(null)
    setStatus('')
    const copying = navigator.clipboard?.writeText(url)
    const fallback = () => {
      inputRef.current?.select()
      setError('Kopyalanamadı — bağlantı seçildi, elle kopyalayın')
    }
    if (!copying) return fallback()
    copying.then(() => setStatus('Bağlantı panoya kopyalandı'), fallback)
  }

  function handleGenerate() {
    const isRotation = url !== null
    setConfirming(false)
    setError(null)
    setStatus('')
    startTransition(async () => {
      const result = await yenileTakvimBaglantisi()
      if (result.error || !result.url) {
        setError(result.error ?? 'Bağlantı oluşturulamadı')
        return
      }
      setUrl(result.url)
      setStatus(isRotation ? 'Yeni bağlantı oluşturuldu; eski bağlantı artık çalışmaz' : 'Abonelik bağlantısı oluşturuldu')
    })
  }

  const webcalUrl = url?.replace(/^https?:\/\//, 'webcal://')

  // Canlı bölge boşken de DOM'da ve görünür kalır (display:none olursa bazı ekran okuyucular eklenen metni okumaz);
  // buton satırında durduğu için boşken dikey yer kaplamaz.
  const statusRegion = (
    <p role="status" aria-live="polite" className="text-xs text-green-700 dark:text-green-400">
      {status}
    </p>
  )

  return (
    <section
      aria-labelledby={`${id}-baslik`}
      className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 space-y-4"
    >
      <div>
        <h2 id={`${id}-baslik`} className="text-sm font-semibold text-gray-900 dark:text-slate-100">
          Takvim aboneliği
        </h2>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
          Nöbet, veli görüşmesi, ödev teslimi, okul etkinlikleri ve tatilleri telefonunuzun takvimine ekleyin.
          Son 30 gün ile önümüzdeki 90 gün gösterilir; takvim uygulamanız birkaç saatte bir günceller.
        </p>
      </div>

      {url ? (
        <>
          <div>
            <label htmlFor={`${id}-url`} className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
              Abonelik bağlantısı
            </label>
            <div className="flex gap-2">
              <input
                id={`${id}-url`}
                ref={inputRef}
                readOnly
                value={url}
                onFocus={e => e.currentTarget.select()}
                className="min-w-0 flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg font-mono text-xs bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleCopy}
                aria-label="Takvim abonelik bağlantısını kopyala"
                className="shrink-0 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Kopyala
              </button>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1.5">
              Bu bağlantıya sahip olan herkes takviminizi görebilir; paylaşmayın.
            </p>
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-gray-700 dark:text-slate-300">Nasıl eklenir?</summary>
            <div className="mt-2 space-y-2 text-xs text-gray-500 dark:text-slate-400">
              <p>
                <strong className="text-gray-700 dark:text-slate-300">iPhone / iPad:</strong>{' '}
                <a href={webcalUrl} className="text-blue-600 dark:text-blue-400 underline">Bu bağlantıya dokunun</a>{' '}
                ve &quot;Abone Ol&quot;u seçin. Ya da Ayarlar → Takvim → Hesaplar → Hesap Ekle → Diğer →
                Takvim Aboneliği Ekle yolunda bağlantıyı yapıştırın.
              </p>
              <p>
                <strong className="text-gray-700 dark:text-slate-300">Google Takvim (Android):</strong>{' '}
                Bilgisayardan calendar.google.com adresini açın → sol menüde &quot;Diğer takvimler&quot; yanındaki + →
                &quot;URL ile&quot; → bağlantıyı yapıştırın. Takvim, aynı hesapla telefonunuzdaki Google Takvim&apos;de görünür.
              </p>
            </div>
          </details>

          {confirming ? (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Eski bağlantı hemen çalışmayı durdurur; telefonlarınızdaki aboneliği yeni bağlantıyla yeniden eklemeniz gerekir.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                >
                  Evet, yenile
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Vazgeç
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={pending}
                className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 underline disabled:opacity-60"
              >
                {pending ? 'Yenileniyor…' : 'Bağlantıyı yenile'}
              </button>
              {statusRegion}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={pending}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            {pending ? 'Oluşturuluyor…' : 'Abonelik bağlantısı oluştur'}
          </button>
          {statusRegion}
        </div>
      )}

      {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </section>
  )
}
