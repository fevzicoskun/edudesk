-- Okul etkinlikleri (gezi, tören, genel duyuru niteliğinde tarihli olaylar).
-- Yazma: müdür + müdür yardımcısı. Okuma: okul üyeleri. Patern: parent_meetings.

-- Müdür/MY kontrolü için SECURITY DEFINER helper (is_yonetici_in_school zümre
-- başkanını da içerdiği için kullanılamaz). NOT: advisor 0028/0029 bu fonksiyonu
-- flag'leyecek — bilinçli kabul (bkz. feedback_rls_helper_execute_grant kararı).
create or replace function public.is_mudur_or_my()
returns boolean language sql stable security definer
set search_path to 'public' as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and role in ('mudur', 'mudur_yardimcisi')
      and school_id = current_school_id()
  )
$$;

create table if not exists public.school_events (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id)  on delete cascade,
  title       text not null check (char_length(title) between 1 and 200),
  event_date  date not null,
  note        text check (note is null or char_length(note) <= 1000),
  created_by  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  deleted_by  uuid references public.profiles(id)
);

-- En sık sorgu: okulun ay aralığındaki etkinlikleri.
create index if not exists idx_school_events_school_date
  on public.school_events (school_id, event_date);

alter table public.school_events enable row level security;

-- Okuma: okul üyeleri.
create policy "school_events_select" on public.school_events
  for select to authenticated
  using (school_id = current_school_id());

-- Yazma: müdür + MY. Silme soft-delete (UPDATE) ile yapılır; DELETE policy yok.
create policy "school_events_insert" on public.school_events
  for insert to authenticated
  with check (school_id = current_school_id() and is_mudur_or_my() and created_by = auth.uid());

create policy "school_events_update" on public.school_events
  for update to authenticated
  using (school_id = current_school_id() and is_mudur_or_my())
  with check (school_id = current_school_id() and is_mudur_or_my());
