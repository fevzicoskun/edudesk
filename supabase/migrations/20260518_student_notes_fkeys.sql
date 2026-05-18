-- student_notes: student_id ve teacher_id FK kısıtları eksikti
-- PostgREST ilişkiyi göremediğinden .select('students(full_name)') hata veriyordu

ALTER TABLE student_notes
  ADD CONSTRAINT student_notes_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  ADD CONSTRAINT student_notes_teacher_id_fkey
    FOREIGN KEY (teacher_id) REFERENCES profiles(id) ON DELETE CASCADE;
