-- ── daily_plans ──────────────────────────────────────────────────────────────
CREATE TABLE daily_plans (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id        uuid        NOT NULL REFERENCES schools(id)    ON DELETE CASCADE,
  class_id         uuid        NOT NULL REFERENCES classes(id)    ON DELETE CASCADE,
  plan_date        date        NOT NULL,
  lesson_hour      smallint    NOT NULL CHECK (lesson_hour BETWEEN 1 AND 8),
  unit             text        NOT NULL,
  topic            text        NOT NULL,
  objectives       text[]      NOT NULL DEFAULT '{}',
  methods          text[]      NOT NULL DEFAULT '{}',
  materials        text[]      NOT NULL DEFAULT '{}',
  intro_text       text        NOT NULL,
  development_text text        NOT NULL,
  conclusion_text  text        NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

CREATE INDEX ON daily_plans (teacher_id, plan_date DESC);
CREATE INDEX ON daily_plans (school_id, class_id);

ALTER TABLE daily_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_plans_own_select" ON daily_plans
  FOR SELECT USING (teacher_id = auth.uid() AND school_id = current_school_id() AND deleted_at IS NULL);

CREATE POLICY "daily_plans_own_insert" ON daily_plans
  FOR INSERT WITH CHECK (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "daily_plans_own_update" ON daily_plans
  FOR UPDATE USING (teacher_id = auth.uid() AND school_id = current_school_id());

-- ── annual_plans ─────────────────────────────────────────────────────────────
CREATE TABLE annual_plans (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id     uuid        NOT NULL REFERENCES schools(id)    ON DELETE CASCADE,
  academic_year text        NOT NULL,
  subject       text        NOT NULL,
  weekly_plan   jsonb       NOT NULL DEFAULT '[]',
  approved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ON annual_plans (teacher_id, academic_year, subject);

ALTER TABLE annual_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "annual_plans_own_select" ON annual_plans
  FOR SELECT USING (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "annual_plans_own_insert" ON annual_plans
  FOR INSERT WITH CHECK (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "annual_plans_own_update" ON annual_plans
  FOR UPDATE USING (teacher_id = auth.uid() AND school_id = current_school_id());

-- ── sok_reports ───────────────────────────────────────────────────────────────
CREATE TABLE sok_reports (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id     uuid        NOT NULL REFERENCES schools(id)    ON DELETE CASCADE,
  class_id      uuid        NOT NULL REFERENCES classes(id)    ON DELETE CASCADE,
  meeting_date  date        NOT NULL,
  term          smallint    NOT NULL CHECK (term IN (1, 2)),
  academic_year text        NOT NULL,
  participants  jsonb       NOT NULL DEFAULT '[]',
  agenda_items  jsonb       NOT NULL DEFAULT '[]',
  decisions     jsonb       NOT NULL DEFAULT '[]',
  student_notes jsonb       NOT NULL DEFAULT '[]',
  created_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

CREATE INDEX ON sok_reports (teacher_id, meeting_date DESC);

ALTER TABLE sok_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sok_reports_own_select" ON sok_reports
  FOR SELECT USING (teacher_id = auth.uid() AND school_id = current_school_id() AND deleted_at IS NULL);

CREATE POLICY "sok_reports_own_insert" ON sok_reports
  FOR INSERT WITH CHECK (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "sok_reports_own_update" ON sok_reports
  FOR UPDATE USING (teacher_id = auth.uid() AND school_id = current_school_id());

-- ── notebook_checks ───────────────────────────────────────────────────────────
CREATE TABLE notebook_checks (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id   uuid        NOT NULL REFERENCES schools(id)    ON DELETE CASCADE,
  class_id    uuid        NOT NULL REFERENCES classes(id)    ON DELETE CASCADE,
  check_date  date        NOT NULL,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON notebook_checks (teacher_id, check_date DESC);

ALTER TABLE notebook_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notebook_checks_own_select" ON notebook_checks
  FOR SELECT USING (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "notebook_checks_own_insert" ON notebook_checks
  FOR INSERT WITH CHECK (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "notebook_checks_own_update" ON notebook_checks
  FOR UPDATE USING (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "notebook_checks_own_delete" ON notebook_checks
  FOR DELETE USING (teacher_id = auth.uid() AND school_id = current_school_id());
