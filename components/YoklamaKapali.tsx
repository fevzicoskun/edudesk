import Link from 'next/link'

/** Okulun yoklama modülü kapalıyken yoklama/devamsızlık sayfalarında gösterilir (Ayarlar → Okul ayarları). */
export default function YoklamaKapali({ yonetici }: { yonetici: boolean }) {
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-8 text-center">
        <p className="text-base font-semibold text-gray-900 dark:text-slate-100">Yoklama modülü kapalı</p>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          {yonetici
            ? 'Okulunuz yoklamayı EduDesk üzerinden almıyor. Kayıtlı veriler silinmedi; modülü Ayarlar\'dan açabilirsiniz.'
            : 'Okulunuz yoklamayı EduDesk üzerinden almıyor. Açılması için okul idaresiyle görüşebilirsiniz.'}
        </p>
        {yonetici && (
          <Link href="/ayarlar" className="inline-flex items-center justify-center min-h-[44px] px-4 mt-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold">
            Ayarlar
          </Link>
        )}
      </div>
    </div>
  )
}
