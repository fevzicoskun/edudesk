# Spec: Quick Wins + Dashboard İyileştirmeleri

**Tarih:** 2026-06-13  
**Durum:** Onaylandı

---

## Bağlam

EduDesk'te 11 küçük ama sinir bozucu UX sorunu tespit edildi: native `window.confirm` diyalogları, tıklanamaz ama tıklanabilir görünen elementler, eksik boş durum mesajları ve dashboard widget'larında hata izolasyonu eksikliği. Hiçbiri yeni özellik değil — mevcut özelliklerin kenarlarını temizleme işlemi.

---

## A — Quick Wins

### A1. `window.confirm` → Inline Onay

**Etkilenen dosyalar:**
- `app/(dashboard)/odevler/BulkContext.tsx` (satır 41)
- `app/(dashboard)/yoklama/YoklamaClient.tsx` (satır 136)

**BulkContext — toplu silme onayı:**

Native `window.confirm` kaldırılır. Yerine `BulkActionBar` içinde inline onay aşaması eklenir:

1. "Sil" butonuna basılınca buton durumu değişir → `"X ödev silinecek · [İptal] [Onayla]"` chipları görünür
2. "Onayla" tıklanınca silme işlemi yapılır, "İptal" tıklanınca eski duruma döner
3. State: `confirmingDelete: boolean` — `BulkContext` içinde yönetilir

**YoklamaClient — kaydedilmemiş değişiklik uyarısı:**

Native `window.confirm` kaldırılır. Yerine `isDirty === true` ve sınıf değiştirme isteği gelince sayfanın üstünde sarı bir uyarı banner gösterilir:

```
⚠ Kaydedilmemiş değişiklikler var.   [Devam et ve kaybet]  [Geri dön]
```

State: `pendingClassSwitch: string | null` — bekleyen sınıf ID'si. Banner "Devam et" tıklanınca switch yapılır, "Geri dön"de pendingClassSwitch null'a sıfırlanır.

---

### A2. Ödev Formunda Geçmiş Tarih Engeli

**Etkilenen dosya:** `app/(dashboard)/odevler/yeni/HomeworkForm.tsx` (ve `[id]/duzenle/OdevDuzenleForm.tsx`)

Tarih input'larına `min={todayISO}` eklenir (bugünün `YYYY-MM-DD` formatı). Kullanıcı geçmiş tarih girerse `"Geçmiş tarih seçildi — teslim tarihi bugün veya sonrası olmalı"` kırmızı uyarı metni gösterilir. Düzenleme formunda mevcut geçmiş tarihin değiştirilmesi engellemez (sadece yeni seçimlere kısıtlama).

---

### A3. "Yoklama Tamam" Tıklanabilir

**Etkilenen dosya:** `app/(dashboard)/anasayfa/HizliAksiyonlar.tsx` (satır 30–36)

`<div className="...">Yoklama Tamam</div>` → `<Link href="/yoklama" className="...">Yoklama Tamam</Link>`.

Stil aynı kalır (emerald renk, border), sadece `div` → `Link` dönüşümü yapılır. Öğretmen tıklayıp yoklama çizelgesini görebilir.

---

### A4. Okul Kodu Müdür Yardımcısına Açık

**Etkilenen dosya:** `app/(dashboard)/kullanicilar/page.tsx`

```typescript
// Önce
{isMudur && <OkulKoduKarti schoolCode={school.school_code} />}

// Sonra
{(isMudur || isMY) && <OkulKoduKarti schoolCode={school.school_code} />}
```

Müdür yardımcısı da öğretmen davet edebildiğinden okul kodunu görmesi gerekir.

---

### A5. Veli Portalında Devamsızlık Sıfır Durumu

**Etkilenen dosya:** `app/veli/[token]/VeliDevamsizlikSection.tsx`

Mevcut kod: `absentCount === 0 && lateCount === 0` ise bölüm tamamen gizleniyor.

Yeni davranış: Bölüm her zaman gösterilir. Devamsızlık sıfırsa liste yerine:

```
✓ Bu dönemde devamsızlık kaydı bulunmuyor.
```

Yeşil/emerald renkle, grafik gösterilmez (VeliDevamsizlikChart null döneceğinden otomatik gizlenir).

---

## C — Dashboard İyileştirmeleri

### C1. Risk Widget "Tümünü Gör" Linki

**Etkilenen dosya:** `app/(dashboard)/anasayfa/RiskUyarilariWidget.tsx`

Mevcut: `alerts.length > 5` ise header'da tıklanamaz `"{alerts.length} öğrenci"` span.

Yeni:
- Header'daki sayı badge'i → `<Link href="/siniflar">` ile sarılır
- Liste sonuna (5 kart sonrasına) `"+ {alerts.length - 5} öğrenci daha"` tıklanabilir satır eklenir, `/siniflar`'a link verir

---

### C2. MudurOgretmenAktivite Error Boundary

**Etkilenen dosya:** `app/(dashboard)/anasayfa/page.tsx`

`MudurOgretmenAktivite` şu an yalnızca `<Suspense fallback={<WidgetSkeleton tall />}>` içinde. Hata fırlatırsa tüm `MudurWidgets` çöker.

Çözüm: `MudurOgretmenAktivite`'yi saran küçük bir `ErrorBoundary` client component eklenir (`app/(dashboard)/anasayfa/WidgetErrorBoundary.tsx`). Hata durumunda:

```
Öğretmen aktivitesi yüklenemedi.
```

Gri bir placeholder gösterir, sayfanın geri kalanı etkilenmez.

---

### C3. "Bugün Yapılacaklar" — Yeni Öğretmen Durumu

**Etkilenen dosyalar:**
- `app/(dashboard)/anasayfa/BugunYapilacaklarWidget.tsx`
- `app/(dashboard)/anasayfa/OgretmenDashboard.tsx` (parent — prop geçer)

Mevcut: `yoklamaDurumu.length === 0 && todayHomeworks.length === 0 && activeRiskCount === 0` → "Tümü tamam ✓" + "Bugün için bekleyen işlem yok." — yeni öğretmende yanıltıcı.

Yeni prop: `hasClasses: boolean` — `OgretmenDashboard` içinde `teacherClasses.length > 0` ile hesaplanır, `BugunYapilacaklarWidget`'e geçilir.

Widget mantığı:
```
allDone = hasClasses && eksikYoklama.length === 0 && todayHomeworks.length === 0 && activeRiskCount === 0
noClasses = !hasClasses && todayHomeworks.length === 0 && activeRiskCount === 0
```

- `allDone` → "Tümü tamam ✓" (mevcut)
- `noClasses` → "Henüz sınıf atanmamış." (yeni, gri)
- İkisi de değilse → normal liste

---

### C4. Yoklama Satırlarına Link

**Etkilenen dosya:** `app/(dashboard)/anasayfa/BugunYapilacaklarWidget.tsx`

"Bugün Yapılacaklar" widget'ında yoklama listesi satırları tıklanamaz. Her `<li>` → `<Link href="/yoklama">` ile sarılır. Öğretmen direkt yoklama sayfasına gider.

---

## Dokunulmayacak Dosyalar

- `src/infrastructure/supabase/database.types.ts`
- `proxy.ts`
- E2E test dosyaları

---

## Test Kapsamı

Her değişiklik için birim test gerekmez (saf UI değişiklikleri). Aşağıdakiler için test yazılır:

- `BulkContext` — `confirmingDelete` state geçişleri (2 test)
- `BugunYapilacaklarWidget` — `hasClasses=false` boş durum (1 test)
- `RiskUyarilariWidget` — `alerts.length > 5` link render (1 test)

---

## Doğrulama

1. `npx vitest run` — 779+ test yeşil
2. `npx tsc --noEmit` — 0 hata
3. Manuel kontrol:
   - Ödev listesinde toplu seç → Sil → inline onay görünür, İptal çalışır
   - Yoklama sayfasında değişiklik yap → sınıf değiştir → sarı banner çıkar
   - Ödev formunda geçmiş tarih seç → kırmızı uyarı görünür
   - Anasayfada "Yoklama Tamam" tıklanınca `/yoklama`'ya gider
   - Müdür yardımcısı olarak `/kullanicilar` → okul kodu görünür
   - Veli portalında devamsızlıksız öğrenci → "Bu dönemde devamsızlık yok" görünür
   - Risk widget'ında 5'ten fazla öğrenci → "Tümünü gör" linki görünür
   - Yeni öğretmen (sınıf yok) anasayfasında "Henüz sınıf atanmamış" görünür
