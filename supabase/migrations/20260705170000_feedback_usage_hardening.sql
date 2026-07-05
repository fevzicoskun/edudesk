-- Dış review (Codex) sertleştirmeleri:
--   1) feedback yazımı RPC'ye taşındı: doğrudan PostgREST insert'i action'daki
--      rate-limit'i atlıyor ve role alanına istediğini yazabiliyordu.
--      submit_feedback kimliği (school_id/user_id/role) DB'de türetir,
--      rate limit DB'de uygulanır; feedback_insert policy'si kaldırılır
--      (policy'siz RLS = doğrudan yazma tamamen kapalı).
--   2) increment_usage'a feature whitelist'i: /api/usage'daki Zod enum'u
--      doğrudan RPC çağrısıyla bypass edilebiliyordu.

-- ── 1) submit_feedback ────────────────────────────────────────────────
create or replace function public.submit_feedback(
  p_category  text,
  p_message   text,
  p_page_path text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_role      text;
begin
  select school_id, role::text into v_school_id, v_role
  from public.profiles
  where id = auth.uid();

  if v_school_id is null then
    return 'no_profile';
  end if;

  -- Rate limit: son 60 sn'de 3+ kayıt varsa reddet (spam koruması).
  if (select count(*) from public.feedback
      where user_id = auth.uid()
        and created_at > now() - interval '60 seconds') >= 3 then
    return 'rate_limited';
  end if;

  -- category/message sınırlarını tablo CHECK'leri zorlar (geçersizse exception).
  insert into public.feedback (school_id, user_id, role, page_path, category, message)
  values (
    v_school_id,
    auth.uid(),
    v_role,
    left(coalesce(nullif(p_page_path, ''), '/'), 200),
    p_category,
    p_message
  );

  return 'ok';
end;
$$;

revoke execute on function public.submit_feedback(text, text, text) from public, anon;
grant  execute on function public.submit_feedback(text, text, text) to authenticated;

-- Doğrudan insert yolu kapanır: policy'siz RLS = deny-all.
drop policy if exists "feedback_insert" on public.feedback;

-- ── 2) increment_usage whitelist ──────────────────────────────────────
-- Liste src/shared/usage/featureMap.ts FEATURES ile birebir tutulmalı;
-- yeni dashboard modülü eklenirse İKİSİ birden güncellenir.
create or replace function public.increment_usage(p_feature text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_role      text;
  v_day       date := (now() at time zone 'Europe/Istanbul')::date;
begin
  -- Metrik yazımı hiçbir akışı kırmamalı: geçersiz girişte sessizce çık.
  if p_feature is null or p_feature <> all (array[
    'anasayfa', 'yoklama', 'odevler', 'takvim', 'ders-programi',
    'randevular', 'rapor', 'siniflar', 'kullanicilar', 'nobet',
    'yonetim', 'ayarlar', 'profil'
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
$$;
