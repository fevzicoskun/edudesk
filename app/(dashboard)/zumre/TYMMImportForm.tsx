'use client'

import { useActionState, useState } from 'react'
import { importFromTYMM } from '@/app/actions/zumre'

const TYMM_DATA: Record<string, Record<number, string[]>> = {
  Matematik: {
    9: [
      'Sayılar ve Cebirsel İfadeler: Doğal, Tam ve Rasyonel Sayılar',
      'Gerçek Sayılar ve Mutlak Değer',
      'Oran, Orantı ve Yüzde',
      'Birinci Dereceden Denklemler ve Eşitsizlikler',
      'Cebirsel İfadeler ve Özdeşlikler',
      'Nicelikler ve Değişimler: Fonksiyon Kavramına Giriş',
      'Algoritma ve Bilişim: Akış Şemaları ve Algoritmik Düşünce',
      'Geometrik Şekiller: Açılar ve Üçgenler',
      'Dörtgenler ve Çokgenler',
      'Eşlik ve Benzerlik',
      'Dönüşüm Geometrisi',
      'İstatistiksel Araştırma Süreci',
      'Veriden Olasılığa',
    ],
    10: [
      'Bölünebilme, EBOB ve EKOK',
      'Üslü İfadeler ve Köklü İfadeler',
      'Birinci ve İkinci Dereceden Denklemler',
      'Eşitsizlikler ve Eşitsizlik Sistemleri',
      'Fonksiyonlar ve Temel Fonksiyon Türleri',
      'Sayma Yöntemleri: Permütasyon ve Kombinasyon',
      'Trigonometri: Dik Üçgenlerde Trigonometrik Oranlar',
      'Analitik Geometri: Doğrunun Analitik İncelenmesi',
      'Veri Analizi: Merkezi Eğilim Ölçüleri',
      'Olasılık: Temel Kavramlar',
    ],
    11: [
      'Trigonometri: Genel Açıların Trigonometrisi',
      'Toplam, Fark ve Kat Formülleri',
      'Üstel Fonksiyonlar',
      'Logaritma ve Logaritmik Fonksiyonlar',
      'Dörtgenler: Paralelkenar, Dikdörtgen, Eşkenar Dörtgen',
      'Özel Dörtgenler ve Çokgenler',
      'Veri Analizi: Dağılım Ölçüleri',
    ],
    12: [
      'Diziler: Aritmetik ve Geometrik Diziler',
      'Sonsuz Geometrik Dizi ve Seriler',
      'Polinomlar: Tanım ve İşlemler',
      'Limit ve Süreklilik',
      'Türev: Tanım ve Kuralları',
      'Türevin Uygulamaları: Grafik Çizimi ve Optimizasyon',
      'Çember ve Dairenin Analitik İncelenmesi',
      'Veri Bilim Uygulamaları',
    ],
  },
  Fizik: {
    9: [
      'Fizik Bilimine Giriş: Ölçme ve Birimler',
      'Madde ve Özellikleri',
      'Doğrusal Hareket: Konum, Hız, İvme',
      "Newton'un Hareket Yasaları",
      'İş, Güç ve Enerji',
      'Isı ve Sıcaklık',
      'Elektrik Yükü ve Elektriklenme',
      'Sıvılarda ve Gazlarda Basınç',
    ],
    10: [
      'Elektrik Alan ve Elektriksel Potansiyel',
      'Elektrik Akımı ve Devre Elemanları',
      'Manyetik Alan ve Manyetik Kuvvet',
      'Elektromanyetik İndüksiyon',
      'Dalgalar: Özellikleri ve Çeşitleri',
      'Ses Dalgaları',
      'Işık ve Optik: Yansıma ve Kırılma',
      'Çembersel Hareket ve Yerçekimi',
    ],
    11: [
      'Elektrik Devrelerinde Güç ve Enerji',
      'Alternatif Akım',
      'Atom Modelleri ve Spektrum',
      'Fotoelektrik Olay ve Dalga-Parçacık İkilemi',
      'Dalga Optiği: Girişim ve Kırınım',
    ],
    12: [
      'Basit Harmonik Hareket',
      'Çekirdek Fiziği: Radyoaktivite',
      'Bağıl Hareket ve Özel Görelilik Giriş',
      'Modern Fiziğin Günümüz Uygulamaları',
    ],
  },
  Kimya: {
    9: [
      'Kimyanın Temel Kavramları: Madde, Element, Bileşik',
      'Atom Yapısı ve Periyodik Sistem',
      'Kimyasal Bağlar: İyonik, Kovalent, Metalik',
      'Kimyasal Tepkimeler: Denklemler ve Türleri',
      'Mol Kavramı ve Hesaplamalar',
      'Çözeltiler: Çözünürlük ve Derişim',
      'Asitler ve Bazlar: Temel Kavramlar',
    ],
    10: [
      'Karbon Kimyasına Giriş: Organik Bileşikler',
      'Hidrokarbonlar: Alkanlar, Alkenler, Alkinler',
      'Organik Reaksiyonlar',
      'Fonksiyonel Gruplar: Alkoller, Eterler, Aldehitler',
      'Kimyasal Denge',
      'Asit-Baz Dengesi ve pH',
      'Çözünürlük Dengesi',
    ],
    11: [
      'Elektrokimya: Galvanik Hücreler',
      'Elektroliz ve Uygulamaları',
      'Kimyasal Kinetik: Tepkime Hızı',
      'Karboksilik Asitler, Esterler ve Türevleri',
      'Karbonhidratlar, Yağlar, Proteinler',
    ],
    12: [
      'Nükleer Kimya ve Radyoaktivite',
      'Polimer Kimyası',
      'Çevre Kimyası: Hava ve Su Kirliliği',
      'Güncel Kimya Uygulamaları',
    ],
  },
  Biyoloji: {
    9: [
      'Yaşam Bilimi Biyoloji',
      'Hücre: Yapısı ve Organeller',
      'Hücre Zarından Madde Geçişi',
      'Canlıların Sınıflandırılması',
      'Canlılar Arası İlişkiler',
      'Ekosistemler ve Çevre',
      'Biyoçeşitlilik ve Koruma',
    ],
    10: [
      'Hücre Bölünmesi: Mitoz',
      'Hücre Bölünmesi: Mayoz',
      'Kalıtım: Mendel Kalıtımı',
      'DNA ve RNA: Yapı ve İşlev',
      'Protein Sentezi',
      'Mutasyon ve Modifikasyon',
      'Sindirim Sistemi',
      'Dolaşım Sistemi',
    ],
    11: [
      'Solunum Sistemi',
      'Boşaltım Sistemi',
      'Destek ve Hareket Sistemi',
      'Sinir Sistemi',
      'Endokrin Sistem',
      'Üreme Sistemi ve Embriyoloji',
      'Bağışıklık Sistemi',
    ],
    12: [
      'Evrim: Kavram ve Kanıtlar',
      'Popülasyon Genetiği',
      'Ekosistem Ekolojisi',
      'Biyoteknoloji ve Gen Mühendisliği',
      'İnsan Sağlığı ve Güncel Biyoloji',
    ],
  },
  'Türk Dili ve Edebiyatı': {
    9: [
      "Türkçenin Tarihi Gelişimi",
      'Ses ve Şekil Bilgisi',
      'Cümle Bilgisi: Temel Kavramlar',
      'Metinlerin Sınıflandırılması',
      'Şiir: Nazım Biçimleri ve Türleri',
      'Anlatı Metinleri: Hikâye',
      'Divan Edebiyatına Giriş',
      'Sözlü Edebiyat: Destan ve Halk Şiiri',
    ],
    10: [
      'Divan Edebiyatı: Özellikleri ve Temsilcileri',
      'Halk Edebiyatı: Âşık Tarzı',
      'Tanzimat Dönemi Edebiyatı',
      'Roman ve Hikâye: Türk Edebiyatında Gelişim',
      'Tiyatro Metinleri',
      'Öğretici Metinler: Makale, Deneme',
    ],
    11: [
      'Servet-i Fünun Edebiyatı',
      'Millî Edebiyat Dönemi',
      'Cumhuriyet Dönemi Türk Edebiyatı',
      'Modern Şiir',
      'Cumhuriyet Dönemi Romanı',
    ],
    12: [
      '1980 Sonrası Türk Edebiyatı',
      'Postmodern Anlatı',
      'Günümüz Şiiri',
      'Medya ve Dil',
      'Yazılı Anlatım: Kompozisyon',
    ],
  },
  Tarih: {
    9: [
      'Tarih Bilimi: Kavram, Yöntem, Kaynaklar',
      'Tarih Öncesi Çağlar ve İlk Uygarlıklar',
      'İlk Türk Devletleri: Hunlar, Göktürkler, Uygurlar',
      "İslamiyet'in Doğuşu ve Yayılması",
      "Türklerin İslamiyet'i Kabulü",
      'Büyük Selçuklu Devleti',
      "Anadolu'da Türk Döneminin Başlaması",
    ],
    10: [
      "Osmanlı Devleti'nin Kuruluşu",
      "Osmanlı'da Klasik Dönem (14-16. Yüzyıl)",
      'Coğrafi Keşifler ve Etkileri',
      "Osmanlı'da Gerileme Süreci",
      'Sanayi Devrimi ve Etkileri',
      'Fransız İhtilali ve Milliyetçilik',
    ],
    11: [
      "Osmanlı'nın Son Dönemi: Tanzimat ve Meşrutiyet",
      'I. Dünya Savaşı',
      "Kurtuluş Savaşı'nın Hazırlık Dönemi",
      'Millî Mücadele',
      'Lozan Antlaşması',
      "Türkiye Cumhuriyeti'nin İlanı",
      "Atatürk Dönemi İnkılapları",
    ],
    12: [
      "Atatürk'ün Dış Politikası",
      'II. Dünya Savaşı',
      'Soğuk Savaş Dönemi',
      "Türkiye'de Çok Partili Hayat",
      "Türkiye'nin Dış Politikası",
      'Günümüz Dünya Sorunları',
    ],
  },
  Coğrafya: {
    9: [
      'Coğrafi Bilgi Sistemleri ve Harita Okuması',
      "Yer'in Şekli ve Hareketleri",
      'İklim Elemanları: Sıcaklık, Basınç, Yağış',
      'İklim Tipleri ve Dağılışı',
      'Litosfer: Yer Kabuğu Hareketleri',
      'Akarsular ve Göller',
      'Toprak ve Bitki Örtüsü',
    ],
    10: [
      "Türkiye'nin Fiziki Coğrafyası",
      "Türkiye'nin İklimi",
      "Türkiye'nin Beşeri Coğrafyası: Nüfus",
      "Türkiye'nin Ekonomik Coğrafyası: Tarım",
      "Türkiye'de Sanayi ve Enerji",
      "Türkiye'de Ulaşım ve Ticaret",
      "Türkiye'nin Bölgeleri",
    ],
    11: [
      "Dünya'da Nüfus: Dağılış ve Göç",
      'Şehirleşme ve Kentsel Sorunlar',
      'Ekonomik Faaliyetler: Tarım, Sanayi, Hizmet',
      'Enerji Kaynakları ve Politikaları',
      'Çevre Sorunları ve Sürdürülebilirlik',
    ],
    12: [
      'Doğal Afetler ve Risk Yönetimi',
      'Küresel Ortam Sorunları',
      'Bölgeler Arası Dengesizlikler',
      'Siyasi Coğrafya: Sınırlar ve Çatışmalar',
      "Türkiye'nin Jeopolitik Konumu",
    ],
  },
  İngilizce: {
    9: [
      'Introducing Yourself and Others',
      'Daily Routines and Simple Present Tense',
      'Describing People and Places',
      'Past Simple Tense: Narrating Events',
      'Hobbies and Free Time Activities',
      'Future Plans: Going to / Will',
      'Comparatives and Superlatives',
      'Health and Body',
    ],
    10: [
      'Present Perfect Tense: Experiences',
      'Modal Verbs: Ability, Permission, Obligation',
      'Environmental Issues and Sustainability',
      'Passive Voice',
      'Conditionals: Zero and First',
      'Technology and Digital Life',
    ],
    11: [
      'Second and Third Conditionals',
      'Reported Speech',
      'Relative Clauses',
      'Academic Writing: Essay Structure',
      'Science and Innovation',
      'Globalization and Culture',
    ],
    12: [
      'Discourse Markers and Text Cohesion',
      'Advanced Reading Comprehension',
      'Academic Vocabulary',
      'Presentations and Public Speaking',
      'University and Career Preparation',
    ],
  },
}

const SUBJECTS = Object.keys(TYMM_DATA)

type ImportState = { imported?: number; error?: string } | null

export default function TYMMImportForm({
  classes,
}: {
  classes: { id: string; name: string; grade: number }[]
}) {
  const [state, action, pending] = useActionState(importFromTYMM, null)
  const [subject, setSubject] = useState('')
  const [gradeId, setGradeId] = useState('')

  const selectedGrade = classes.find((c) => c.id === gradeId)?.grade
  const preview = subject && selectedGrade ? (TYMM_DATA[subject]?.[selectedGrade] ?? []) : []

  return (
    <div className="bg-white dark:bg-slate-800 border border-blue-100 dark:border-blue-900/40 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full bg-blue-500" />
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">
          TYMM Şablonundan Yükle
        </h2>
      </div>
      <p className="text-xs text-gray-400 dark:text-slate-500 mb-4 ml-4">
        Türkiye Yüzyılı Maarif Modeli müfredatından hazır konuları içe aktarın
      </p>

      <form action={action} className="space-y-3">
        <select
          name="subject"
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Ders seçin</option>
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          name="class_id"
          required
          value={gradeId}
          onChange={(e) => setGradeId(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Sınıf seçin (9-12)</option>
          {[9, 10, 11, 12].map((g) => {
            const gc = classes.filter((c) => c.grade === g)
            if (!gc.length) return null
            return (
              <optgroup key={g} label={`${g}. Sınıf`}>
                {gc.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </optgroup>
            )
          })}
        </select>

        {preview.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 rounded-lg p-3">
            <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-2">
              {preview.length} konu yüklenecek:
            </p>
            <ul className="space-y-0.5">
              {preview.map((t, i) => (
                <li key={i} className="text-xs text-blue-600 dark:text-blue-400 flex gap-1.5">
                  <span className="shrink-0 text-blue-400">·</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(!subject || !selectedGrade) && preview.length === 0 && subject && selectedGrade && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Bu ders ve sınıf için TYMM verisi bulunamadı.
          </p>
        )}

        <button
          type="submit"
          disabled={pending || preview.length === 0}
          className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? 'Yükleniyor...' : `${preview.length > 0 ? `${preview.length} Konuyu` : 'Konuları'} Müfredatıma Ekle`}
        </button>

        {state?.imported != null && (
          <p className="text-sm text-green-600 dark:text-green-400 font-medium text-center">
            ✓ {state.imported} konu eklendi
          </p>
        )}
        {state?.error && (
          <p className="text-sm text-red-600 dark:text-red-400 text-center">{state.error}</p>
        )}
      </form>
    </div>
  )
}
