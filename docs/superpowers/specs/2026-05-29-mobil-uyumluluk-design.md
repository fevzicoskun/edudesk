# EduDesk Mobil Uyumluluk Tasarımı

**Tarih:** 2026-05-29  
**Yaklaşım:** Sistematik Sweep (A)  
**Hedef:** Telefon öncelikli tam mobil uyumluluk (360–428px)

---

## Kapsam

Tailwind class düzeltmeleriyle tüm uygulamayı telefon uyumlu hale getir. Hiçbir yeni bileşen/abstraction eklenmez; mevcut kodda minimum değişiklik.

---

## 1. Grid Düzeltmeleri

### Kural
- `grid-cols-3` → `grid-cols-1 sm:grid-cols-3`
- `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`

### Etkilenen Dosyalar
| Dosya | Mevcut | Düzeltme |
|---|---|---|
| `MudurGunlukOzetKartlari.tsx` | `grid-cols-3` | `grid-cols-1 sm:grid-cols-3` |
| `OgretmenDashboard.tsx` | `grid-cols-3` | `grid-cols-1 sm:grid-cols-3` |
| `SinavOrtalamaWidget.tsx` | `grid-cols-3` | `grid-cols-1 sm:grid-cols-3` |
| `OkulSeviyesiKartlari.tsx` | `grid-cols-3` | `grid-cols-1 sm:grid-cols-3` |
| `PerformansWidget.tsx` | `grid-cols-3` | `grid-cols-1 sm:grid-cols-3` |
| `SchoolMeetings.tsx` | `grid-cols-2` | `grid-cols-1 sm:grid-cols-2` |
| `AddColumnModal.tsx` | `grid-cols-2` | `grid-cols-1 sm:grid-cols-2` |
| `GunlukPlanForm.tsx` | `grid-cols-2` | `grid-cols-1 sm:grid-cols-2` |
| `SokForm.tsx` | `grid-cols-3` | `grid-cols-1 sm:grid-cols-3` |
| `NotebookCheckClient.tsx` | `grid-cols-2` | `grid-cols-1 sm:grid-cols-2` |
| `RaporButton.tsx` | `grid-cols-2` | `grid-cols-1 sm:grid-cols-2` |

---

## 2. Not Defteri Tablosu (Sütun Gizleme)

### Kural
- Mobilde (`<sm`) sadece öğrenci adı sütunu + **en son** not sütunu görünür
- Diğer tüm not sütunları: `hidden sm:table-cell`
- Sütun başlıkları da aynı şekilde gizlenir
- "Son sütun" mantığı: tablo son grade_column'ı her zaman görünür tutar

### Etkilenen Dosya
- `app/(dashboard)/not-defteri/[classId]/GradeGrid.tsx`

### Davranış
```
Desktop: [Öğrenci] [Yazılı 1] [Quiz 1] [Proje] [Yazılı 2] ...
Mobil:   [Öğrenci] [Yazılı 2]  ← sadece son sütun
```

---

## 3. MobileNavDrawer

### Kural
- `grid-cols-3` → `grid-cols-4` (ikonlar küçülür ama sığar)
- Nav item metni kısaltılır gerekirse (`text-[10px]` → `text-[9px]`)

### Etkilenen Dosya
- `components/layout/MobileNavDrawer.tsx`

---

## 4. Fixed Width Dropdown'lar

### Kural
- `w-80` → `w-[calc(100vw-2rem)] sm:w-80` (telefonda tam genişlik bırak)
- `w-64` → `w-[calc(100vw-2rem)] sm:w-64`

### Etkilenen Dosyalar
- `components/NotificationBell.tsx` (`w-80`)
- `components/RaporButton.tsx` (`w-64`)

---

## 5. Genel Spacing & Typography

### Sayfa Padding
- `p-6` → `p-4 sm:p-6` (tüm page.tsx dosyalarında)

### Başlıklar
- `text-2xl` → `text-xl sm:text-2xl` (sayfa başlıkları)

### Buton Grupları
- Yan yana buton satırları (`flex gap-2`) → `flex-wrap` ekle (taşma engeli)

### Etkilenen Dosyalar
- `app/(dashboard)/anasayfa/page.tsx`
- `app/(dashboard)/odevler/page.tsx`
- `app/(dashboard)/siniflar/page.tsx`
- `app/(dashboard)/yoklama/page.tsx`
- `app/(dashboard)/raporlar/page.tsx`
- `app/(dashboard)/duyurular/page.tsx`
- `app/(dashboard)/profil/page.tsx`
- `app/(dashboard)/yonetim/page.tsx`

---

## 6. Kapsam Dışı

- Sidebar (zaten responsive)
- Dialog bileşeni (zaten `max-w-[calc(100%-2rem)]`)
- Kullanıcılar tablosu (zaten `hidden sm:table-cell` var)
- Auth sayfaları (login/kayit — ayrı layout)

---

## Test Kriterleri

- [ ] 375px (iPhone SE) ekranında tüm sayfalar yatay overflow olmadan görünür
- [ ] Not Defteri mobilde öğrenci adı + son sütun gösterir
- [ ] Dashboard stat kartları dikey olarak sıralanır
- [ ] Dropdown'lar ekran dışına taşmaz
- [ ] Desktop görünümünde hiçbir değişiklik yok
