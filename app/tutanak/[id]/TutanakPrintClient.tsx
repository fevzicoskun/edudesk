'use client'

import { useState } from 'react'

type Meeting = {
  title: string
  meeting_date: string
  notes: string | null
}

export default function TutanakPrintClient({
  meeting,
  dateStr,
  defaultOkulAdi,
  defaultOgretmenAdi,
}: {
  meeting: Meeting
  dateStr: string
  defaultOkulAdi: string
  defaultOgretmenAdi: string
}) {
  const [okulAdi, setOkulAdi] = useState(defaultOkulAdi)
  const [katilimcilar, setKatilimcilar] = useState(defaultOgretmenAdi)

  const names = katilimcilar
    .split('\n')
    .map((n) => n.trim())
    .filter(Boolean)
  const sigRows = names.length > 0 ? names : ['', '', '', '']

  return (
    <>
      {/* Yazdır öncesi düzenleme paneli */}
      <div className="print:hidden bg-gray-50 border-b border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex flex-col sm:flex-row gap-3 items-start">
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-500 block mb-1">Okul Adı</label>
            <input
              type="text"
              value={okulAdi}
              onChange={(e) => setOkulAdi(e.target.value)}
              placeholder="Örn: Atatürk Anadolu Lisesi"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-500 block mb-1">
              Katılımcılar <span className="text-gray-400 font-normal">(her satıra bir isim)</span>
            </label>
            <textarea
              value={katilimcilar}
              onChange={(e) => setKatilimcilar(e.target.value)}
              rows={3}
              placeholder={'Ahmet Yılmaz\nFatma Demir\nMehmet Kaya'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex items-end pb-0.5">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Yazdır / PDF
            </button>
          </div>
        </div>
      </div>

      {/* Tutanak gövdesi */}
      <div className="max-w-2xl mx-auto px-8 py-8 print:py-0 print:px-0">

        {/* Başlık */}
        <div className="text-center mb-4 print:mb-3 border-b-2 border-gray-800 pb-4 print:pb-2">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest">T.C.</p>
          <p className="text-sm font-semibold text-gray-700 mt-0.5">MİLLÎ EĞİTİM BAKANLIĞI</p>
          {okulAdi && (
            <p className="text-sm font-bold text-gray-900 mt-0.5">{okulAdi.toUpperCase()}</p>
          )}
          <h1 className="text-sm font-bold text-gray-900 uppercase tracking-wide mt-3 print:mt-2">
            {meeting.title}
          </h1>
          <p className="text-xs text-gray-600 mt-0.5 font-medium">TUTANAĞI</p>
        </div>

        {/* Meta bilgiler */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mb-4 print:mb-3 text-xs border border-gray-300 rounded p-3 print:p-2">
          <div className="flex gap-2">
            <span className="font-semibold text-gray-700 whitespace-nowrap">Toplantı Tarihi:</span>
            <span className="text-gray-900">{dateStr}</span>
          </div>
          <div className="flex gap-2">
            <span className="font-semibold text-gray-700 whitespace-nowrap">Toplantı Yeri:</span>
            <span className="text-gray-400">____________________</span>
          </div>
          <div className="flex gap-2">
            <span className="font-semibold text-gray-700 whitespace-nowrap">Toplantı Saati:</span>
            <span className="text-gray-400">____________________</span>
          </div>
          <div className="flex gap-2">
            <span className="font-semibold text-gray-700 whitespace-nowrap">Toplantı No:</span>
            <span className="text-gray-400">____________________</span>
          </div>
        </div>

        {/* Gündem ve kararlar */}
        <div className="text-xs text-gray-800 leading-relaxed whitespace-pre-wrap mb-4 print:mb-3">
          {meeting.notes || <span className="text-gray-400">Toplantı notu girilmemiş.</span>}
        </div>

        {/* İmza bölümü — katılımcı isimlerine göre dinamik */}
        <div className="border-t-2 border-gray-800 pt-3 print:pt-2">
          <p className="text-xs font-bold text-gray-800 mb-3 print:mb-2 uppercase tracking-wide">
            Katılımcılar ve İmzalar
          </p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 print:gap-y-3">
            {sigRows.map((name, i) => (
              <div key={i} className="space-y-1.5 print:space-y-1">
                <div>
                  <p className="text-[10px] text-gray-500 mb-0.5">Ad Soyad</p>
                  {name ? (
                    <p className="text-xs font-semibold text-gray-800 border-b border-gray-400 h-4 leading-none pt-0.5">{name}</p>
                  ) : (
                    <div className="border-b border-gray-400 h-4" />
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 mb-0.5">Ünvan / Branş</p>
                  <div className="border-b border-gray-400 h-4" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 mb-0.5">İmza</p>
                  <div className="border-b border-gray-400 h-7 print:h-6" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-[10px] text-gray-400 mt-4 print:mt-3">
          EduDesk
        </p>
      </div>
    </>
  )
}
