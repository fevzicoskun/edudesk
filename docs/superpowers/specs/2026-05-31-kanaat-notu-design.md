# Kanaat Notu — Tasarım Spesifikasyonu

**Tarih:** 2026-05-31  
**Durum:** Onaylandı  

---

## Özet

Not defterine yeni bir "Kanaat" sekmesi eklenir. Öğretmen dönem sonunda "Dönem Değerlendirmesi Oluştur" butonuna basarak tüm sınıf için otomatik kanaat notu hesaplatır. Sistem üç veri kaynağından (ödev tamamlama, devamsızlık, sınav ortalaması) 1–5 arası sayısal skor ve şablon metin üretir. Öğretmen metni düzenler, onaylar ve kaydeder.

---

## Hedef

- Öğretmenin manuel not tutma yükünü azalt
- MEB kanaat notu gereksinimini destekle
- Mevcut not defteri arayüzünde doğal konumlandırma — yeni sidebar öğesi ekleme

---

## Kapsam Dışı

- AI/LLM metin üretimi (şablon tabanlı yeterli)
- Veliye otomatik gönderme (ayrı özellik)
- Gerçek zamanlı / anlık hesaplama
- Ders planlaması

---

## Mimari

### Veri Akışı

```
Ödev tablosu    ──┐
Yoklama tablosu ──┼──▶ computeKanaat() ──▶ { score, text } ──▶ öğretmen düzenler ──▶ DB
Sınav tablosu   ──┘
```

- `computeKanaat()` saf bir fonksiyon — DB yazma yapmaz, test edilebilir
- Hesaplama server action'dan döner, client'ta gösterilir
- Kaydetme ayrı bir server action (`saveKanaatNotu`)

### DB Şeması

```sql
CREATE TABLE kanaat_notlari (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   uuid NOT NULL REFERENCES students(id),
  class_id     uuid NOT NULL REFERENCES classes(id),
  teacher_id   uuid NOT NULL REFERENCES profiles(id),
  school_id    uuid NOT NULL,
  score        smallint NOT NULL CHECK (score BETWEEN 1 AND 5),
  text         text NOT NULL,
  donem        text NOT NULL,         -- '2025-2026-1' formatı
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  UNIQUE (student_id, donem)
);

ALTER TABLE kanaat_notlari ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON kanaat_notlari
  USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));
```

---

## Skor Formülü

| Kaynak | Ağırlık | Hesap |
|---|---|---|
| Ödev tamamlama | %40 | `(oran × 4) + 1` — oran = yapıldı/toplam (0→1, 1→5) |
| Devamsızlık | %30 | `(max(0, 20 - gün) / 20) × 4 + 1` (0 gün→5, ≥20 gün→1) |
| Sınav ortalaması | %30 | `(ortalama / 100) × 4 + 1` (0→1, 100→5) |

**Ağırlık ayarı:** Kaynak verisi yoksa o bileşen devre dışı kalır, kalan kaynaklar toplam %100'e ölçeklenir.

**Sonuç:** Ağırlıklı ortalama, `Math.round()` ile 1–5 tam sayıya yuvarlanır.

### Şablon Metin

```
"{ad} bu dönem ödevlerini %{odev_pct} oranında tamamlamıştır.
{devamsizlik_gun} gün devamsızlık yapmıştır.
Sınav ortalaması {sinav_ort} puandır.
{genel_degerlendirme}"
```

`genel_degerlendirme` skora göre:
- 5 → "Dönem boyunca üstün başarı göstermiştir."
- 4 → "Dönem boyunca başarılı bir performans sergilemiştir."
- 3 → "Dönem boyunca orta düzeyde bir performans göstermiştir."
- 2 → "Dönem boyunca gelişime açık bir performans göstermiştir."
- 1 → "Dönem boyunca destek gerektiren bir süreç geçirmiştir."

---

## UI

### Konumlandırma

`app/(dashboard)/not-defteri/[classId]/page.tsx` — mevcut sekme sırası:

```
[Yazılı]  [Quiz]  [Proje]  [Kanaat]
```

### Kanaat Sekmesi Görünümü

```
┌─────────────────────────────────────────────────────────────┐
│  [Dönem Değerlendirmesi Oluştur ▶]              [Dönem ▾]   │
├──────────────────┬───────┬──────────────────────────────────┤
│ Öğrenci          │ Skor  │ Metin                            │
├──────────────────┼───────┼──────────────────────────────────┤
│ Ali Kaya         │  ●4   │ "Ali bu dönem ödevlerini..."  ✏  │
│ Ayşe Mercan      │  ●3   │ "Ayşe devamsızlık..."         ✏  │
└──────────────────┴───────┴──────────────────────────────────┘
                                              [Tümünü Kaydet]
```

- **Skor renk kodu:** 5→`text-green-600`, 4→`text-blue-600`, 3→`text-yellow-600`, 2→`text-orange-600`, 1→`text-red-600`
- **Metin alanı:** `<textarea>` — inline düzenleme, otomatik yükseklik
- **"Tümünü Kaydet"** butonu: değişiklik yoksa disabled
- **Dönem seçici:** `2025-2026-1` / `2025-2026-2` dropdown

---

## Edge Case'ler

| Durum | Davranış |
|---|---|
| Öğrencinin hiç ödevi yok | Ödev bileşeni devre dışı, metin "Bu dönem ödev girilmemiş" içerir |
| Sınav notu girilmemiş | Sınav bileşeni devre dışı, kalan iki kaynak ölçeklenir |
| Zaten kaydedilmiş kanaat | "Bu dönem için kayıtlı kanaat notu var. Üzerine yazılsın mı?" uyarısı |
| Tümünü kaydet kısmen başarısız | Başarısız satırlar kırmızı bordur, toast: "X kayıt kaydedildi, Y başarısız" |
| Hiç öğrenci yok (boş sınıf) | Boş durum mesajı, "Oluştur" butonu disabled |

---

## Bileşen Haritası

| Bileşen | Sorumluluk |
|---|---|
| `KanaatSekmesi` | Sekme içeriği, state yönetimi |
| `KanaatSatiri` | Tek öğrenci satırı — skor + textarea |
| `computeKanaat()` | Saf hesaplama fonksiyonu (`src/domains/kanaat/`) |
| `generateKanaatText()` | Şablon metin üreticisi |
| `saveKanaatNotu` | Server action — DB yazma |
| `getKanaatNotu` | Server action — mevcut kayıt okuma |

---

## Test Kapsamı

- `computeKanaat()` — unit test: tüm kaynak kombinasyonları, eksik veri, edge case'ler
- `generateKanaatText()` — unit test: her skor için doğru şablon
- `saveKanaatNotu` — integration test: RLS izolasyonu, üzerine yazma uyarısı
- `KanaatSekmesi` — component test: oluştur → düzenle → kaydet akışı
