-- Kullanım metrikleri + geri bildirim kalıcı kaydı
-- Spec: docs/superpowers/specs/2026-07-05-usage-feedback-design.md

-- ── usage_daily: günlük sayaç (kullanıcı × özellik × gün) ─────────────
create table public.usage_daily (
  day        date        not null,
  school_id  uuid        not null references public.schools(id),
  user_id    uuid        not null,
  role       text        not null,
  feature    text        not null,
  count      integer     not null default 1,
  primary key (day, school_id, user_id, feature)
);

-- RLS açık, policy YOK: authenticated hiçbir şey yapamaz; yazım RPC ile,
-- okuma yalnızca service-role (/platform).
alter table public.usage_daily enable row level security;

-- ── increment_usage: kimliği auth.uid()'den türeten atomik upsert ─────
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
  if p_feature is null or length(p_feature) > 40 then
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

revoke execute on function public.increment_usage(text) from public, anon;
grant  execute on function public.increment_usage(text) to authenticated;

-- ── feedback: kalıcı geri bildirim kaydı ──────────────────────────────
create table public.feedback (
  id         uuid        primary key default gen_random_uuid(),
  school_id  uuid        not null references public.schools(id),
  user_id    uuid        not null,
  role       text        not null,
  page_path  text        not null,
  category   text        not null check (category in ('oneri', 'istek', 'sikayet')),
  message    text        not null check (char_length(message) between 3 and 2000),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- Yalnız kendi adına, kendi okuluna INSERT. SELECT/UPDATE/DELETE policy yok.
create policy "feedback_insert" on public.feedback
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and school_id = (select current_school_id())
  );

-- ── /platform aggregate view'ları ─────────────────────────────────────
-- security_invoker: authenticated çağırırsa tablo policy'si (yok) uygulanır
-- → boş döner; service-role tam görür.
create view public.usage_summary
  with (security_invoker = true) as
select
  u.school_id,
  s.name as school_name,
  u.feature,
  count(distinct u.user_id) filter (where u.day >= current_date - 7)              as users_7d,
  coalesce(sum(u.count)     filter (where u.day >= current_date - 7),  0)::bigint as views_7d,
  count(distinct u.user_id)                                                       as users_30d,
  coalesce(sum(u.count), 0)::bigint                                               as views_30d
from public.usage_daily u
join public.schools s on s.id = u.school_id
where u.day >= current_date - 30
group by u.school_id, s.name, u.feature;

create view public.usage_active_users
  with (security_invoker = true) as
select
  u.school_id,
  s.name as school_name,
  count(distinct u.user_id) filter (where u.day >= current_date - 7) as users_7d,
  count(distinct u.user_id)                                          as users_30d
from public.usage_daily u
join public.schools s on s.id = u.school_id
where u.day >= current_date - 30
group by u.school_id, s.name;
