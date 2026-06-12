# Kalite İyileştirme Sprinti — Design Spec
**Tarih:** 2026-06-13  
**Hedef:** TypeScript unsafe cast'leri 10 → ≤2, 300+ satır dosyalar 10 → 0

---

## Kapsam

### 1. TypeScript Cast Temizliği

**Mevcut durum:** 10 adet `as unknown as` / `as any` cast  
**Hedef:** 2 (kaçınılamaz library gap'leri)

| Dosya | Cast | Çözüm |
|-------|------|-------|
| `OdevCockpit.tsx:25` | `hw.homework_submissions as unknown as ...` | `database.types.ts` join tipi kullan → `as { homework_id: string }[] \| null` |
| `HomeworkSection.tsx:122` | `hw.classes as unknown as { name: string }` | `as { name: string } \| null` — `unknown as` kaldır |
| `odevler/[id]/page.tsx:63` | `hw.classes as unknown as { name: string }` | `as { name: string } \| null` |
| `siniflar/.../page.tsx:71` | `data as unknown as SubmissionRow[]` | `SubmissionRow` tipi `database.types.ts` tablosundan türet → `as SubmissionRow[]` |
| `siniflar/.../page.tsx:105` | `gradesRes.data as unknown as GradeRow[]` | `GradeRow` tipi türet → `as GradeRow[]` |
| `AylikDevamsizlikWidget.tsx:21` | `data as unknown as Row[]` | `Row` tipi türet → `as Row[]` |
| `veli/[token]/page.tsx:134` | `student.classes as unknown as ...` | `as { name: string; grade: number } \| null` |
| `veli/[token]/page.tsx:135` | `data as unknown as SubmissionRow[]` | `as SubmissionRow[]` |
| `OdevTamamlanmaChart.tsx:50` | `payload as any` | **KEEP** — Recharts typing gap |
| `MatrisClient.tsx:229` | `doc as unknown as { lastAutoTable? }` | **KEEP** — jsPDF typing gap |

**Not:** `as unknown as T` → `as T` dönüşümü için orta tip interface'i tam olarak Supabase sonucuyla uyumlu hale getirilmeli. Uyumsuzluk varsa satır içi tip genişletmesi yapılabilir.

---

### 2. Faz 1 — Dosya Bölme (Paralel, 6 Agent)

#### Agent B: `app/actions/homework.ts` (355 → ~175 satır)

**Bölme:**
- `app/actions/homework.ts` — ödev oluşturma, güncelleme, silme eylemleri (create/update/delete)
- `app/actions/homework-submissions.ts` — submission durumu, not, log, sorgulama eylemleri

**Taşınacaklar → `homework-submissions.ts`:**
- `updateSubmissionStatus`
- `updateAllSubmissionStatuses`
- `updateSubmissionNote`
- `getSubmissionLogs`
- `getStudentSubmissions`
- `getHomeworkSubmissions`

**Import güncelleme:** `StatusBoard.tsx`, `StatusBoardLoader.tsx` ve diğer submission-action importları yeni dosyaya yönlendirilir. `src/domains/homework/actions/index.ts` barrel re-export güncellenir.

---

#### Agent C: `src/domains/dashboard/services/TeacherDashboardService.ts` (325 → ~180 satır)

**Bölme:**
- `TeacherDashboardService.ts` — public servis metotları (getRiskAlerts, getDashboardData, getClassSummary, getMudurYardimcisiStats, getMudurDashboard)
- `src/domains/dashboard/lib/riskEngine.ts` — saf hesaplama fonksiyonları: `fetchRiskInputs`, `buildHwMissMap`, `buildAbsenceMap`, `buildRiskAlerts`

**Not:** `riskEngine.ts` pure functions — test edilebilir, yan etkisiz. Mevcut `src/domains/dashboard/risk.ts` dosyasıyla çakışmamak için sadece repository-çağıran fonksiyonlar ayrılır; saf matematik fonksiyonları `risk.ts`'te kalır.

---

#### Agent D: `app/(dashboard)/odevler/takvim/HomeworkCalendar.tsx` (314 → ~200 satır)

**Çıkarılacak:**
- `CalendarEventCard.tsx` — takvim etkinlik kartı bileşeni (renk, başlık, due-date rozeti)

**Kalan:** Grid mantığı, ay navigasyonu, event placement logic.

---

#### Agent E: `app/(dashboard)/siniflar/[id]/OgrenciListesi.tsx` (309 → ~200 satır)

**Çıkarılacak:**
- `OgrenciKart.tsx` — tek öğrenci satırı/kartı (isim, numara, veli link, eylem butonları)

**Kalan:** Liste container, sıralama, filtreleme, modal açma state.

---

#### Agent F: `app/veli/[token]/page.tsx` (325 → ~180 satır)

**Çıkarılacak:**
- `VeliOdevlerSection.tsx` — ödev listesi (upcoming + past bölümleri)
- `VeliDevamsizlikSection.tsx` — devamsızlık özet kartı

**Kalan:** Token doğrulama, öğrenci bilgileri header, VeliTracker, section orchestration.

---

### 3. Faz 2 — Dosya Bölme (Paralel, 5 Agent, Faz 1 sonrası)

#### Agent G: `app/(dashboard)/yoklama/YoklamaClient.tsx` (421 → ~220 satır)

**Çıkarılacak:**
- `YoklamaLockBanner.tsx` — kilit/hafta sonu/geçmiş tarih banner'ı (lock status UI, mesaj + renk mantığı)
- `YoklamaOgrenciRow.tsx` — tek öğrenci satırı (isim, devamsızlık rozeti, durum butonları, tooltip)

**Kalan:** State yönetimi, sınıf/tarih seçimi, kaydet butonu, takenToday mantığı.

---

#### Agent H: `app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/page.tsx` (382 → ~180 satır)

**Çıkarılacak:**
- `OdevGecmisiSection.tsx` — ödev geçmişi tablosu (SubmissionRow, durum badge'leri, istatistikler)
- `NotGecmisiSection.tsx` — not girişleri tablosu (GradeRow, ders/not gösterimi)

**Kalan:** Sayfa layout, öğrenci header, mevcut `StudentAttendanceHistory` ve `ParentContactLog` bileşenleri zaten ayrı dosyalarda — onlara dokunulmaz.

---

#### Agent I: `app/(dashboard)/odevler/[id]/StatusBoard.tsx` (365 → ~200 satır)

**Çıkarılacak:**
- `SubmissionHistoryPanel.tsx` — geçmiş log drawer/panel (tarih, durum değişim listesi, loading state)
- `StatusBoardRow.tsx` — tek öğrenci satırı (isim, durum butonları, not alanı, geçmiş toggle)

**Kalan:** Filtre/arama state, bulk action bar, selection mode, toplam istatistik satırı.

---

#### Agent J: `app/(dashboard)/odevler/SwipeableHomeworkCard.tsx` (326 → ~200 satır)

**Çıkarılacak:**
- `HomeworkStatusChips.tsx` — durum sayı chip'leri şeridi (yapıldı/yapılmadı/eksik/geç sayıları)

**Kalan:** Swipe gesture mantığı, kart layout, badge gösterimi, edit/delete swipe aksiyonları.

---

#### Agent K: `app/(dashboard)/odevler/yeni/HomeworkForm.tsx` (323 → ~200 satır)

**Çıkarılacak:**
- `ClassWeekLoadSection.tsx` — haftalık yük göstergesi (sınıf başına yük bar'ları, loading state)

**Kalan:** Form state yönetimi, sınıf çoklu seçim, konu/açıklama alanları, submit mantığı.

---

## Test Stratejisi

- Her agent sonunda: `npx tsc --noEmit` + `npx vitest run` → 700/700 geçmeli
- Faz 1 tamamlanınca build gate: `npx next build` temiz olmalı
- Faz 2 sonunda: aynı gate + `node scripts/quality.mjs` → cast ≤2, 300+ satır dosya yok

## Dosya Adlandırma Kuralları

- Yeni bileşenler: `PascalCase.tsx`, kaynak dosyayla aynı dizinde
- Yeni servis/lib dosyaları: `camelCase.ts`, domain dizininde
- Barrel export güncelleme: gerekli her `index.ts` güncellenir

## Kapsam Dışı

- Mantıksal değişiklik yok — sadece bölme ve tip düzeltme
- Yeni özellik eklenmez
- Mevcut testler bozulursa düzeltilir, yeni test eklenmez (coverage mevcut yeterli)
