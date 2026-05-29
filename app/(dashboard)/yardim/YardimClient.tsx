'use client'

import { useState } from 'react'
import Link from 'next/link'

type Item = { s: string; c: string }
type Group = { title: string; items: Item[] }
type Tab = { id: string; label: string; color: string; groups: Group[] }

const TABS: Tab[] = [
  {
    id: 'ogretmen',
    label: 'Öğretmen',
    color: 'bg-blue-600',
    groups: [
      {
        title: 'Ödevler',
        items: [
          { s: 'Ödev nasıl oluştururum?', c: 'Ödevler menüsü → "Yeni Ödev" → başlık, ders, sınıf ve son tarihi doldurun.' },
          { s: 'Ödev kontrolü neden kilitlendi?', c: 'Son tarihten 3 gün geçince kontrol girişi otomatik kapanır. Ödev listesindeki "Bekleyen Kontroller" uyarısı kalan süreyi gösterir.' },
          { s: 'Tüm sınıfı toplu nasıl güncellerim?', c: 'Ödev detay sayfasında "Toplu Güncelle" açılır menüsünden tüm sınıfı aynı duruma çekip sonra istisnaları tek tek düzeltin.' },
        ],
      },
      {
        title: 'Yoklama',
        items: [
          { s: 'Yoklama nasıl girilir?', c: 'Yoklama menüsü → tarih ve sınıfı seçin → her öğrenci için Var/Yok/Geç/Mazeretli işaretleyin.' },
          { s: 'Geçmiş tarihe yoklama girebilir miyim?', c: 'Evet, geçmiş günlere geri dönüp yoklama ekleyebilir veya düzenleyebilirsiniz.' },
        ],
      },
      {
        title: 'Not Defteri',
        items: [
          { s: 'Not defterine nasıl not eklerim?', c: 'Not Defteri menüsü → sınıfı seçin → sütun adı ekleyin → öğrencinin notuna tıklayarak girin.' },
          { s: 'Ortalamalar nasıl hesaplanır?', c: 'Girdiğiniz sütunların ağırlıklı ortalaması sistem tarafından otomatik hesaplanır.' },
        ],
      },
      {
        title: 'Müfettiş Dosyası',
        items: [
          { s: 'Denetim için hangi belgeleri hazırlamalıyım?', c: '"Öğretmen Dosyası" (sol menü) bölümündeki kontrol listesini takip edin. Profil → Dosyam altında: Günlük Plan, Yıllık Plan, Zümre Toplantıları, ŞÖK, Yazılı Sınav ve Defter Kontrol sayfaları bulunur.' },
          { s: 'Dosyalarımı PDF olarak alabilir miyim?', c: 'Evet. Profil → Dosyam altındaki her bölümde PDF indirme butonu bulunur.' },
        ],
      },
    ],
  },
  {
    id: 'zumre',
    label: 'Zümre Başkanı',
    color: 'bg-teal-600',
    groups: [
      {
        title: 'Zümre Yönetimi',
        items: [
          { s: 'Zümre toplantı kararlarını nereye girebilirim?', c: 'Profil → Dosyam → Zümre Toplantıları bölümüne girin ve "Yeni Toplantı" ekleyin.' },
          { s: 'Ortak sınav sonuçlarını nasıl girerim?', c: 'Not Defteri menüsünden ilgili sınıf ve sınav sütununu seçin. Tüm notları girdikten sonra müdür dashboardunda ortalama grafiği otomatik güncellenir.' },
          { s: 'Zümre öğretmenlerine nasıl duyuru gönderim?', c: '"Zümre Bildirimi" menüsünden mesaj yazın. Alıcılar uygulamaya girince tam ekran bildirim olarak görür.' },
        ],
      },
    ],
  },
  {
    id: 'my',
    label: 'Müdür Yardımcısı',
    color: 'bg-indigo-600',
    groups: [
      {
        title: 'Kullanıcı Yönetimi',
        items: [
          { s: 'Öğretmen nasıl davet ederim?', c: '"Kullanıcılar" menüsü → "Kullanıcı Davet Et" → e-posta girin veya davet linkini kopyalayın.' },
          { s: 'Rol nasıl değiştiririm?', c: 'Kullanıcılar listesinde ilgili kişinin yanındaki rol seçicisinden değiştirin. Değişiklik anında geçerlidir.' },
        ],
      },
      {
        title: 'Sınıf ve Öğrenci',
        items: [
          { s: 'Toplu öğrenci yüklemesi nasıl yapılır?', c: 'Sınıf sayfasında "Toplu Yükle" → CSV dosyası seçin (sütunlar: full_name, student_number, veli_email).' },
          { s: 'Silinen sınıfı geri getirebilir miyim?', c: 'Yönetim → Silinen Kayıtlar sayfasından son 90 gün içindeki silinen sınıf, öğrenci ve ödevleri geri yükleyebilirsiniz.' },
        ],
      },
      {
        title: 'Raporlar',
        items: [
          { s: 'Excel raporu nasıl alırım?', c: '"Raporlar" menüsüne girin, sınıf seçin ve "Excel İndir" butonuna tıklayın.' },
        ],
      },
    ],
  },
  {
    id: 'mudur',
    label: 'Müdür',
    color: 'bg-purple-600',
    groups: [
      {
        title: 'Dashboard',
        items: [
          { s: 'Hangi öğretmenler sisteme giriş yapmıyor?', c: 'Anasayfa → Öğretmen Aktivitesi bölümü son giriş tarihlerini gösterir. 14+ gün giriş yapmayan öğretmenler sarı/kırmızı ile işaretlenir.' },
          { s: 'Sınav ortalamaları grafiğinde renkler ne anlama geliyor?', c: 'İndigo (mor) = 70+ puan başarılı, Amber (sarı) = 50–70 puan orta, Kırmızı = 50 puan altı. 50 puan referans çizgisi grafikte gösterilir.' },
        ],
      },
      {
        title: 'Duyurular',
        items: [
          { s: 'Tüm öğretmenlere duyuru nasıl gönderim?', c: '"Duyurular" menüsü → "Yeni Duyuru" → hedef kitle olarak tüm öğretmenleri veya belirli bir rolü seçin.' },
          { s: 'Öğretmenler duyuruyu görmek zorunda mı?', c: 'Evet. Kullanıcılar uygulamaya girdiklerinde okunmamış duyuruyu tam ekran görür ve onaylamadan başka sayfaya geçemez.' },
        ],
      },
    ],
  },
]

function Accordion({ items }: { items: Item[] }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <div key={i} className="border border-gray-100 dark:border-slate-700 rounded-lg overflow-hidden">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <span className="text-sm font-medium text-gray-800 dark:text-slate-200">{item.s}</span>
            <svg
              className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {open === i && (
            <div className="px-4 py-3 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-slate-700">
              <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">{item.c}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function YardimClient({ defaultTab }: { defaultTab: string }) {
  const [activeTab, setActiveTab] = useState(defaultTab)
  const tab = TABS.find(t => t.id === activeTab)!

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Yardım Merkezi</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Sık sorulan sorular ve kullanım rehberi</p>
        </div>
        <Link
          href="/klavuz"
          className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          PDF Kılavuzu
        </Link>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === t.id
                ? `${t.color} text-white shadow-sm`
                : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {tab.groups.map(group => (
          <section key={group.title}>
            <h2 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              <span className="w-4 h-px bg-gray-300 dark:bg-slate-600" />
              {group.title}
            </h2>
            <Accordion items={group.items} />
          </section>
        ))}
      </div>

      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-slate-700 text-center">
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Aradığınızı bulamadınız mı?{' '}
          <Link href="/klavuz" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
            Tam kılavuzu inceleyin
          </Link>
        </p>
      </div>
    </div>
  )
}
