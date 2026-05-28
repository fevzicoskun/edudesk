-- homework_sources: öğretmenin kullandığı kaynak/kitap listesi
CREATE TABLE homework_sources (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID        NOT NULL REFERENCES profiles(id),
  school_id  UUID        NOT NULL REFERENCES schools(id),
  name       TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  subject    TEXT        CHECK (char_length(subject) <= 100), -- NULL = tüm dersler
  active     BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE homework_sources ENABLE ROW LEVEL SECURITY;

-- Öğretmen yalnızca kendi kaynaklarını görebilir ve yönetebilir
CREATE POLICY "sources_teacher_own" ON homework_sources
  FOR ALL
  USING (teacher_id = auth.uid() AND school_id = current_school_id());

-- Homeworks tablosuna kaynak bağlantısı
ALTER TABLE homeworks ADD COLUMN source_id UUID REFERENCES homework_sources(id) ON DELETE SET NULL;
