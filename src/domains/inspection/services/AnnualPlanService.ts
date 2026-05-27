// src/domains/inspection/services/AnnualPlanService.ts
import type { WeeklyEntry } from '../types'
import { InspectionRepository } from '../repositories/InspectionRepository'
import { getAbility } from '@/src/shared/authorization/server'

// MEB matematik müfredatı — sınıf seviyesine göre konu listesi
const CURRICULUM: Record<number, string[]> = {
  9: [
    'Kümeler', 'Doğal Sayılar', 'Bölünebilme Kuralları', 'EBOB-EKOK',
    'Tam Sayılar', 'Rasyonel Sayılar', 'Gerçek Sayılar', 'Üslü Sayılar',
    'Köklü Sayılar', 'Çarpanlara Ayırma', 'Oran-Orantı', 'Denklemler',
    'Eşitsizlikler', 'Mutlak Değer', 'Koordinat Sistemi', 'Doğrusal Fonksiyonlar',
    'Üçgenler', 'Özel Üçgenler', 'Çokgenler', 'Çember ve Daire',
    'Permütasyon', 'Kombinasyon', 'Olasılık', 'Veri Analizi',
    'Ortalama-Medyan-Mod', 'Standart Sapma', 'Trigonometriye Giriş',
    'Sinüs-Kosinüs-Tanjant', 'Trigonometrik Denklemler', 'Doğrunun Analitik İncelenmesi',
    'Çemberin Analitik İncelenmesi', 'Logaritma', 'Üstel Fonksiyonlar',
    'Logaritmik Fonksiyonlar', 'Dönem Sonu Tekrar', 'Değerlendirme ve Sınav Hazırlık',
  ],
  10: [
    'Polinomlar', 'Polinom Bölmesi', 'Çarpanlara Ayırma', 'Rasyonel İfadeler',
    'İkinci Dereceden Denklemler', 'Parabol', 'İkinci Dereceden Eşitsizlikler',
    'Fonksiyonlar', 'Bileşke Fonksiyon', 'Ters Fonksiyon', 'Trigonometrik Fonksiyonlar',
    'Trigonometrik Dönüşümler', 'Sinüs Teoremi', 'Kosinüs Teoremi',
    'Çember', 'Daire', 'Çember-Doğru İlişkisi', 'Üçgenlerde Alan',
    'Vektörler', 'Vektörel İşlemler', 'Analitik Geometri',
    'Noktanın Doğruya Uzaklığı', 'İki Doğrunun Kesişimi', 'Permütasyon',
    'Kombinasyon', 'Binom Açılımı', 'Olasılık', 'Koşullu Olasılık',
    'İstatistik', 'Normal Dağılım', 'Karmaşık Sayılar', 'Karmaşık Sayılarda İşlemler',
    'Modüler Aritmetik', 'Diziler', 'Dönem Sonu Tekrar', 'Değerlendirme',
  ],
  11: [
    'Diziler ve Seriler', 'Aritmetik Dizi', 'Geometrik Dizi', 'Sonsuz Seri',
    'Limit Kavramı', 'Fonksiyonlarda Limit', 'Süreklilik', 'Türevin Tanımı',
    'Türev Alma Kuralları', 'Bileşke Fonksiyonun Türevi', 'Üstel-Logaritmik Türev',
    'Trigonometrik Türev', 'Uygulamalar: Teğet-Normal', 'Monotonluk',
    'Ekstremum Noktaları', 'Grafik Çizimi', 'Optimizasyon', 'İntegrale Giriş',
    'Belirsiz İntegral', 'İntegral Alma Kuralları', 'Parça Parça İntegrasyon',
    'Değişken Değiştirme', 'Belirli İntegral', 'Alan Hesabı',
    'Hacim Hesabı', 'Trigonometrik İntegral', 'Diferansiyel Denklemler',
    'Matrisler', 'Determinant', 'Lineer Denklem Sistemleri',
    'Analitik Geometri — Elips', 'Analitik Geometri — Hiperbol', 'Analitik Geometri — Parabol',
    'Kompleks Analiz Giriş', 'Dönem Sonu Tekrar', 'Değerlendirme',
  ],
  12: [
    'YKS Analitik Geometri Tekrar', 'YKS Denklemler Tekrar', 'Türev Hızlı Tekrar',
    'İntegral Hızlı Tekrar', 'Kombinatorik Tekrar', 'Olasılık Tekrar',
    'YKS Soru Tipleri — Temel Matematik', 'YKS Soru Tipleri — Cebir',
    'YKS Soru Tipleri — Fonksiyon', 'YKS Soru Tipleri — Trigonometri',
    'YKS Soru Tipleri — Limit-Türev', 'YKS Soru Tipleri — İntegral',
    'YKS Deneme Analizi 1', 'Zayıf Konuların Tekrarı 1',
    'YKS Deneme Analizi 2', 'Zayıf Konuların Tekrarı 2',
    'YKS Deneme Analizi 3', 'Zayıf Konuların Tekrarı 3',
    'Tüm Konular Süpürme 1', 'Tüm Konular Süpürme 2',
    'Tüm Konular Süpürme 3', 'Son Hafta Sorular',
    'Karma Soru Çözümü', 'Hız-Doğruluk Egzersizleri',
    'TYT Matematik Deneme', 'AYT Matematik Deneme',
    'Hata Analizi', 'Motivasyon + Soru Stratejisi',
    'Son Tekrar 1', 'Son Tekrar 2', 'Son Tekrar 3', 'Son Tekrar 4',
    'Sınav Öncesi Hazırlık', 'YKS Haftası', 'Değerlendirme', 'Dönem Kapanış',
  ],
}

function getAcademicYearStart(academicYear: string): Date {
  const year = parseInt(academicYear.split('-')[0], 10)
  const sep15 = new Date(year, 8, 15) // Eylül = ay indeksi 8
  const day = sep15.getDay()
  const daysToMonday = day === 0 ? 1 : day === 1 ? 0 : 8 - day
  sep15.setDate(sep15.getDate() + daysToMonday)
  return sep15
}

function formatWeekDates(startDate: Date): string {
  const end = new Date(startDate)
  end.setDate(end.getDate() + 4)
  const fmt = (d: Date) =>
    `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}`
  return `${fmt(startDate)}–${fmt(end)}`
}

export const AnnualPlanService = {
  generateWeeklyPlan(grade: number, academicYear: string): WeeklyEntry[] {
    const topics = CURRICULUM[grade]
    if (!topics) throw new Error(`Desteklenmeyen sınıf seviyesi: ${grade}`)

    const start = getAcademicYearStart(academicYear)
    const TOTAL_WEEKS = 36

    return Array.from({ length: TOTAL_WEEKS }, (_, i) => {
      const weekStart = new Date(start)
      weekStart.setDate(weekStart.getDate() + i * 7)

      const topicIndex = Math.floor((i * topics.length) / TOTAL_WEEKS)
      const topicCount = Math.ceil(topics.length / TOTAL_WEEKS)
      const weekTopics = topics.slice(topicIndex, topicIndex + topicCount)

      return {
        week:       i + 1,
        dates:      formatWeekDates(weekStart),
        topics:     weekTopics.length > 0 ? weekTopics : [topics[topics.length - 1]],
        objectives: [],
      }
    })
  },

  async getOrCreate(grade: number, subject: string, academicYear: string) {
    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli' }

    const { data: existing } = await InspectionRepository.findAnnualPlan(
      ability.userId, academicYear, subject,
    )
    if (existing) return { data: existing }

    const weeklyPlan = AnnualPlanService.generateWeeklyPlan(grade, academicYear)
    const { data, error } = await InspectionRepository.upsertAnnualPlan({
      teacher_id:    ability.userId,
      school_id:     ability.schoolId,
      academic_year: academicYear,
      subject,
      weekly_plan:   weeklyPlan,
      approved_at:   null,
    })
    if (error) return { error: error.message }
    return { data }
  },
}
