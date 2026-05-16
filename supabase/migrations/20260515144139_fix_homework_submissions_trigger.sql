-- Fix: create_submissions_for_homework trigger'ı school_id geçirmiyordu.
-- Phase3 NOT NULL migration'ı sonrası her yeni ödev oluşturmada patlamaya neden oluyordu.
-- NEW.school_id homeworks INSERT'inden alınır — propagation doğru.

CREATE OR REPLACE FUNCTION create_submissions_for_homework()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO homework_submissions (homework_id, student_id, school_id)
  SELECT NEW.id, s.id, NEW.school_id
  FROM students s
  WHERE s.class_id = NEW.class_id;
  RETURN NEW;
END;
$$;
