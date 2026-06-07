-- Phase 8 — Performance Indexes
-- Hedef sorgular:
--   homeworks:            getTeacherHomeworks, getClassSubmissions (iç sorgu), findStudentHomeworkProfile
--   attendance:           getAttendanceRows, getTodayClassAttendance, getAttendanceTrend, getAbsentYearRows
--   students:             getStudentsByClasses
-- Mevcut (korunuyor):
--   homework_submissions: UNIQUE(homework_id, student_id) → IN(hwIds) sorgularını karşılıyor
--   attendance:           UNIQUE(class_id, student_id, date) → upsert conflict target

-- ─── homeworks ────────────────────────────────────────────────────────────────

-- Dashboard ana sorgusu: getTeacherHomeworks
-- WHERE teacher_id = X AND school_id = X AND deleted_at IS NULL ORDER BY due_date DESC
CREATE INDEX IF NOT EXISTS idx_homeworks_teacher_school_due
  ON homeworks (teacher_id, school_id, due_date DESC)
  WHERE deleted_at IS NULL;

-- Sınıf bazlı ödev sorguları: getClassSubmissions iç sorgu, findStudentHomeworkProfile
-- WHERE class_id = X AND school_id = X AND deleted_at IS NULL ORDER BY due_date DESC
CREATE INDEX IF NOT EXISTS idx_homeworks_class_school_due
  ON homeworks (class_id, school_id, due_date DESC)
  WHERE deleted_at IS NULL;

-- ─── attendance ───────────────────────────────────────────────────────────────

-- Dashboard yoklama sorguları:
--   getAttendanceRows:        class_id IN (...) AND teacher_id = X AND date >= X
--   getTodayClassAttendance:  class_id IN (...) AND date = today
--   getAttendanceTrend:       class_id IN (...) AND date >= X ORDER BY date
-- Mevcut UNIQUE(class_id, student_id, date) var; bu (class_id, date) filtresi için daha seçici
CREATE INDEX IF NOT EXISTS idx_attendance_class_date
  ON attendance (class_id, date);

-- Müdür okul geneli devamsızlık sorgusu: getAbsentYearRows
-- WHERE school_id = X AND status IN ('absent','late') AND date >= yearStart LIMIT 15000
CREATE INDEX IF NOT EXISTS idx_attendance_school_date
  ON attendance (school_id, date DESC)
  WHERE status IN ('absent', 'late');

-- ─── students ─────────────────────────────────────────────────────────────────

-- Dashboard öğrenci listesi: getStudentsByClasses
-- WHERE class_id IN (...) AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_students_class_school
  ON students (class_id, school_id)
  WHERE deleted_at IS NULL;
