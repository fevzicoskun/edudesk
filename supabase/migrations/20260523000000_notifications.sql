-- 1. students tablosuna veli_email sütunu
ALTER TABLE students ADD COLUMN IF NOT EXISTS veli_email TEXT;

-- 2. Bildirim tercihleri (öğretmen başına)
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  days_before  SMALLINT NOT NULL DEFAULT 1 CHECK (days_before BETWEEN 1 AND 7),
  email_on     BOOLEAN  NOT NULL DEFAULT true,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kullanici kendi tercihlerini okuyabilir"
  ON notification_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Kullanici kendi tercihlerini yazabilir"
  ON notification_preferences FOR ALL
  USING (user_id = auth.uid());

-- 3. In-app bildirimler
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id   UUID        NOT NULL,
  title       TEXT        NOT NULL,
  body        TEXT,
  homework_id UUID        REFERENCES homeworks(id) ON DELETE CASCADE,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kullanici kendi bildirimlerini okuyabilir"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Kullanici kendi bildirimlerini guncelleyebilir"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Service role insert için policy (cron job)
CREATE POLICY "Service role bildirim ekleyebilir"
  ON notifications FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS notifications_user_unread
  ON notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;
