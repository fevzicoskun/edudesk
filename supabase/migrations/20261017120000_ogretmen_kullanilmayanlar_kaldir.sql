-- Öğretmen tarafında hiç kullanılmayan özellikler kaldırıldı (2026-10-17 kullanıcı onayı; kod: 6f40a6e..954a143).
-- Veli görüşmeleri/randevular, veli iletişim kayıtları, not geçmişi, mentörlük tanıma kartı + düzen işareti.
-- Yedek: edudesk_yedek/ogretmen-temizligi-oncesi-2026-10-17.json (yalnız mentor_profiles'ta 3 boş/deneme satırı vardı).
drop table if exists public.parent_meetings;        -- parent_meetings_updated_at trigger'ı ve policy'ler tabloyla gider
drop function if exists public.update_parent_meetings_updated_at();
drop table if exists public.parent_contact_logs;
drop table if exists public.grade_entries;          -- grade_columns'a FK → önce bu
drop table if exists public.grade_columns;
drop table if exists public.mentor_profiles;

-- Kullanım sayacı izin listesinden /randevular çıktı (featureMap.ts ile birlikte güncellenir)
create or replace function public.increment_usage(p_feature text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_school_id uuid;
  v_role      text;
  v_day       date := (now() at time zone 'Europe/Istanbul')::date;
begin
  if p_feature is null or p_feature <> all (array[
    'anasayfa', 'yoklama', 'odevler', 'takvim', 'ders-programi',
    'rapor', 'siniflar', 'kullanicilar', 'nobet',
    'yonetim', 'ayarlar', 'profil', 'mentorluk'
  ]) then
    return;
  end if;

  if exists (
    select 1 from auth.users u
    where u.id = auth.uid() and u.email like '%@test.example'
  ) then
    return;
  end if;

  select school_id, role::text into v_school_id, v_role
  from public.profiles
  where id = auth.uid();

  if v_school_id is null then
    return;
  end if;

  insert into public.usage_daily (day, school_id, user_id, role, feature)
  values (v_day, v_school_id, auth.uid(), v_role, p_feature)
  on conflict (day, school_id, user_id, feature)
  do update set count = usage_daily.count + 1;
end;
$function$;
