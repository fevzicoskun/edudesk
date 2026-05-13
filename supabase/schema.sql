-- Supabase SQL Schema
-- Run in Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── TABLES ───────────────────────────────────────────────────────────────────

CREATE TABLE profiles (
  id         UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name  TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'ogretmen' CHECK (role IN ('zumre_baskani', 'ogretmen')),
  subject    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE classes (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT NOT NULL,           -- "9-A", "10-B"
  grade         INTEGER NOT NULL CHECK (grade BETWEEN 5 AND 12),
  academic_year TEXT NOT NULL DEFAULT '2024-2025',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE students (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id       UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  full_name      TEXT NOT NULL,
  student_number TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE teacher_classes (
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id   UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  PRIMARY KEY (teacher_id, class_id)
);

CREATE TABLE homeworks (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id    UUID NOT NULL REFERENCES profiles(id),
  class_id      UUID NOT NULL REFERENCES classes(id),
  title         TEXT NOT NULL,
  description   TEXT,
  subject       TEXT NOT NULL,
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date      DATE NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE homework_submissions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  homework_id UUID NOT NULL REFERENCES homeworks(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'yapilmadi'
                CHECK (status IN ('yapildi', 'eksik', 'yapilmadi', 'gec', 'mazeretli')),
  note        TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (homework_id, student_id)
);

CREATE TABLE zumre_meetings (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title        TEXT NOT NULL,
  meeting_date DATE NOT NULL,
  notes        TEXT,
  created_by   UUID NOT NULL REFERENCES profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE common_exams (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title      TEXT NOT NULL,
  exam_date  DATE NOT NULL,
  subject    TEXT NOT NULL,
  grades     INTEGER[],
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE curriculum_progress (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id      UUID NOT NULL REFERENCES profiles(id),
  class_id        UUID NOT NULL REFERENCES classes(id),
  outcome_id      TEXT,
  topic           TEXT NOT NULL,
  week_number     INTEGER,
  status          TEXT NOT NULL DEFAULT 'tamamlandi'
                    CHECK (status IN ('tamamlandi', 'tekrar_gerekli', 'eksik_kaldi')),
  completed       BOOLEAN NOT NULL DEFAULT FALSE,
  completion_date DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Çalıştırmak için: Supabase Dashboard > SQL Editor
CREATE TABLE IF NOT EXISTS attendance (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES profiles(id),
  class_id   UUID NOT NULL REFERENCES classes(id),
  student_id UUID NOT NULL REFERENCES students(id),
  date       DATE NOT NULL,
  status     TEXT NOT NULL DEFAULT 'present'
               CHECK (status IN ('present', 'absent', 'late', 'excused')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_id, student_id, date)
);
CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON attendance(class_id, date);
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance_own" ON attendance FOR ALL TO authenticated
  USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "attendance_public_read" ON attendance FOR SELECT TO anon USING (true);

CREATE TABLE user_notes (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT 'Yeni Not',
  content    TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_notes_user ON user_notes(user_id, updated_at DESC);

-- ─── INDEXES ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_homeworks_teacher_id  ON homeworks(teacher_id);
CREATE INDEX idx_homeworks_due_date    ON homeworks(due_date DESC);
CREATE INDEX idx_homeworks_class_id    ON homeworks(class_id);
CREATE INDEX idx_students_class_id     ON students(class_id);
-- homework_submissions(homework_id) already covered by UNIQUE(homework_id, student_id)
CREATE INDEX idx_hw_submissions_student ON homework_submissions(student_id);

-- ─── TRIGGERS ─────────────────────────────────────────────────────────────────

-- Auto-create profile when user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role, subject)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'ogretmen'),
    NEW.raw_user_meta_data->>'subject'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-create submissions for all students when homework is assigned
CREATE OR REPLACE FUNCTION create_submissions_for_homework()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO homework_submissions (homework_id, student_id)
  SELECT NEW.id, s.id
  FROM students s
  WHERE s.class_id = NEW.class_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_homework_created
  AFTER INSERT ON homeworks
  FOR EACH ROW EXECUTE FUNCTION create_submissions_for_homework();

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────

ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE students            ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_classes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE homeworks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE zumre_meetings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE common_exams        ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notes           ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "profiles_read_all"  ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Classes & Students (all authenticated teachers can read/write)
CREATE POLICY "classes_all"  ON classes  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "students_all" ON students FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Teacher-class assignments
CREATE POLICY "tc_all" ON teacher_classes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Homeworks: anyone reads, only owner modifies
CREATE POLICY "hw_read"   ON homeworks FOR SELECT TO authenticated USING (true);
CREATE POLICY "hw_insert" ON homeworks FOR INSERT TO authenticated WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "hw_update" ON homeworks FOR UPDATE TO authenticated USING (auth.uid() = teacher_id);
CREATE POLICY "hw_delete" ON homeworks FOR DELETE TO authenticated USING (auth.uid() = teacher_id);

-- Submissions: anyone reads, authenticated users update
CREATE POLICY "sub_read"   ON homework_submissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "sub_insert" ON homework_submissions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sub_update" ON homework_submissions FOR UPDATE TO authenticated USING (true);

-- Zumre, exams, curriculum
CREATE POLICY "meetings_all"   ON zumre_meetings      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "exams_all"      ON common_exams         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "curriculum_all" ON curriculum_progress  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- User notes: users can only read/write their own
CREATE POLICY "notes_own" ON user_notes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
