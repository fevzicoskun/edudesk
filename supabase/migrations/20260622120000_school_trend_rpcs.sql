-- Müdür trend paneli: dönem-başı agregatlarını DB-tarafında hesapla.
-- Önceki yaklaşım ham yoklama satırlarını (öğrenci×gün ≈ 90k/yıl) server component'e
-- çekip JS'te grupluyordu; 15000 satır cap'i gerçek boyutlu bir okulda HER ZAMAN dolup
-- en güncel haftaları kırpıyordu → trend yanlış/eksik. Bu RPC'ler agregatı satır başına
-- yerine hafta/sınıf grenine indirger, cap'i tümüyle ortadan kaldırır.
-- SECURITY INVOKER → attendance/homeworks RLS okul izolasyonunu zorlar (DEFINER değil).
-- date_trunc('week', ...) Pazartesi-başlıdır → JS startOfWeek({weekStartsOn:1}) ile birebir.

-- Haftalık yoklama agregatı: hafta (Pzt), toplam kayıt, devamsız, distinct (sınıf,gün).
-- Hem devamsızlık trendini (total/absent) hem kapsama trendini (recorded) besler.
create or replace function get_school_attendance_trend(p_school_id uuid, p_year_start date)
returns table(week_start date, total bigint, absent bigint, recorded bigint)
language sql
security invoker
set search_path = public
as $$
  select date_trunc('week', date)::date as week_start,
         count(*) as total,
         count(*) filter (where status = 'absent') as absent,
         count(distinct (class_id, date)) as recorded
  from attendance
  where school_id = p_school_id and date >= p_year_start
  group by 1
$$;

-- Sınıf bazlı devamsızlık (dönem geneli): sınıf karşılaştırması kartı için.
create or replace function get_school_class_absence(p_school_id uuid, p_year_start date)
returns table(class_id uuid, total bigint, absent bigint)
language sql
security invoker
set search_path = public
as $$
  select class_id,
         count(*) as total,
         count(*) filter (where status = 'absent') as absent
  from attendance
  where school_id = p_school_id and date >= p_year_start
  group by class_id
$$;

-- Haftalık aktif öğretmen: o hafta yoklama VEYA ödev girmiş distinct öğretmen sayısı.
create or replace function get_school_activity_weekly(p_school_id uuid, p_year_start date)
returns table(week_start date, active bigint)
language sql
security invoker
set search_path = public
as $$
  select week_start, count(distinct teacher_id) as active
  from (
    select date_trunc('week', date)::date as week_start, teacher_id
    from attendance
    where school_id = p_school_id and date >= p_year_start and teacher_id is not null
    union all
    select date_trunc('week', assigned_date)::date as week_start, teacher_id
    from homeworks
    where school_id = p_school_id and assigned_date >= p_year_start
      and deleted_at is null and teacher_id is not null
  ) u
  group by week_start
$$;

grant execute on function get_school_attendance_trend(uuid, date) to authenticated;
grant execute on function get_school_class_absence(uuid, date) to authenticated;
grant execute on function get_school_activity_weekly(uuid, date) to authenticated;
