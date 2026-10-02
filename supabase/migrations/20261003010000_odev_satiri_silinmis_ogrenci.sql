-- 2026-10-03: ödev açılınca her öğrenciye submission satırı açan trigger silinmiş öğrenciyi atlamıyordu
-- (canlıda 3 silinmiş öğrenciye sonradan verilen 5 ödevde 15 boş satır). Okuyucular marked_at'e baktığı için
-- ekranda görünmüyordu; ama ham sayım ya da öğrenci geri alma bu satırları "yapılmadı" diye yüzeye çıkarırdı.
create or replace function public.create_submissions_for_homework()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into homework_submissions (homework_id, student_id, school_id)
  select new.id, s.id, new.school_id
  from students s
  where s.class_id = new.class_id
    and s.deleted_at is null;
  return new;
end;
$$;
