-- Perf raporu #6: sıcak tablolarda index'siz FK kolonlarına covering index ekle.
-- Nullable audit/opsiyonel FK'ler için partial index (NULL satırlar RI/eşitlik aramalarında gereksiz).
CREATE INDEX IF NOT EXISTS idx_attendance_teacher_id ON public.attendance (teacher_id);
CREATE INDEX IF NOT EXISTS idx_classes_created_by ON public.classes (created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_classes_deleted_by ON public.classes (deleted_by) WHERE deleted_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_classes_mentor_teacher_id ON public.classes (mentor_teacher_id) WHERE mentor_teacher_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_homeworks_deleted_by ON public.homeworks (deleted_by) WHERE deleted_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_homeworks_source_id ON public.homeworks (source_id) WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_students_deleted_by ON public.students (deleted_by) WHERE deleted_by IS NOT NULL;
