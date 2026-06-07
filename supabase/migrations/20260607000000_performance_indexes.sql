-- Phase 8 — Performance Indexes (Phase 9 ile güncellendi)
--
-- Analiz sonucu: homeworks(teacher+school), attendance(class+date), students(class+school)
-- için eşdeğer index'ler DB'de zaten mevcuttu (migration dosyalarına yansımamış).
-- Bu migration yalnızca gerçekten eksik olan 2 index'i ekler.
--
-- KORUNAN mevcut index'ler (DROP edilmedi):
--   idx_homeworks_active                — (teacher_id, school_id, due_date DESC) WHERE deleted_at IS NULL
--   attendance_class_date_idx           — (class_id, date)
--   idx_attendance_class_teacher_date   — (class_id, teacher_id, date DESC)
--   idx_students_active                 — (class_id, school_id) WHERE deleted_at IS NULL

-- ─── homeworks ────────────────────────────────────────────────────────────────

-- Sınıf bazlı ödev sorguları: getClassSubmissions iç sorgu, findStudentHomeworkProfile
-- WHERE class_id = X AND school_id = X AND deleted_at IS NULL ORDER BY due_date DESC
-- (Mevcut idx_homeworks_class_id ve idx_homeworks_school_class_date'i supersede eder)
CREATE INDEX IF NOT EXISTS idx_homeworks_class_school_due
  ON homeworks (class_id, school_id, due_date DESC)
  WHERE deleted_at IS NULL;

-- ─── attendance ───────────────────────────────────────────────────────────────

-- Müdür okul geneli devamsızlık sorgusu: getAbsentYearRows
-- WHERE school_id = X AND status IN ('absent','late') AND date >= yearStart LIMIT 15000
-- Partial: sadece 'absent' ve 'late' satırları → ~%40 daha küçük index
CREATE INDEX IF NOT EXISTS idx_attendance_school_date
  ON attendance (school_id, date DESC)
  WHERE status IN ('absent', 'late');
