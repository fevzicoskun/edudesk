-- İdare mentörlük listesi (2026-10-11): müdür/MY "mentör görüşüyor mu?" görsün.
-- Yalnız tarih + sayı döner; mentor_reports içeriği ve SELECT policy'si DEĞİŞMEZ (notlar yalnız mentöre).
-- Sayım öğrencinin ŞU ANKİ mentörünün yazdıklarıdır (önceki mentörün görüşmeleri karışmaz).
create or replace function public.mentor_gorusme_ozeti()
returns table (student_id uuid, son_gorusme date, gorusme_sayisi int)
language sql stable security definer
set search_path to 'public' as $$
  select m.student_id, max(r.report_date)::date, count(r.id)::int
  from mentorships m
  join students s on s.id = m.student_id and s.deleted_at is null
  join mentor_reports r on r.student_id = m.student_id and r.mentor_id = m.mentor_id and r.school_id = m.school_id
  where m.school_id = current_school_id() and is_mudur_or_my()
  group by m.student_id
$$;
revoke execute on function public.mentor_gorusme_ozeti() from anon, public;
grant execute on function public.mentor_gorusme_ozeti() to authenticated;
