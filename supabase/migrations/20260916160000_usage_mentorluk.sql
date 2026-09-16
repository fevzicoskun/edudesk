-- increment_usage whitelist'ine 'mentorluk' eklenir (src/shared/usage/featureMap.ts ile birebir).
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
  -- Metrik yazımı hiçbir akışı kırmamalı: geçersiz girişte sessizce çık.
  if p_feature is null or p_feature <> all (array[
    'anasayfa', 'yoklama', 'odevler', 'takvim', 'ders-programi',
    'randevular', 'rapor', 'siniflar', 'kullanicilar', 'nobet',
    'yonetim', 'ayarlar', 'profil', 'mentorluk'
  ]) then
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
