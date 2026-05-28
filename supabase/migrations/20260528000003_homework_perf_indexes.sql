-- Composite partial index: findHomeworkDates sorgusunu O(W)'e düşürür
-- (teacher_id, school_id, assigned_date) üçlüsü + partial WHERE deleted_at IS NULL AND source_id IS NOT NULL
CREATE INDEX idx_homeworks_source_lookup
  ON homeworks (teacher_id, school_id, assigned_date DESC)
  WHERE deleted_at IS NULL AND source_id IS NOT NULL;

-- Covering index: (teacher_id, school_id, active, name) — ORDER BY name için ayrı sort adımını kaldırır
DROP INDEX IF EXISTS idx_homework_sources_teacher;
CREATE INDEX idx_homework_sources_teacher
  ON homework_sources (teacher_id, school_id, active, name);
