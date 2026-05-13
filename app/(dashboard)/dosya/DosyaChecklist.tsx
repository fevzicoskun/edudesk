'use client'

import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'dosya_checklist_v1'

const BELGELER = [
  {
    kategori: 'Temel Belgeler',
    icon: '📋',
    belgeler: [
      { id: 'kapak', ad: 'Dosya kapak sayfası' },
      { id: 'bayrak', ad: 'Türk Bayrağı' },
      { id: 'ataturk_portre', ad: 'Atatürk Portresi' },
      { id: 'istiklal_marsi', ad: 'İstiklal Marşı metni' },
      { id: 'genclige_hitabe', ad: "Atatürk'ün Gençliğe Hitabesi" },
      { id: 'ozgecmis', ad: 'Öğretmen Özgeçmişi (CV)' },
    ],
  },
  {
    kategori: 'Yasal Dayanak',
    icon: '⚖️',
    belgeler: [
      { id: 'mufredat', ad: 'Branşa ait öğretim programı (müfredat)' },
      { id: 'meb_kanun', ad: '1739 Sayılı Millî Eğitim Temel Kanunu' },
      { id: 'calisma_takvimi', ad: '2025–2026 Yıllık Çalışma Takvimi (okul takvimi)' },
    ],
  },
  {
    kategori: 'Planlama Belgeleri',
    icon: '📅',
    belgeler: [
      { id: 'yillik_plan', ad: 'Yıllık plan (ünitelendirilmiş)' },
      { id: 'gunluk_plan', ad: 'Günlük / ders planları' },
      { id: 'haftalik_program', ad: 'Haftalık ders programı (okul yönetimince tasdikli)' },
    ],
  },
  {
    kategori: 'Kurul & Zümre Belgeleri',
    icon: '🤝',
    belgeler: [
      { id: 'zumre_1', ad: 'Zümre öğretmenler kurulu toplantı tutanağı — 1. dönem' },
      { id: 'zumre_2', ad: 'Zümre öğretmenler kurulu toplantı tutanağı — 2. dönem' },
      { id: 'il_zumre', ad: 'İl / İlçe zümre toplantı tutanakları' },
      { id: 'sube_kurulu', ad: 'Şube öğretmenler kurulu kararları' },
      { id: 'ogretmenler_kurulu', ad: 'Öğretmenler kurulu kararları' },
    ],
  },
  {
    kategori: 'Değerlendirme Belgeleri',
    icon: '📝',
    belgeler: [
      { id: 'sinif_listesi', ad: 'Sınıf listesi / yoklama çizelgesi' },
      { id: 'performans', ad: 'Öğrenci performans / proje değerlendirme çizelgesi' },
      { id: 'yazili_sorular', ad: 'Yazılı sınav soruları ve cevap anahtarları (puanlama ile)' },
      { id: 'proje_rubrigi', ad: 'Proje değerlendirme formu / rubriği' },
      { id: 'sozlu_form', ad: 'Sözlü değerlendirme formu' },
    ],
  },
  {
    kategori: 'Mesleki Gelişim',
    icon: '🎓',
    belgeler: [
      { id: 'hizmetici', ad: 'Hizmetiçi eğitim katılım belgeleri' },
      { id: 'sertifikalar', ad: 'Kurs ve seminer sertifikaları' },
      { id: 'gelisim_plani', ad: 'Mesleki gelişim planı' },
    ],
  },
  {
    kategori: 'Veli İletişimi',
    icon: '👨‍👩‍👧',
    belgeler: [
      { id: 'veli_gorusme', ad: 'Veli görüşme tutanakları' },
      { id: 'veli_bilgi', ad: 'Veli bilgilendirme yazıları' },
    ],
  },
  {
    kategori: 'Kulüp & Sosyal Etkinlik',
    icon: '🎭',
    belgeler: [
      { id: 'kulup_yonerge', ad: 'Kulüp yönergesi / yıllık çalışma planı' },
      { id: 'kulup_uye', ad: 'Kulüp üye listesi' },
      { id: 'kulup_tutanak', ad: 'Kulüp etkinlik toplantı tutanakları' },
      { id: 'belirli_gunler', ad: 'Belirli gün ve haftalar çizelgesi' },
    ],
  },
]

const TOTAL = BELGELER.reduce((s, k) => s + k.belgeler.length, 0)

export default function DosyaChecklist() {
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setChecked(JSON.parse(saved))
    } catch {}
    setMounted(true)
  }, [])

  const toggle = useCallback((id: string) => {
    setChecked(prev => {
      const next = { ...prev, [id]: !prev[id] }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const tamamlanan = Object.values(checked).filter(Boolean).length
  const yuzde = Math.round((tamamlanan / TOTAL) * 100)

  if (!mounted) return null

  return (
    <div className="space-y-6">
      {/* Genel ilerleme */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
            Genel Tamamlanma
          </span>
          <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
            {tamamlanan} / {TOTAL} belge
          </span>
        </div>
        <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-3">
          <div
            className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300"
            style={{ width: `${yuzde}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">
          {yuzde === 100
            ? '✅ Dosyanız eksiksiz!'
            : `%${yuzde} tamamlandı — ${TOTAL - tamamlanan} belge eksik`}
        </p>
      </div>

      {/* Kategoriler */}
      {BELGELER.map(({ kategori, icon, belgeler }) => {
        const kat_tamam = belgeler.filter(b => checked[b.id]).length
        return (
          <div
            key={kategori}
            className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <span>{icon}</span>
                <h2 className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                  {kategori}
                </h2>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                kat_tamam === belgeler.length
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                  : 'bg-gray-200 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
              }`}>
                {kat_tamam}/{belgeler.length}
              </span>
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-slate-800">
              {belgeler.map(({ id, ad }) => (
                <li key={id}>
                  <label className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={!!checked[id]}
                      onChange={() => toggle(id)}
                      className="w-4 h-4 rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className={`text-sm ${
                      checked[id]
                        ? 'line-through text-gray-400 dark:text-slate-500'
                        : 'text-gray-700 dark:text-slate-200'
                    }`}>
                      {ad}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )
      })}

      {/* Sıfırla */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            if (!confirm('Tüm işaretler sıfırlansın mı?')) return
            setChecked({})
            try { localStorage.removeItem(STORAGE_KEY) } catch {}
          }}
          className="text-xs text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
        >
          İşaretleri sıfırla
        </button>
      </div>
    </div>
  )
}
