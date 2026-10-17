// src/domains/mentor/takip/sablonlar.ts
// Sınıf şablonları (Normal seviye) + matematik konu listeleri. Okul yıllık planıyla karşılaştırılıp düzeltilebilir.
import type { Gorev, Birim } from './takipMath'

export const VARSAYILAN_DUZEN = '16.30–18.00 dinlenme · 18.00 ana çalışma · yemek · günün dersi · 21.00\'den sonra serbest'

type Tanim = [ad: string, miktar: number | null, birim: Birim, ders: string | null, soruSatiri: boolean]
const M = 'Matematik'

const SABLON_9_10 = {
  gunluk: [['Okul tekrarı', 15, 'dk', null, false], ['Matematik soru bankası', 60, 'dk', M, true], ['Paragraf', 15, 'soru', 'Türkçe', true]] as Tanim[],
  ek: [
    [['Matematik: yanlışların çözümü', 45, 'dk', M, false]],
    [['Fizik', 45, 'dk', 'Fizik', false]],
    [['Matematik: konu testi', 45, 'dk', M, true]],
    [['Kimya / Biyoloji', 45, 'dk', null, false]],
    [['İngilizce', 45, 'dk', 'İngilizce', false]],
    [['Matematik tarama testi', 90, 'dk', M, true], ['Edebiyat + Tarih/Coğrafya', 90, 'dk', null, false]],
    [['Matematik tekrarı', 60, 'dk', M, false], ['Haftalık genel tekrar', null, 'serbest', null, false]],
  ] as Tanim[][],
}
const SABLON_11_12 = {
  gunluk: [['Okul tekrarı', 15, 'dk', null, false], ['TYT Matematik', 45, 'dk', M, true], ['Paragraf', 20, 'soru', 'Türkçe', true]] as Tanim[],
  ek: [
    [['AYT Matematik', 60, 'dk', M, true]],
    [['Fizik / Edebiyat', 45, 'dk', null, false]],
    [['AYT Matematik', 60, 'dk', M, true]],
    [['Kimya / Biyoloji / Tarih-Coğrafya', 45, 'dk', null, false]],
    [['Matematik: yanlışların çözümü', 45, 'dk', M, false]],
    [['TYT denemesi', 165, 'dk', null, true], ['Deneme analizi', 45, 'dk', null, false]],
    [['AYT Matematik tekrarı', 90, 'dk', M, false], ['Haftalık genel tekrar', null, 'serbest', null, false]],
  ] as Tanim[][],
}

export function sinifSablonu(sinif: number): Gorev[] {
  const s = sinif >= 11 ? SABLON_11_12 : SABLON_9_10
  return Array.from({ length: 7 }, (_, gun) => [...(gun < 5 ? s.gunluk : []), ...s.ek[gun]])
    .flatMap((tanimlar, gun) => tanimlar.map(([ad, miktar, birim, ders, soruSatiri], i) => ({
      id: `s${gun}-${i}`, gun, ad, ders, miktar, birim, soruSatiri, konu: '', sayfa: '', yapti: false, soru: null, dogru: null,
      // Hafta içi günlük görevler (Pzt–Cum, listenin başı) tek "her gün" satırı olarak girilir
      ...(gun < 5 && i < s.gunluk.length && { grup: `h-s${i}` }),
    })))
}

const k = (grup: string, adlar: string) => adlar.split(' · ').map(ad => ({ grup, ad }))
export const MATEMATIK_KONULARI: Record<9 | 10 | 11 | 12, { grup: string; ad: string }[]> = {
  9: [
    ...k('Sayılar', 'Üslü ifadeler · Köklü ifadeler · Sayı kümeleri ve aralıklar'),
    ...k('Nicelikler ve Değişimler', 'Doğrusal fonksiyonlar · Mutlak değer · Denklem ve eşitsizlikler'),
    ...k('Geometrik Şekiller', 'Üçgende açılar · Üçgende kenar bağıntıları'),
    ...k('Eşlik ve Benzerlik', 'Dönüşümler · Eşlik ve benzerlik · Tales, Öklid, Pisagor'),
    ...k('Algoritma ve Bilişim', 'Algoritmik problem çözme · Mantık bağlaçları'),
    ...k('İstatistiksel Araştırma Süreci', 'Veri toplama · Grafik ve yorum'),
    ...k('Veriden Olasılığa', 'Deneysel ve teorik olasılık'),
  ],
  10: [
    ...k('Sayılar', 'Asal sayılar · EBOB ve EKOK · Bölünebilme'),
    ...k('Nicelikler ve Değişimler', 'İkinci dereceden fonksiyonlar · Karekök fonksiyonu · Rasyonel fonksiyonlar'),
    ...k('Geometrik Şekiller', 'Dik üçgende trigonometri · Üçgende yardımcı elemanlar · Sinüs ve kosinüs teoremleri'),
    ...k('Sayma, Algoritma ve Bilişim', 'Sayma · Algoritmalar'),
    ...k('Analitik İnceleme', 'Koordinat düzleminde inceleme'),
    ...k('İstatistiksel Araştırma Süreci', 'Veri, grafik ve yorum'),
    ...k('Veriden Olasılığa', 'Deneysel ve teorik olasılık'),
  ],
  11: [
    ...k('Geometrik Şekiller', 'Dörtgenler · Özel dörtgenler · Çokgenler'),
    ...k('Nicelikler ve Değişimler', 'Trigonometri · Üstel ve logaritmik fonksiyonlar · Bileşke fonksiyon ve fonksiyon işlemleri'),
    ...k('İstatistiksel Araştırma Süreci', 'Veri, tablo, grafik ve yorum'),
  ],
  12: [
    ...k('TYT Temel', 'Temel kavramlar ve sayılar · Problemler'),
    ...k('Cebir', 'Polinomlar · İkinci dereceden denklemler · Parabol · Karmaşık sayılar · Logaritma · Diziler'),
    ...k('Trigonometri', 'Trigonometri'),
    ...k('Analiz', 'Limit ve süreklilik · Türev · İntegral'),
    ...k('Sayma ve Olasılık', 'Permütasyon ve kombinasyon · Olasılık'),
    ...k('Geometri', 'Çember ve daire · Analitik geometri · Dönüşüm geometrisi · Katı cisimler'),
  ],
}
