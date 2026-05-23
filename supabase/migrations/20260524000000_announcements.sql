-- Duyuru tabloları

CREATE TABLE announcements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  message      TEXT NOT NULL,
  created_by   UUID NOT NULL REFERENCES auth.users(id),
  target_roles TEXT[] NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE announcement_reads (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id  UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id),
  read_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE (announcement_id, user_id)
);

CREATE INDEX idx_announcement_reads_user ON announcement_reads (user_id, announcement_id);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;

-- Sadece müdür/MY duyuru oluşturabilir
CREATE POLICY "insert_announcements" ON announcements
  FOR INSERT WITH CHECK (
    school_id = current_school_id() AND
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('mudur', 'mudur_yardimcisi')
    )
  );

-- Hedeflenen role sahip kişiler veya gönderen kendi duyurularını görebilir
CREATE POLICY "select_announcements" ON announcements
  FOR SELECT USING (
    school_id = current_school_id() AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
          AND p.role = ANY(target_roles)
      )
    )
  );

CREATE POLICY "select_reads" ON announcement_reads
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "insert_reads" ON announcement_reads
  FOR INSERT WITH CHECK (user_id = auth.uid());
