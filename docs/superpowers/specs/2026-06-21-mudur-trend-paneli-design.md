# Müdür Trend Paneli — Tasarım (Faz 1)

**Tarih:** 2026-06-21
**Durum:** Onaylandı, plana hazır
**Kapsam:** Faz 1 — müdür anasayfasına okul-geneli trend paneli. Faz 2 (MY erken-uyarı + dışa aktarma) ayrı spec.

## Amaç

Müdürün anasayfası şu an yalnızca *anlık fotoğraf* gösteriyor (sayılar, bugünkü
yoklama, risk öğrenciler). Eksik olan: **zaman içindeki değişim.** Müdür "okul
yukarı mı aşağı mı gidiyor?" sorusuna cevap alamıyor.

Rol ayrımı (kullanıcı kararı):
- **Müdür** → stratejik nabız: agregat trend grafikleri. *Sadece trend.*
- **Müdür yardımcısı** → operasyonel: erken uyarı + evrak/dışa aktarma (Faz 2).

Bu yüzden Faz 1'de, şu an müdür anasayfasındaki detaylı "hangi öğretmen
girdi/girmedi" listesi (`MudurOgretmenAktivite`) müdürden çıkarılıp MY
anasayfasına taşınır. Müdürde yerine aktivite *oranı trendi* kalır.

## Metrikler

Her hafta Pazartesi–Pazar bucket'ına konur. Pencere **değişken**: dönem
başından (`schoolYearStart()`) bugüne kadar geçen tüm haftalar.

### 1. Devamsızlık oranı trendi (haftalık)
- `oran = absent kayıt sayısı / o haftanın toplam yoklama kaydı`
- **Sadece tam devamsızlık** sayılır. `excused` (izinli/raporlu) devamsızlıktan
  sayılmaz ama paydada kalır (mazeretli gün oranı sayıca düşürür).
- Çizgi grafik + geçen haftaya göre delta. Devamsızlık **düşüşü = yeşil ↓**.

### 2. Öğretmen aktivite oranı trendi (haftalık)
- `oran = o hafta ≥1 yoklama VEYA ödev girmiş öğretmen / toplam öğretmen`
- Aynı öğretmenin birden çok kaydı bir kez sayılır.
- Çizgi grafik. Yükseliş **= yeşil ↑**.

### 3. Sınıf karşılaştırması (anlık, trend değil)
- Her sınıf için **dönem başından bugüne** devamsızlık oranı.
- Yatay bar, en yüksek (en sorunlu) üstte.
- Tıklama → `/siniflar/[id]`.

## Mimari

Mevcut domain pattern'e uygun (`repositories → services → actions`, server
component'ler doğrudan okur).

```
src/domains/dashboard/queries/schoolTrends.ts   # YENİ: saf haftalık bucketing hesapları (DB'siz test edilebilir)
app/(dashboard)/anasayfa/MudurTrendWidget.tsx    # YENİ: server component, veriyi çeker
app/(dashboard)/anasayfa/charts/TrendChart.tsx   # YENİ: 'use client', recharts (sadece sunum)
```

- **Hesap mantığı server'da, saf fonksiyon.** `schoolTrends.ts` ham satırları
  (yoklama, ödev, öğretmen listesi) alıp haftalık bucket dizisi döndürür.
  DB'ye dokunmaz → unit test edilir.
- **Grafik client component.** `TrendChart` yalnızca hazır veriyi alır, recharts
  ile çizer. `recharts ^3.8.1` zaten kurulu — yeni bağımlılık yok.
- **Performans:** Aktivite oranını 8+ hafta için ayrı sorgularla çekmek yerine
  tek SQL'de haftalık gruplayan bir RPC: `school_weekly_metrics`. Mevcut
  `school_teacher_activity` RPC'si örnek alınır.
  > **Plan güncellemesi (2026-06-21):** RPC'den vazgeçildi. Bir okul-yıl ≈ 8K
  > attendance satırı (`getAbsentYearRows` limiti 15K içinde) — ham satırı çekip
  > JS'de haftalık bucket'lamak yeterli, migration gerektirmez ve saf fonksiyon
  > olarak DB'siz test edilebilir. Bkz. plan Task 1–2.
- **Yerleştirme:** `MudurTrendWidget`, `app/(dashboard)/anasayfa/page.tsx`
  içindeki `MudurWidgets`'a eklenir. Aynı düzenlemede `MudurOgretmenAktivite`
  `MudurWidgets`'tan kaldırılıp `MYWidgets`'a eklenir.

## Empty-state

Değişken hafta gerçeği: dönem yeni başladıysa elde 1 hafta veri olur, tek
noktayla çizgi olmaz. (Doğrulandı: mevcut yoklama verisi ~16 gün, çoğu demo.)

- **< 2 dolu hafta** → grafik yerine "Trend için veri birikiyor — şu ana kadar
  X hafta" kartı (mevcut empty-state diliyle tutarlı).
- **≥ 2 hafta** → çizgi grafik gösterilir.
- **Sınıf karşılaştırması** ayrı kural: hiç yoklama yoksa "henüz yoklama
  girilmemiş", aksi halde gösterilir (snapshot, 1 hafta yeterli).

## Test

`schoolTrends.ts` saf hesap fonksiyonu → unit test (DB'siz):
- Hafta sınırları doğru (Pzt–Paz), dönem başından kırpma.
- Boş hafta (0 kayıt) doğru ele alınıyor.
- `absent=1`, `excused` paydada ama pay dışı.
- Aktivite oranı: aynı öğretmenin iki kaydı bir kez sayılıyor.

`school_weekly_metrics` RPC → entegrasyon testiyle ayrıca doğrulanabilir.
`TrendChart` client component test edilmez (sadece sunum).

## Kapsam dışı (Faz 2)

- MY erken-uyarı: bozulan trendleri öne çıkaran alert'ler.
- Dışa aktarma: okul-geneli PDF/Excel özet ("okul karnesi").
- Ödev teslim oranı trendi (ödev verisi henüz olgunlaşmamış — şimdilik dışarıda).
