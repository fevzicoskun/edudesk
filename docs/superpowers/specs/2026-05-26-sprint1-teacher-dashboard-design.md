# Sprint 1: Teacher Dashboard — Tasarım Speci

**Tarih:** 2026-05-26  
**Durum:** Onaylı  
**Kapsam:** TeacherDashboardService + Dashboard UI zenginleştirme + Sınıf detay performans widget'ı + DB tabloları

---

## Genel Bakış

Mevcut `/anasayfa` dashboard'u inline DB sorgulardan oluşuyor. Bu sprint'te:
1. Tüm iş mantığı `TeacherDashboardService`'e taşınır
2. Dashboard UI, 3 ana kart + haftalık özet şeridi layoutuna geçer
3. Sınıf detay sayfasına performans widget'ı (sınıf metrikleri + riskli öğrenciler) eklenir
4. `teacher_activity_log` ve `student_risk_history` DB tabloları eklenir

---

## Mimari

### Yeni Domain: `src/domains/dashboard/`

```
src/domains/dashboard/
  service.ts     ← TeacherDashboardService (4 public metod)
  types.ts       ← DashboardMetrics, RiskAlert, WeeklyStats, ClassSummary
  risk.ts        ← computeRiskLevel, computeRiskScore (saf fonksiyonlar)
```

### Değişen Dosyalar

| Dosya | Değişiklik |
|---|---|
| `app/(dashboard)/anasayfa/OgretmenDashboard.tsx` | 3 kart + haftalık şerit, service'den veri |
| `app/(dashboard)/anasayfa/RiskUyarilariWidget.tsx` | DB sorguları service'e taşınır, sadece render kalır |
| `app/(dashboard)/anasayfa/SubmissionsPanel.tsx` | Metrikler service'den gelir |
| `app/(dashboard)/siniflar/[id]/page.tsx` | `PerformansWidget` import edilir |

### Yeni Dosyalar

| Dosya | Amaç |
|---|---|
| `src/domains/dashboard/service.ts` | TeacherDashboardService |
| `src/domains/dashboard/types.ts` | Tip tanımları |
| `src/domains/dashboard/risk.ts` | Risk hesaplama (saf) |
| `app/(dashboard)/siniflar/[id]/PerformansWidget.tsx` | Sınıf özeti + riskli öğrenciler |
| `supabase/migrations/20260526000000_teacher_activity_log.sql` | Aktivite log tablosu |
| `supabase/migrations/20260526000001_student_risk_history.sql` | Risk geçmişi tablosu |
| `tests/unit/dashboard/risk.test.ts` | Saf fonksiyon testleri |
| `tests/unit/dashboard/service.test.ts` | Service unit testleri |

---

## Service API

```typescript
// src/domains/dashboard/service.ts

class TeacherDashboardService {
  getDashboardMetrics(teacherId: string): Promise<DashboardMetrics>
  // Döner: bugünkü ödev sayısı, toplam eksik, aktif risk sayısı
  //        bu hafta: teslim edilen, ort. tamamlanma %, yeni risk sayısı

  getRiskAlerts(teacherId: string): Promise<RiskAlert[]>
  // Döner: riskLevel ('high'|'medium'|'low'), nedenler listesi
  // Yan etki: student_risk_history'ye snapshot yazar

  getClassSummary(classId: string, teacherId: string): Promise<ClassSummary | null>
  // Döner: ort. tamamlanma %, yüksek risk sayısı, toplam eksik, riskli öğrenciler
  // Döner null: sınıf bulunamazsa (widget render edilmez)

  logActivity(teacherId: string, action: string, meta?: object): Promise<void>
  // Fire-and-forget — hata fırlatmaz, dashboard bloke olmaz
}
```

## Risk Algoritması (`src/domains/dashboard/risk.ts`)

```typescript
// Girdiler: son 5 ödev miss sayısı + son 14 gün devamsızlık sayısı
// Faktörler: SADECE ödev + devamsızlık (notlar Faz 2'de eklenir)

computeRiskLevel(hwMisses: number, absences: number): 'high' | 'medium' | 'low'
// hwMisses >= 3 || absences >= 3 → 'high'
// hwMisses >= 2 || absences >= 2 → 'medium'
// aksi halde               → 'low'

computeRiskScore(hwMisses: number, absences: number): number // 0-100
// Ağırlık: hw %60 + devamsızlık %40
```

---

## DB Şema

### `teacher_activity_log`

```sql
CREATE TABLE teacher_activity_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id   uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  action      text NOT NULL,
  meta        jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON teacher_activity_log (teacher_id, created_at DESC);
-- RLS: öğretmen kendi kayıtlarını okur ve insert yapar
```

### `student_risk_history`

```sql
CREATE TABLE student_risk_history (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id    uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  risk_level   text NOT NULL CHECK (risk_level IN ('high','medium','low')),
  risk_score   smallint NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  hw_misses    smallint NOT NULL DEFAULT 0,
  absences     smallint NOT NULL DEFAULT 0,
  snapshot_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON student_risk_history (student_id, snapshot_at DESC);
CREATE INDEX ON student_risk_history (teacher_id, snapshot_at DESC);
-- RLS: öğretmen kendi sınıflarının geçmişini okur ve insert yapar
```

---

## UI Tasarımı

### Dashboard (`/anasayfa`) — Layout C

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  3           │  │  11          │  │  2           │
│  Bugünkü ödev│  │  Toplam eksik│  │  Aktif risk  │
└──────────────┘  └──────────────┘  └──────────────┘

┌─────────────────────────────────────────────────────┐
│ Bu Hafta  │  12 teslim  │  %83 ort.  │  3 yeni risk │
└─────────────────────────────────────────────────────┘

┌──────────────────────────┐  ┌───────────┐
│ Bugün ve Yaklaşan        │  │ Takvim    │
├──────────────────────────┤  │           │
│ Risk Uyarıları           │  │           │
└──────────────────────────┘  └───────────┘
```

### Sınıf Detay (`/siniflar/[id]`) — PerformansWidget

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  %74         │  │  2           │  │  8           │
│  Ort. tamam. │  │  Yüksek risk │  │  Toplam eksik│
└──────────────┘  └──────────────┘  └──────────────┘

⚠ Dikkat Gerektiren Öğrenciler
┌─────────────────────────────────────────────────────┐
│ Can Demir   [Yüksek Risk]                           │
│ 3 eksik ödev · 5 gün devamsız                      │
├─────────────────────────────────────────────────────┤
│ Zeynep Kaya [Orta Risk]                             │
│ 2 eksik ödev                                        │
└─────────────────────────────────────────────────────┘

… mevcut öğrenci listesi (değişmez) …
```

---

## Hata Yönetimi

| Senaryo | Davranış |
|---|---|
| Service DB hatası | `throw` eder — Next.js `error.tsx` yakalar |
| `logActivity` hatası | Sessiz geçer (`console.error`) |
| `student_risk_history` yazma hatası | Risk uyarıları gösterilir, persist olmaz |
| Boş veri | Mevcut empty-state UI'lar korunur |
| Sınıf bulunamazsa | `getClassSummary` → `null`, widget render edilmez |

---

## Test Planı

```
tests/unit/dashboard/
  risk.test.ts
    ✓ computeRiskLevel(3, 0) → 'high'
    ✓ computeRiskLevel(2, 1) → 'medium'
    ✓ computeRiskLevel(1, 0) → 'low'
    ✓ computeRiskLevel(0, 0) → 'low' (alert üretilmez ama hesaplanır)
    ✓ computeRiskScore — ağırlıklı hesap doğru

  service.test.ts
    ✓ getDashboardMetrics — bugün / haftalık metrikler doğru
    ✓ getRiskAlerts — risk hesaplar + history'ye yazar
    ✓ logActivity — hata fırlatmaz
    ✓ getClassSummary — sadece riskli öğrenciler döner
```

E2E testler Faz 1 tamamlandığında Playwright ile eklenir.

---

## Kapsam Dışı (Bu Sprint)

- Not ortalaması risk faktörü → Faz 2
- Cron job (günlük risk batch) → Faz 2
- `/dashboard` route → `/anasayfa` kalır
- Gamification / streak → Faz 3
