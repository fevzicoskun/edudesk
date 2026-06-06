-- Yeni öğrenci sınıfa eklendiğinde, o sınıfın mevcut aktif ödevleri için
-- homework_submissions kayıtlarını otomatik oluştur.
-- Geç kayıt durumunu (ödev oluşturulduktan sonra eklenen öğrenci) kapatır.
-- ON CONFLICT DO NOTHING: idempotent — tekrar çalışsa da zarar vermez.

CREATE OR REPLACE FUNCTION backfill_submissions_for_new_student()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO homework_submissions (homework_id, student_id, school_id)
  SELECT h.id, NEW.id, NEW.school_id
  FROM homeworks h
  WHERE h.class_id  = NEW.class_id
    AND h.school_id = NEW.school_id
    AND h.deleted_at IS NULL
    AND h.is_template = FALSE
  ON CONFLICT (homework_id, student_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS backfill_submissions_on_student_insert ON students;

CREATE TRIGGER backfill_submissions_on_student_insert
  AFTER INSERT ON students
  FOR EACH ROW
  EXECUTE FUNCTION backfill_submissions_for_new_student();
