-- ============================================================
-- Baseline Migration: EduDesk tam şema (2026-05-16 snapshot)
-- DB'deki 17 migration'ın tamamını kapsar.
-- Taze bir Supabase projesinde supabase db push ile kurulum için.
-- CREATE IF NOT EXISTS + CREATE OR REPLACE — idempotent.
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ============================================================
-- TABLES (bağımlılık sırasına göre)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.schools (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  slug       TEXT        UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  TEXT        NOT NULL,
  role       TEXT        NOT NULL DEFAULT 'ogretmen'
                         CHECK (role = ANY (ARRAY['zumre_baskani', 'ogretmen'])),
  subject    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  school_id  UUID        REFERENCES public.schools(id)
);

CREATE TABLE IF NOT EXISTS public.classes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  grade         INTEGER     NOT NULL CHECK (grade >= 5 AND grade <= 12),
  academic_year TEXT        NOT NULL DEFAULT '2024-2025',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  school_id     UUID        NOT NULL REFERENCES public.schools(id)
);

CREATE TABLE IF NOT EXISTS public.teacher_classes (
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id   UUID NOT NULL REFERENCES public.classes(id)  ON DELETE CASCADE,
  PRIMARY KEY (teacher_id, class_id)
);

CREATE TABLE IF NOT EXISTS public.students (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id       UUID        NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  full_name      TEXT        NOT NULL,
  student_number TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  school_id      UUID        NOT NULL REFERENCES public.schools(id)
);

CREATE TABLE IF NOT EXISTS public.homeworks (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id      UUID        NOT NULL REFERENCES public.classes(id),
  title         TEXT        NOT NULL,
  description   TEXT,
  subject       TEXT        NOT NULL,
  assigned_date DATE        NOT NULL DEFAULT CURRENT_DATE,
  due_date      DATE        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  school_id     UUID        NOT NULL REFERENCES public.schools(id)
);

CREATE TABLE IF NOT EXISTS public.homework_submissions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id UUID        NOT NULL REFERENCES public.homeworks(id) ON DELETE CASCADE,
  student_id  UUID        NOT NULL REFERENCES public.students(id)  ON DELETE CASCADE,
  status      TEXT        NOT NULL DEFAULT 'yapilmadi'
                          CHECK (status = ANY (ARRAY['yapildi','eksik','yapilmadi','gec','mazeretli'])),
  note        TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  school_id   UUID        NOT NULL REFERENCES public.schools(id),
  UNIQUE (homework_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.attendance (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id   UUID        NOT NULL REFERENCES public.classes(id),
  student_id UUID        NOT NULL REFERENCES public.students(id),
  date       DATE        NOT NULL,
  status     TEXT        NOT NULL DEFAULT 'present'
                         CHECK (status = ANY (ARRAY['present','absent','late','excused'])),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  school_id  UUID        NOT NULL REFERENCES public.schools(id),
  UNIQUE (class_id, student_id, date)
);

CREATE TABLE IF NOT EXISTS public.curriculum_progress (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id        UUID        NOT NULL REFERENCES public.classes(id),
  outcome_id      TEXT,
  topic           TEXT        NOT NULL,
  week_number     INTEGER,
  status          TEXT        NOT NULL DEFAULT 'tamamlandi'
                              CHECK (status = ANY (ARRAY['tamamlandi','tekrar_gerekli','eksik_kaldi'])),
  completed       BOOLEAN     NOT NULL DEFAULT false,
  completion_date DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  school_id       UUID        NOT NULL REFERENCES public.schools(id)
);

CREATE TABLE IF NOT EXISTS public.common_exams (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT        NOT NULL,
  exam_date  DATE        NOT NULL,
  subject    TEXT        NOT NULL,
  grades     INTEGER[],
  created_by UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  grade_map  JSONB,
  school_id  UUID        NOT NULL REFERENCES public.schools(id)
);

CREATE TABLE IF NOT EXISTS public.zumre_meetings (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT        NOT NULL,
  meeting_date DATE        NOT NULL,
  notes        TEXT,
  created_by   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  school_id    UUID        NOT NULL REFERENCES public.schools(id)
);

-- student_notes: student_id kasıtlı olarak FK değil (veri modeli gereği)
CREATE TABLE IF NOT EXISTS public.student_notes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID        NOT NULL,
  student_id UUID        NOT NULL,
  body       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  school_id  UUID        NOT NULL REFERENCES public.schools(id)
);

CREATE TABLE IF NOT EXISTS public.user_notes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL DEFAULT 'Yeni Not',
  content    TEXT        NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  action      TEXT        NOT NULL,
  table_name  TEXT,
  record_id   UUID,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  TEXT,
  user_agent  TEXT,
  school_name TEXT
);

CREATE TABLE IF NOT EXISTS public.revoked_tokens (
  jti        TEXT        PRIMARY KEY,
  token_type TEXT        NOT NULL,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_by UUID        REFERENCES auth.users(id),
  reason     TEXT
);

CREATE TABLE IF NOT EXISTS public.export_jobs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  UUID        NOT NULL REFERENCES public.schools(id),
  user_id    UUID        NOT NULL REFERENCES auth.users(id),
  job_type   TEXT        NOT NULL
                         CHECK (job_type = ANY (ARRAY['excel_odevler','excel_yoklama','excel_mufredat','excel_notlar'])),
  status     TEXT        NOT NULL DEFAULT 'pending'
                         CHECK (status = ANY (ARRAY['pending','processing','done','error'])),
  params     JSONB       NOT NULL DEFAULT '{}',
  result_url TEXT,
  error_msg  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS attendance_class_date_idx        ON public.attendance           (class_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_class_date        ON public.attendance           (class_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_school_id         ON public.attendance           (school_id);

CREATE INDEX IF NOT EXISTS audit_logs_action_idx            ON public.audit_logs           (action);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx        ON public.audit_logs           (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_table_name_idx        ON public.audit_logs           (table_name);
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx           ON public.audit_logs           (user_id);

CREATE INDEX IF NOT EXISTS classes_academic_year_idx        ON public.classes              (academic_year);

CREATE INDEX IF NOT EXISTS idx_common_exams_school_id       ON public.common_exams         (school_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_school_id         ON public.curriculum_progress  (school_id);

CREATE INDEX IF NOT EXISTS export_jobs_user_status          ON public.export_jobs          (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_homework_submissions_homework_id ON public.homework_submissions (homework_id);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_student_id  ON public.homework_submissions (student_id);
CREATE INDEX IF NOT EXISTS idx_hw_submissions_student           ON public.homework_submissions (student_id);

CREATE INDEX IF NOT EXISTS homeworks_teacher_id_idx         ON public.homeworks            (teacher_id);
CREATE INDEX IF NOT EXISTS idx_homeworks_class_id           ON public.homeworks            (class_id);
CREATE INDEX IF NOT EXISTS idx_homeworks_due_date           ON public.homeworks            (due_date DESC);
CREATE INDEX IF NOT EXISTS idx_homeworks_school_id          ON public.homeworks            (school_id);
CREATE INDEX IF NOT EXISTS idx_homeworks_teacher_id         ON public.homeworks            (teacher_id);

CREATE INDEX IF NOT EXISTS idx_profiles_school_id           ON public.profiles             (school_id);

CREATE INDEX IF NOT EXISTS idx_student_notes_school_id      ON public.student_notes        (school_id);
CREATE INDEX IF NOT EXISTS idx_student_notes_student        ON public.student_notes        (student_id);

CREATE INDEX IF NOT EXISTS idx_students_class_id            ON public.students             (class_id);
CREATE INDEX IF NOT EXISTS idx_students_school_id           ON public.students             (school_id);

CREATE INDEX IF NOT EXISTS idx_teacher_classes_teacher_id   ON public.teacher_classes      (teacher_id);
CREATE INDEX IF NOT EXISTS idx_user_notes_user              ON public.user_notes           (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_zumre_meetings_school_id     ON public.zumre_meetings       (school_id);

-- ============================================================
-- FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_school_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT school_id FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_zumre_baskani()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS(
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'zumre_baskani'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_zumre_baskani_in_school()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'zumre_baskani'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_school_member(p_school_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND school_id = p_school_id
  )
$$;

CREATE OR REPLACE FUNCTION public.find_school_by_slug(p_slug TEXT)
RETURNS TABLE(id UUID, name TEXT) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT s.id, s.name
  FROM schools s
  WHERE s.slug = p_slug
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'ogretmen'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    -- Sadece onboarding sırasında (school_id null → değer) baskan atamasına izin ver
    IF OLD.school_id IS NULL AND NEW.school_id IS NOT NULL AND NEW.role = 'zumre_baskani' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'role değiştirme yetkisi yok';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_submissions_for_homework()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO homework_submissions (homework_id, student_id, school_id)
  SELECT NEW.id, s.id, NEW.school_id
  FROM students s
  WHERE s.class_id = NEW.class_id;
  RETURN NEW;
END;
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Yeni auth kullanıcısı → profiles satırı oluştur
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ödev INSERT → sınıftaki tüm öğrenciler için submission oluştur
DROP TRIGGER IF EXISTS on_homework_created ON public.homeworks;
CREATE TRIGGER on_homework_created
  AFTER INSERT ON public.homeworks
  FOR EACH ROW EXECUTE FUNCTION public.create_submissions_for_homework();

-- Role değişikliğini engelle
DROP TRIGGER IF EXISTS profiles_role_lock ON public.profiles;
CREATE TRIGGER profiles_role_lock
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();

-- ============================================================
-- ROW LEVEL SECURITY — enable
-- ============================================================

ALTER TABLE public.schools             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_classes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homeworks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.common_exams        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zumre_meetings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_notes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revoked_tokens      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_jobs         ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- schools
CREATE POLICY "schools_member_read" ON public.schools FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.school_id = schools.id
  ));
CREATE POLICY "schools_authenticated_insert" ON public.schools FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "schools_baskan_update" ON public.schools FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.school_id = schools.id AND profiles.role = 'zumre_baskani'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.school_id = schools.id AND profiles.role = 'zumre_baskani'
  ));

-- profiles
CREATE POLICY "profiles_school_read" ON public.profiles FOR SELECT
  USING (auth.uid() = id OR (school_id IS NOT NULL AND school_id = current_school_id()));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);

-- classes
CREATE POLICY "classes_school_read" ON public.classes FOR SELECT TO authenticated
  USING (school_id = current_school_id());
CREATE POLICY "classes_baskan_insert" ON public.classes FOR INSERT TO authenticated
  WITH CHECK (school_id = current_school_id() AND is_zumre_baskani_in_school());
CREATE POLICY "classes_baskan_delete" ON public.classes FOR DELETE TO authenticated
  USING (school_id = current_school_id() AND is_zumre_baskani_in_school());

-- teacher_classes
CREATE POLICY "tc_school_read" ON public.teacher_classes FOR SELECT
  USING (EXISTS (SELECT 1 FROM classes c WHERE c.id = teacher_classes.class_id AND c.school_id = current_school_id()));
CREATE POLICY "tc_school_write" ON public.teacher_classes FOR ALL
  USING (EXISTS (SELECT 1 FROM classes c WHERE c.id = teacher_classes.class_id AND c.school_id = current_school_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM classes c WHERE c.id = teacher_classes.class_id AND c.school_id = current_school_id()));

-- students
CREATE POLICY "students_school_read"   ON public.students FOR SELECT TO authenticated USING (school_id = current_school_id());
CREATE POLICY "students_school_insert" ON public.students FOR INSERT TO authenticated WITH CHECK (school_id = current_school_id());
CREATE POLICY "students_school_delete" ON public.students FOR DELETE TO authenticated USING (school_id = current_school_id());

-- homeworks
CREATE POLICY "homeworks_school_read"   ON public.homeworks FOR SELECT TO authenticated USING (school_id = current_school_id());
CREATE POLICY "homeworks_owner_insert"  ON public.homeworks FOR INSERT TO authenticated WITH CHECK (school_id = current_school_id() AND teacher_id = auth.uid());
CREATE POLICY "homeworks_owner_delete"  ON public.homeworks FOR DELETE TO authenticated USING (school_id = current_school_id() AND (teacher_id = auth.uid() OR is_zumre_baskani_in_school()));

-- homework_submissions
CREATE POLICY "submissions_school_read"   ON public.homework_submissions FOR SELECT TO authenticated USING (school_id = current_school_id());
CREATE POLICY "submissions_owner_upsert"  ON public.homework_submissions FOR INSERT TO authenticated WITH CHECK (school_id = current_school_id());
CREATE POLICY "submissions_owner_update"  ON public.homework_submissions FOR UPDATE TO authenticated
  USING (school_id = current_school_id()) WITH CHECK (school_id = current_school_id());

-- attendance
CREATE POLICY "attendance_school_read"    ON public.attendance FOR SELECT TO authenticated USING (school_id = current_school_id());
CREATE POLICY "attendance_teacher_write"  ON public.attendance FOR INSERT TO authenticated WITH CHECK (school_id = current_school_id() AND teacher_id = auth.uid());
CREATE POLICY "attendance_teacher_update" ON public.attendance FOR UPDATE TO authenticated
  USING (school_id = current_school_id() AND teacher_id = auth.uid())
  WITH CHECK (school_id = current_school_id() AND teacher_id = auth.uid());
CREATE POLICY "attendance_delete"         ON public.attendance FOR DELETE
  USING (school_id = current_school_id() AND (teacher_id = auth.uid() OR is_zumre_baskani_in_school()));

-- curriculum_progress
CREATE POLICY "curriculum_school_read"    ON public.curriculum_progress FOR SELECT TO authenticated
  USING (school_id = current_school_id() AND (teacher_id = auth.uid() OR is_zumre_baskani_in_school()));
CREATE POLICY "curriculum_teacher_insert" ON public.curriculum_progress FOR INSERT TO authenticated
  WITH CHECK (school_id = current_school_id() AND teacher_id = auth.uid());
CREATE POLICY "curriculum_teacher_update" ON public.curriculum_progress FOR UPDATE TO authenticated
  USING (school_id = current_school_id() AND teacher_id = auth.uid())
  WITH CHECK (school_id = current_school_id() AND teacher_id = auth.uid());
CREATE POLICY "curriculum_delete"         ON public.curriculum_progress FOR DELETE
  USING (school_id = current_school_id() AND (teacher_id = auth.uid() OR is_zumre_baskani_in_school()));

-- common_exams
CREATE POLICY "exams_school_read"    ON public.common_exams FOR SELECT TO authenticated USING (school_id = current_school_id());
CREATE POLICY "exams_baskan_insert"  ON public.common_exams FOR INSERT TO authenticated WITH CHECK (school_id = current_school_id() AND is_zumre_baskani_in_school() AND created_by = auth.uid());
CREATE POLICY "exams_baskan_update"  ON public.common_exams FOR UPDATE TO authenticated USING (school_id = current_school_id()) WITH CHECK (school_id = current_school_id());
CREATE POLICY "exams_baskan_delete"  ON public.common_exams FOR DELETE TO authenticated USING (school_id = current_school_id() AND is_zumre_baskani_in_school());

-- zumre_meetings
CREATE POLICY "meetings_school_read"    ON public.zumre_meetings FOR SELECT TO authenticated USING (school_id = current_school_id());
CREATE POLICY "meetings_baskan_insert"  ON public.zumre_meetings FOR INSERT TO authenticated WITH CHECK (school_id = current_school_id() AND is_zumre_baskani_in_school() AND created_by = auth.uid());
CREATE POLICY "meetings_baskan_update"  ON public.zumre_meetings FOR UPDATE TO authenticated
  USING (school_id = current_school_id() AND is_zumre_baskani_in_school())
  WITH CHECK (school_id = current_school_id() AND is_zumre_baskani_in_school());
CREATE POLICY "meetings_baskan_delete"  ON public.zumre_meetings FOR DELETE TO authenticated USING (school_id = current_school_id() AND is_zumre_baskani_in_school());

-- student_notes
CREATE POLICY "student_notes_school_read"    ON public.student_notes FOR SELECT TO authenticated USING (school_id = current_school_id());
CREATE POLICY "student_notes_teacher_insert" ON public.student_notes FOR INSERT TO authenticated WITH CHECK (school_id = current_school_id() AND teacher_id = auth.uid());
CREATE POLICY "student_notes_teacher_delete" ON public.student_notes FOR DELETE TO authenticated USING (school_id = current_school_id() AND teacher_id = auth.uid());

-- user_notes
CREATE POLICY "notes_own" ON public.user_notes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- audit_logs
CREATE POLICY "audit_logs_authenticated_insert" ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "audit_logs_baskan_read" ON public.audit_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'zumre_baskani'));

-- revoked_tokens
CREATE POLICY "revoked_tokens_server_read"   ON public.revoked_tokens FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "revoked_tokens_baskan_insert" ON public.revoked_tokens FOR INSERT TO authenticated WITH CHECK (is_zumre_baskani_in_school());
CREATE POLICY "revoked_tokens_baskan_delete" ON public.revoked_tokens FOR DELETE TO authenticated USING (is_zumre_baskani_in_school());

-- export_jobs
CREATE POLICY "export_jobs_school_read"   ON public.export_jobs FOR SELECT TO authenticated USING (school_id = current_school_id() AND user_id = auth.uid());
CREATE POLICY "export_jobs_school_insert" ON public.export_jobs FOR INSERT TO authenticated WITH CHECK (school_id = current_school_id() AND user_id = auth.uid());
CREATE POLICY "export_jobs_school_update" ON public.export_jobs FOR UPDATE TO authenticated
  USING (school_id = current_school_id() AND user_id = auth.uid())
  WITH CHECK (school_id = current_school_id() AND user_id = auth.uid());
