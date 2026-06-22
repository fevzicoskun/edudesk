-- Müdür panosu devamsızlık riski: öğrenci başına ağırlıklı skoru DB'de hesapla.
-- Önceki getAbsentYearRows ham (student_id,status) satırlarını .limit(15000) ile
-- çekip JS'te grupluyordu. 500 öğr × 200 gün × 0.15 ≈ 15000 → eşik gerçek boyutlu
-- okulda dolup en eski olmayan rastgele satırları kırpıyor, risk sayısı/top-10
-- listesi sessizce yanlış oluyordu. Bu RPC öğrenci başına tek satıra indirger
-- (≤ öğrenci sayısı), cap'i tümüyle kaldırır.
-- Ağırlık: absent=1, late=0.5 (JS'teki mevcut mantıkla birebir).
-- ::float8 → PostgREST numeric'i string yerine JSON number döndürür.
-- SECURITY INVOKER → attendance RLS okul izolasyonunu korur.
create or replace function get_school_absence_scores(p_school_id uuid, p_year_start date)
returns table(student_id uuid, absences float8)
language sql
security invoker
set search_path = public
as $$
  select student_id,
         (count(*) filter (where status = 'absent')
          + 0.5 * count(*) filter (where status = 'late'))::float8 as absences
  from attendance
  where school_id = p_school_id and date >= p_year_start
    and status in ('absent', 'late')
  group by student_id
$$;

grant execute on function get_school_absence_scores(uuid, date) to authenticated;
