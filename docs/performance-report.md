# Performans Analiz Raporu

**Analiz tarihi:** 2026-06-14
**Kapsam:** anasayfa (rol bazlı), odevler, odevler/sinif/[classId], yoklama, yoklama/cizelge, rapor/devamsizlik, rapor/ogretmen-aktivite, platform
**Yöntem:** Supabase MCP (advisors + EXPLAIN ANALYZE), Chrome DevTools Lighthouse, statik sorgu denetimi
**Supabase proje ID:** agijvfrcudpzsofgfogu

> ⚠️ Bu rapor 2026-05-19 tarihli önceki raporun yerini alır. Eski rapor **superseded**:
> referans verdiği tüm dosyalar (DersProgramiWidget, MudurDashboard, MudurYardimcisiDashboard,
> MentorSinifimWidget, raporlar/mentor, raporlar/ogrenci, src/shared/perf) sonraki
> refactor'larda silinmişti ve önerileri uygulanamıyordu.

---

## 1. Veritabanı Katmanı

_Ölçüm tarihi: 2026-06-14 — Supabase MCP (proje: agijvfrcudpzsofgfogu)_

### Advisor Bulguları

Supabase `get_advisors` (type: "performance") sonuçları — toplam **242 bulgu**:

| Tür | Seviye | Sayı | Özet |
|-----|--------|------|------|
| `auth_rls_initplan` | WARN | 99 | RLS politikalarında `auth.<function>()` / `current_setting()` her satır için yeniden değerlendiriliyor |
| `multiple_permissive_policies` | WARN | 70 | Aynı tablo+rol+aksiyon için birden fazla permissive policy (her sorgu tüm policy'leri çalıştırıyor) |
| `unindexed_foreign_keys` | INFO | 54 | Yabancı anahtar kısıtı olan 54 kolon için covering index yok |
| `unused_index` | INFO | 14 | Hiç kullanılmamış 14 index |
| `duplicate_index` | WARN | 5 | Birbiriyle özdeş 5 index çifti |

**En kritik RLS initplan tabloları** (yüksek trafik beklentisi):

- `attendance`: `attendance_delete`, `attendance_teacher_write`, `attendance_teacher_update`
- `homeworks`: `homeworks_owner_insert`, `homeworks_owner_delete`, `homeworks_owner_update`
- `homework_submissions`: `submissions_owner_delete`, `submissions_owner_upsert`, `submissions_owner_update`
- `profiles`: `profiles_school_read`, `profiles_update_own`, `profiles_self_update`
- `students`: (multiple_permissive_policies — `students_manager_read_deleted` + `students_school_read`)

**Düzeltme:** `auth.uid()` → `(select auth.uid())` şeklinde sarılmalı. [Supabase docs](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan)

**Çakışan (duplicate) indexler:**

| Tablo | Özdeş index çifti |
|-------|-------------------|
| `classes` | `idx_classes_active` = `idx_classes_school_grade` |
| `export_jobs` | `export_jobs_user_status` = `idx_export_jobs_user_status` |
| `homework_submissions` | `idx_homework_submissions_student_id` = `idx_hw_submissions_student` |
| `homeworks` | `homeworks_teacher_id_idx` = `idx_homeworks_teacher_id` |
| `permissions` | `permissions_resource_action_scope_key` = `uq_permissions_ras` |

**Kullanılmayan indexler (örnekler — hot tablolardan):**

- `classes`: `idx_classes_active` (aynı zamanda duplicate)

---

### Index Envanteri

Sorgulanan tablolar: `attendance`, `homeworks`, `homework_submissions`, `students`, `classes`, `profiles`

**Hot filtreler ve index durumu:**

| Hot filtre | Mevcut index | Durum |
|------------|-------------|-------|
| `attendance(school_id, date, status='absent')` | `idx_attendance_school_date` — `btree(school_id, date DESC) WHERE status IN ('absent','late')` | **VAR** (partial index, status filtresi kapsıyor) |
| `attendance(school_id)` | `idx_attendance_school_id` — `btree(school_id)` | **VAR** |
| `attendance(student_id, school_id, date)` | `idx_attendance_student_school_date` — `btree(student_id, school_id, date DESC)` | **VAR** |
| `homeworks(school_id, teacher_id)` | `idx_homeworks_teacher_school_date` — `btree(teacher_id, school_id, due_date DESC)` | **VAR** (sütun sırası ters — teacher_id önce) |
| `homeworks(school_id)` | `idx_homeworks_school_id` — `btree(school_id)` | **VAR** |
| `students(school_id)` | `idx_students_school_id` — `btree(school_id)` | **VAR** |
| `homework_submissions(student_id)` | `idx_homework_submissions_student_id` + `idx_hw_submissions_student` | **VAR** (ikisi özdeş — biri silinmeli) |

**Unindexed FK'ler (hot tablolarda):**

| Tablo | FK adı | Durum |
|-------|--------|-------|
| `attendance` | `attendance_teacher_id_fkey` | **EKSİK** index |
| `homeworks` | `homeworks_deleted_by_fkey`, `homeworks_source_id_fkey` | **EKSİK** index |
| `students` | `students_deleted_by_fkey` | **EKSİK** index |
| `classes` | `classes_created_by_fkey`, `classes_deleted_by_fkey`, `classes_mentor_teacher_id_fkey` | **EKSİK** index |

---

### EXPLAIN Sonuçları

**Sorgu 1 — `attendance` devamsızlık sorgusu (son 30 gün)**

```sql
EXPLAIN ANALYZE
SELECT student_id, class_id, date FROM attendance
WHERE school_id = '60bb727f-...' AND status = 'absent' AND date >= (CURRENT_DATE - 30);
```

| Metrik | Değer |
|--------|-------|
| Plan türü | **Index Scan** (`idx_attendance_school_id`) |
| Tahmini satır | 1 |
| Gerçek satır | 0 |
| Toplam süre | **1.37 ms** (planning: 6.12 ms) |

**Yorum:** Index Scan kullanıldı. Planlayıcı `idx_attendance_school_id` üzerinden `school_id` filtresini index'ten, `status` ve `date` filtrelerini tablo taramasıyla uyguluyor. Daha optimal olan partial index `idx_attendance_school_date` (`school_id, date DESC WHERE status IN ('absent','late')`) bu sorguda da kullanılabilir; test ortamında satır sayısı 0 olduğundan planlayıcı daha basit indexi seçti. Üretim verisinde partial index'in tercih edilmesi beklenir.

---

**Sorgu 2 — `homeworks` öğretmen+okul filtresi**

```sql
EXPLAIN ANALYZE
SELECT id FROM homeworks
WHERE school_id = '60bb727f-...' AND teacher_id = '6e2e59c9-...';
```

| Metrik | Değer |
|--------|-------|
| Plan türü | **Seq Scan** |
| Filtre | `school_id = ... AND teacher_id = ...` |
| Rows Removed by Filter | 13 |
| Gerçek satır | 0 |
| Toplam süre | **0.13 ms** (planning: 1.23 ms) |

**Yorum:** Seq Scan seçildi. Tabloda yalnızca 13 satır var; bu boyutta Seq Scan planlayıcı için daha ucuz. Ancak `idx_homeworks_teacher_school_date` (`teacher_id, school_id, due_date DESC`) mevcut — üretimde satır sayısı arttıkça (yüzlerce/binlerce kayıt) bu index devreye girecektir. Şu an için false-positive; izlenmeye devam edilmeli.

---

### Üretim Log Sinyali

`get_logs` (service: "postgres") sonuçları incelendi. Son 24 saatte:

- **Yavaş sorgu sinyali yok** — `slow query` veya `duration:` üzerinde eşik aşımı gösteren kayıt bulunamadı.
- Loglar yalnızca bağlantı açma/kapama (`connection received`, `connection authenticated`, `checkpoint`) ve entegrasyon testlerinden kaynaklanan RLS hatalarından (`new row violates row-level security policy`) oluşuyor.
- RLS hataları test koşumundan kaynaklanıyor (integration test suite); üretim trafiğini yansıtmıyor.

**Sonuç:** Anlamlı yavaş sorgu sinyali yok (düşük trafik / geliştirme ortamı).

## 2. Sunucu Sorgu Denetimi
_(Task 3)_

## 3. İstemci (Lighthouse)
_(Task 4)_

## 4. Önceliklendirilmiş Aksiyon Listesi
_(Task 5)_

## 5. Baseline Metrikler
_(Task 5)_

## 6. Yeniden Ölçüm Yönergesi
_(Task 5)_
