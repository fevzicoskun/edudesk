'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

type CurriculumStatus = 'tamamlandi' | 'tekrar_gerekli' | 'eksik_kaldi'

export async function createMeeting(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('zumre_meetings').insert({
    title: formData.get('title') as string,
    meeting_date: formData.get('meeting_date') as string,
    notes: (formData.get('notes') as string) || null,
    created_by: user.id,
  })

  revalidatePath('/zumre')
}

export async function createExam(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('common_exams').insert({
    title: formData.get('title') as string,
    subject: formData.get('subject') as string,
    exam_date: formData.get('exam_date') as string,
    created_by: user.id,
  })

  revalidatePath('/zumre')
}

export async function createCurriculumProgress(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const class_id = formData.get('class_id') as string
  if (!class_id) redirect('/zumre?tab=mufredat&error=sinif')

  await supabase.from('curriculum_progress').insert({
    teacher_id: user.id,
    class_id,
    topic: formData.get('topic') as string,
    week_number: formData.get('week_number') ? Number(formData.get('week_number')) : null,
    status: (formData.get('status') as CurriculumStatus) || 'tamamlandi',
    completed: formData.get('status') !== 'eksik_kaldi',
    completion_date:
      formData.get('status') === 'tamamlandi' ? new Date().toISOString().split('T')[0] : null,
  })

  revalidatePath('/zumre')
}

export async function updateCurriculumStatus(id: string, status: CurriculumStatus, _: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase
    .from('curriculum_progress')
    .update({
      status,
      completed: status !== 'eksik_kaldi',
      completion_date: status === 'tamamlandi' ? new Date().toISOString().split('T')[0] : null,
    })
    .eq('id', id)
    .eq('teacher_id', user.id)

  revalidatePath('/zumre')
}

export async function toggleCurriculumDone(id: string, completed: boolean, _: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase
    .from('curriculum_progress')
    .update({ completed, completion_date: completed ? new Date().toISOString().split('T')[0] : null })
    .eq('id', id)
    .eq('teacher_id', user.id)

  revalidatePath('/zumre')
}

export async function deleteMeeting(id: string, _: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('zumre_meetings').delete().eq('id', id)

  revalidatePath('/zumre')
}

export async function deleteExam(id: string, _: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('common_exams').delete().eq('id', id)

  revalidatePath('/zumre')
}

export async function deleteCurriculumProgress(id: string, _: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('curriculum_progress').delete().eq('id', id).eq('teacher_id', user.id)

  revalidatePath('/zumre')
}

type ImportState = { imported?: number; error?: string } | null

const TYMM_TOPICS: Record<string, Record<number, string[]>> = {
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
    9: ['Fizik Bilimine Giriş: Ölçme ve Birimler', 'Madde ve Özellikleri', 'Doğrusal Hareket: Konum, Hız, İvme', "Newton'un Hareket Yasaları", 'İş, Güç ve Enerji', 'Isı ve Sıcaklık', 'Elektrik Yükü ve Elektriklenme', 'Sıvılarda ve Gazlarda Basınç'],
    10: ['Elektrik Alan ve Elektriksel Potansiyel', 'Elektrik Akımı ve Devre Elemanları', 'Manyetik Alan ve Manyetik Kuvvet', 'Elektromanyetik İndüksiyon', 'Dalgalar: Özellikleri ve Çeşitleri', 'Ses Dalgaları', 'Işık ve Optik: Yansıma ve Kırılma', 'Çembersel Hareket ve Yerçekimi'],
    11: ['Elektrik Devrelerinde Güç ve Enerji', 'Alternatif Akım', 'Atom Modelleri ve Spektrum', 'Fotoelektrik Olay ve Dalga-Parçacık İkilemi', 'Dalga Optiği: Girişim ve Kırınım'],
    12: ['Basit Harmonik Hareket', 'Çekirdek Fiziği: Radyoaktivite', 'Bağıl Hareket ve Özel Görelilik Giriş', 'Modern Fiziğin Günümüz Uygulamaları'],
  },
  Kimya: {
    9: ['Kimyanın Temel Kavramları: Madde, Element, Bileşik', 'Atom Yapısı ve Periyodik Sistem', 'Kimyasal Bağlar: İyonik, Kovalent, Metalik', 'Kimyasal Tepkimeler: Denklemler ve Türleri', 'Mol Kavramı ve Hesaplamalar', 'Çözeltiler: Çözünürlük ve Derişim', 'Asitler ve Bazlar: Temel Kavramlar'],
    10: ['Karbon Kimyasına Giriş: Organik Bileşikler', 'Hidrokarbonlar: Alkanlar, Alkenler, Alkinler', 'Organik Reaksiyonlar', 'Fonksiyonel Gruplar: Alkoller, Eterler, Aldehitler', 'Kimyasal Denge', 'Asit-Baz Dengesi ve pH', 'Çözünürlük Dengesi'],
    11: ['Elektrokimya: Galvanik Hücreler', 'Elektroliz ve Uygulamaları', 'Kimyasal Kinetik: Tepkime Hızı', 'Karboksilik Asitler, Esterler ve Türevleri', 'Karbonhidratlar, Yağlar, Proteinler'],
    12: ['Nükleer Kimya ve Radyoaktivite', 'Polimer Kimyası', 'Çevre Kimyası: Hava ve Su Kirliliği', 'Güncel Kimya Uygulamaları'],
  },
  Biyoloji: {
    9: ['Yaşam Bilimi Biyoloji', 'Hücre: Yapısı ve Organeller', 'Hücre Zarından Madde Geçişi', 'Canlıların Sınıflandırılması', 'Canlılar Arası İlişkiler', 'Ekosistemler ve Çevre', 'Biyoçeşitlilik ve Koruma'],
    10: ['Hücre Bölünmesi: Mitoz', 'Hücre Bölünmesi: Mayoz', 'Kalıtım: Mendel Kalıtımı', 'DNA ve RNA: Yapı ve İşlev', 'Protein Sentezi', 'Mutasyon ve Modifikasyon', 'Sindirim Sistemi', 'Dolaşım Sistemi'],
    11: ['Solunum Sistemi', 'Boşaltım Sistemi', 'Destek ve Hareket Sistemi', 'Sinir Sistemi', 'Endokrin Sistem', 'Üreme Sistemi ve Embriyoloji', 'Bağışıklık Sistemi'],
    12: ['Evrim: Kavram ve Kanıtlar', 'Popülasyon Genetiği', 'Ekosistem Ekolojisi', 'Biyoteknoloji ve Gen Mühendisliği', 'İnsan Sağlığı ve Güncel Biyoloji'],
  },
  'Türk Dili ve Edebiyatı': {
    9: ["Türkçenin Tarihi Gelişimi", 'Ses ve Şekil Bilgisi', 'Cümle Bilgisi: Temel Kavramlar', 'Metinlerin Sınıflandırılması', 'Şiir: Nazım Biçimleri ve Türleri', 'Anlatı Metinleri: Hikâye', 'Divan Edebiyatına Giriş', 'Sözlü Edebiyat: Destan ve Halk Şiiri'],
    10: ['Divan Edebiyatı: Özellikleri ve Temsilcileri', 'Halk Edebiyatı: Âşık Tarzı', 'Tanzimat Dönemi Edebiyatı', 'Roman ve Hikâye: Türk Edebiyatında Gelişim', 'Tiyatro Metinleri', 'Öğretici Metinler: Makale, Deneme'],
    11: ['Servet-i Fünun Edebiyatı', 'Millî Edebiyat Dönemi', 'Cumhuriyet Dönemi Türk Edebiyatı', 'Modern Şiir', 'Cumhuriyet Dönemi Romanı'],
    12: ['1980 Sonrası Türk Edebiyatı', 'Postmodern Anlatı', 'Günümüz Şiiri', 'Medya ve Dil', 'Yazılı Anlatım: Kompozisyon'],
  },
  Tarih: {
    9: ['Tarih Bilimi: Kavram, Yöntem, Kaynaklar', 'Tarih Öncesi Çağlar ve İlk Uygarlıklar', 'İlk Türk Devletleri: Hunlar, Göktürkler, Uygurlar', "İslamiyet'in Doğuşu ve Yayılması", "Türklerin İslamiyet'i Kabulü", 'Büyük Selçuklu Devleti', "Anadolu'da Türk Döneminin Başlaması"],
    10: ["Osmanlı Devleti'nin Kuruluşu", "Osmanlı'da Klasik Dönem (14-16. Yüzyıl)", 'Coğrafi Keşifler ve Etkileri', "Osmanlı'da Gerileme Süreci", 'Sanayi Devrimi ve Etkileri', 'Fransız İhtilali ve Milliyetçilik'],
    11: ["Osmanlı'nın Son Dönemi: Tanzimat ve Meşrutiyet", 'I. Dünya Savaşı', "Kurtuluş Savaşı'nın Hazırlık Dönemi", 'Millî Mücadele', 'Lozan Antlaşması', "Türkiye Cumhuriyeti'nin İlanı", "Atatürk Dönemi İnkılapları"],
    12: ["Atatürk'ün Dış Politikası", 'II. Dünya Savaşı', 'Soğuk Savaş Dönemi', "Türkiye'de Çok Partili Hayat", "Türkiye'nin Dış Politikası", 'Günümüz Dünya Sorunları'],
  },
  Coğrafya: {
    9: ['Coğrafi Bilgi Sistemleri ve Harita Okuması', "Yer'in Şekli ve Hareketleri", 'İklim Elemanları: Sıcaklık, Basınç, Yağış', 'İklim Tipleri ve Dağılışı', 'Litosfer: Yer Kabuğu Hareketleri', 'Akarsular ve Göller', 'Toprak ve Bitki Örtüsü'],
    10: ["Türkiye'nin Fiziki Coğrafyası", "Türkiye'nin İklimi", "Türkiye'nin Beşeri Coğrafyası: Nüfus", "Türkiye'nin Ekonomik Coğrafyası: Tarım", "Türkiye'de Sanayi ve Enerji", "Türkiye'de Ulaşım ve Ticaret", "Türkiye'nin Bölgeleri"],
    11: ["Dünya'da Nüfus: Dağılış ve Göç", 'Şehirleşme ve Kentsel Sorunlar', 'Ekonomik Faaliyetler: Tarım, Sanayi, Hizmet', 'Enerji Kaynakları ve Politikaları', 'Çevre Sorunları ve Sürdürülebilirlik'],
    12: ['Doğal Afetler ve Risk Yönetimi', 'Küresel Ortam Sorunları', 'Bölgeler Arası Dengesizlikler', 'Siyasi Coğrafya: Sınırlar ve Çatışmalar', "Türkiye'nin Jeopolitik Konumu"],
  },
  İngilizce: {
    9: ['Introducing Yourself and Others', 'Daily Routines and Simple Present Tense', 'Describing People and Places', 'Past Simple Tense: Narrating Events', 'Hobbies and Free Time Activities', 'Future Plans: Going to / Will', 'Comparatives and Superlatives', 'Health and Body'],
    10: ['Present Perfect Tense: Experiences', 'Modal Verbs: Ability, Permission, Obligation', 'Environmental Issues and Sustainability', 'Passive Voice', 'Conditionals: Zero and First', 'Technology and Digital Life'],
    11: ['Second and Third Conditionals', 'Reported Speech', 'Relative Clauses', 'Academic Writing: Essay Structure', 'Science and Innovation', 'Globalization and Culture'],
    12: ['Discourse Markers and Text Cohesion', 'Advanced Reading Comprehension', 'Academic Vocabulary', 'Presentations and Public Speaking', 'University and Career Preparation'],
  },
}

export async function importFromTYMM(
  _prev: ImportState,
  formData: FormData
): Promise<ImportState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Giriş gerekli' }

  const subject = formData.get('subject') as string
  const class_id = formData.get('class_id') as string

  if (!subject) return { error: 'Ders seçilmedi' }
  if (!class_id) return { error: 'Sınıf seçilmedi' }

  const { data: cls } = await supabase.from('classes').select('grade').eq('id', class_id).single()
  if (!cls) return { error: 'Sınıf bulunamadı' }

  const topics = TYMM_TOPICS[subject]?.[cls.grade]
  if (!topics || topics.length === 0) return { error: 'Bu ders/sınıf için TYMM verisi bulunamadı' }

  const rows = topics.map((topic, i) => ({
    teacher_id: user.id,
    class_id,
    topic,
    week_number: i + 1,
    status: 'tamamlandi' as const,
    completed: true,
    completion_date: null,
  }))

  const { error } = await supabase.from('curriculum_progress').insert(rows)
  if (error) return { error: error.message }

  revalidatePath('/zumre')
  return { imported: rows.length }
}

function parseExcel(buffer: Buffer): { topic: string; week_number: number | null }[] {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
  if (rows.length === 0) return []

  const headers = Object.keys(rows[0])
  const topicCol =
    headers.find(h => /kazanım ifadesi|kazanim ifadesi/i.test(h)) ??
    headers.find(h => /kazanım|kazanim|konu|öğrenme çıktısı|hedef|içerik/i.test(h)) ??
    headers[0]
  const weekCol = headers.find(h => /hafta|süre|sure|ders saati|saat/i.test(h))

  return rows
    .map(row => ({
      topic: String(row[topicCol] ?? '').trim(),
      week_number: weekCol ? (Number(row[weekCol]) || null) : null,
    }))
    .filter(r => r.topic.length > 3)
}

export async function importCurriculumFromFile(
  _prev: ImportState,
  formData: FormData
): Promise<ImportState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Giriş gerekli' }

  const file = formData.get('file') as File | null
  const grade = Number(formData.get('grade'))

  if (!file || file.size === 0) return { error: 'Dosya seçilmedi' }
  if (!grade) return { error: 'Sınıf seviyesi seçilmedi' }

  const { data: cls } = await supabase
    .from('classes')
    .select('id')
    .eq('grade', grade)
    .order('name')
    .limit(1)
    .single()
  if (!cls) return { error: `${grade}. sınıf için kayıt bulunamadı` }

  const classId = cls.id

  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) return { error: 'PDF desteklenmiyor — Excel (.xlsx) kullanın' }

  const buffer = Buffer.from(await file.arrayBuffer())

  let topics: { topic: string; week_number: number | null }[] = []

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    topics = parseExcel(buffer)
  } else {
    return { error: 'Sadece .xlsx veya .xls desteklenir' }
  }

  if (topics.length === 0) return { error: 'Dosyadan konu çıkarılamadı' }

  const rows = topics.map(t => ({
    teacher_id: user.id,
    class_id: classId,
    topic: t.topic,
    week_number: t.week_number,
    status: 'tamamlandi' as const,
    completed: true,
    completion_date: null,
  }))

  const { error } = await supabase.from('curriculum_progress').insert(rows)
  if (error) return { error: error.message }

  revalidatePath('/zumre')
  return { imported: rows.length }
}
