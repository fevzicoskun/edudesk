-- Silinmiş (soft-delete) öğrencinin mentörlük satırı idare panosundaki bülten ilerlemesinde
-- paydayı şişiriyordu (mentör hiç %100 olamaz). 2026-10-10 tarama bulgusu.
create or replace function public.ogrenci_mentor_adlari()
returns table (student_id uuid, mentor_id uuid, mentor_adi text)
language sql stable security definer
set search_path to 'public' as $$
  select m.student_id, m.mentor_id, coalesce(p.full_name, 'Öğretmen')
  from mentorships m
  join profiles p on p.id = m.mentor_id
  join students s on s.id = m.student_id and s.deleted_at is null
  where m.school_id = current_school_id()
$$;
