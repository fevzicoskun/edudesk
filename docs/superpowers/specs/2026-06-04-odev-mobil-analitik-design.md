# Ödev Sistemi: Mobil UX + Analitik Sayfası

**Tarih:** 2026-06-04  
**Kapsam:** StatusBoard dokunma iyileştirmesi + `/odevler/analitik` yeni sayfası  
**Durum:** Onaylandı

---

## 1. Motivasyon

Mevcut ödev sisteminde iki kritik eksik:

1. **Mobil UX:** StatusBoard'daki durum chip butonları `~28px` yüksekliğinde — WCAG 44px minimumunun altında, telefonda hassas dokunma gerekiyor.
2. **Analitik:** Tamamlanma verisi dağınık (her ödev detayında ayrı ayrı). Zümre toplantısı, kendi takip ve veli görüşmesi için merkezi özet yok.

---

## 2. Kapsam Dışı

- Ödev puanlama (not sistemi) — ayrı özellik
- Veli bildirimleri (SMS/WhatsApp otomasyonu) — ayrı özellik
- Grafik kütüphanesi (recharts, chart.js) — CSS-only bar chart kullanılacak
- StatusBoard server action / state mantığı değişmeyecek

---

## 3. Özellik A — StatusBoard Mobil Dokunma İyileştirmesi

**Dosya:** `app/(dashboard)/odevler/[id]/StatusBoard.tsx`  
**Değişiklik türü:** Yalnızca CSS/layout — iş mantığı dokunulmaz.

### Durum Butonları

Mevcut: `flex-wrap gap-1.5`, buton `px-2.5 py-1 text-xs` (~28px yükseklik)

Yeni layout:
```
Üst sıra (3 buton): [ Yapıldı ] [ Eksik ] [ Yapılmadı ]
Alt sıra (2 buton): [ Geç     ] [ Mazeretli            ]
```

- `grid grid-cols-3` üst sıra, `grid grid-cols-2` alt sıra
- Her buton `min-h-[44px] flex items-center justify-center`
- Seçili buton: mevcut `STYLES` renkleri + `ring-2 ring-offset-1 font-bold`
- Seçili olmayan: `font-medium` (mevcut gibi)
- Pending: `opacity-60 pointer-events-none` (değişmez)

### Not Butonu

- `min-h-[44px] min-w-[80px]` — büyütülüyor
- İkon + metin düzeni korunuyor

---

## 4. Özellik B — `/odevler/analitik` Sayfası

### 4.1 Dosya Yapısı

```
app/(dashboard)/odevler/analitik/
├── page.tsx              ← server component, veri çekme + RBAC
├── AnalitikOzet.tsx      ← 4 KPI kartı (server component)
├── SinifDetay.tsx        ← sınıf bazlı CSS bar chart (server component)
└── OgrenciSicil.tsx      ← riskli öğrenci listesi + modal tetikleyici (client component)
```

`HomeworkRepository` ve `HomeworkService` yeni analitik sorgu metodu alacak.

### 4.2 RBAC

| Rol | Görünen Veri |
|-----|-------------|
| `ogretmen` | Yalnızca kendi atadığı ödevler / kendi sınıfları |
| `zumre_baskani` | Okulun tüm öğretmen/sınıf verileri |
| `mudur` / `mudur_yardimcisi` | Okulun tüm öğretmen/sınıf verileri |

Her sorguda `school_id` zorunlu. Eksikse `redirect('/login')`.

### 4.3 Veri Modeli

`page.tsx` şu verileri çekecek (parallel `Promise.all`):

```ts
const [classesRes, homeworksRes, submissionsRes, studentsRes] = await Promise.all([
  supabase.from('classes').select('id, name, grade').eq('school_id', sid),
  supabase.from('homeworks').select('id, class_id, teacher_id, due_date, title')
    .eq('school_id', sid).is('deleted_at', null).eq('is_template', false),
  supabase.from('homework_submissions').select('homework_id, student_id, status')
    .eq('school_id', sid),
  supabase.from('students').select('id, class_id, full_name, student_number')
    .eq('school_id', sid).is('deleted_at', null),
])
```

Öğretmen rolünde `homeworks` sorgusu `.eq('teacher_id', userId)` filtresi alır; `classes` sorgusu teacher'ın atadığı ödevlerden türetilen `class_id`'lerle kısıtlanır.

### 4.4 Bölüm: Genel Özet (AnalitikOzet.tsx)

4 KPI kartı — hesaplama sunucu tarafında:

| Kart | Hesap |
|------|-------|
| Toplam Ödev | `homeworks.length` |
| Ort. Tamamlanma % | Her ödev için `yapildi / (toplam_öğrenci - mazeretli) * 100`, tüm ödevlerin ortalaması — mazeretli sayısı paydadan çıkarılır |
| Riskli Öğrenci | `missedCount >= 3` (yapılmadı + eksik) olan tekil öğrenci sayısı |
| Bekleyen Kontrol | `due_date < bugün` ve hiç submission kaydı olmayan ödev sayısı |

### 4.5 Bölüm: Sınıf Bazlı Tamamlanma (SinifDetay.tsx)

Her sınıf için yatay CSS bar:

```
5A ███████████░░░░░  73%  (18 ödev · 28 öğrenci)
```

- Tamamlanma % = `yapildi sayısı / (öğrenci × ödev)` 
- Bar rengi: ≥80% yeşil, 60-79% turuncu, <60% kırmızı
- Kart tıklanınca `/odevler/sinif/[classId]` → mevcut sınıf matrisi
- Boş sınıf (ödev yok): "Henüz ödev atanmamış" etiketi

### 4.6 Bölüm: Öğrenci Sicili (OgrenciSicil.tsx)

Riskli öğrenciler azalan sırada (yapılmadı + eksik toplam):

```
Ahmet Yılmaz   5A   7/12 eksik   [kırmızı badge]
Fatma Kaya     5A   5/12 eksik   [turuncu badge]
```

- Eşik: `missedCount >= 3` — altındakiler listeye girmez
- Badge rengi: `>= toplam_ödev/2` → kırmızı, `>= 3` → turuncu
- Öğrenci adına tıklanınca mevcut `StudentHomeworkProfileModal` açılır
- Modal için `classId` gerekiyor — öğrencinin `class_id`'si kullanılır
- `OgrenciSicil` client component olacak (modal state için)

### 4.7 Bölüm: Dönemlik Eğilim (SinifDetay.tsx içinde)

Son 8 hafta, `due_date`'e göre haftalık bucket:

```
Hf1  Hf2  Hf3  Hf4  Hf5  Hf6  Hf7  Hf8
 █    ██   ███  ████  ███  ████  ██   █
68%  72%  75%  82%  79%  84%  71%  88%
```

- Hafta bucket: `startOfWeek(parseISO(due_date), { weekStartsOn: 1 })` → ISO tarih string'i anahtar olarak kullanılır (zaten `@/src/shared/date`'den export ediliyor)
- Yalnızca ödev olan haftalar gösterilir (boş hafta atlanır)
- Sıfır veri durumunda bu bölüm gizlenir

### 4.8 Navigasyon

- Ödev listesi sayfası (`/odevler`) üst sağa analitik ikonu eklenir (mevcut takvim ikonu yanına)
- Ödev detay sayfasından link yok — analitik üst düzey bir görünüm

### 4.9 Hata Yönetimi

- Supabase sorgusu başarısız → her bölüm kendi `error` prop alır, kırmızı alert + `<a href="/odevler/analitik">Tekrar dene</a>` (sayfayı yeniden yükler)
- Boş veri durumları:
  - Ödev yok: "Henüz ödev atanmamış" empty state
  - Riskli öğrenci yok: "Tüm öğrenciler düzenli" mesajı (pozitif framing)
  - Trend verisi yok: bölüm tamamen gizlenir

---

## 5. Test Planı

| Test | Tür | Açıklama |
|------|-----|----------|
| Haftalık bucket hesaplama | unit | `due_date` → hafta numarası, boş hafta atlama |
| Riskli öğrenci hesaplama | unit | `missedCount >= 3` eşiği, badge renk mantığı |
| Tamamlanma % hesaplama | unit | Mazeretli öğrenci dışarıda mı? (mevcut `computeStudentHomeworkStats` kullanılıyorsa zaten test var) |
| Analitik sayfası RBAC | integration | Öğretmen başka okul verisini göremez |
| Analitik sayfası empty state | integration | Ödev yokken 500 vermez |
| StatusBoard render | unit snapshot | Yeni grid layout doğru render oluyor mu |

---

## 6. Uygulama Sırası

1. `HomeworkRepository` — analitik sorgu metodu
2. `app/(dashboard)/odevler/analitik/page.tsx` — server component iskelet + veri
3. `AnalitikOzet.tsx` — KPI kartlar
4. `SinifDetay.tsx` — sınıf barları + trend
5. `OgrenciSicil.tsx` — riskli öğrenci listesi + modal entegrasyonu
6. `StatusBoard.tsx` — mobil CSS iyileştirme
7. `/odevler` sayfasına analitik linki
8. Unit + integration testler
