-- Mentör haftalık takip (spec 2026-10-16). Öğrenci×hafta tek satır; idare yalnız özet RPC'den görür.

-- Açma listesi: yazma policy'si YOK → yalnız SQL/service role açar (profiles_self_update kendine açmayı engellemek için ayrı tablo).
create table if not exists mentor_takip_kullanicilari (
  user_id   uuid primary key references profiles(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table mentor_takip_kullanicilari enable row level security;
create policy mentor_takip_kullanicilari_select on mentor_takip_kullanicilari for select using (user_id = (select auth.uid()));

create or replace function public.mentor_takip_acik() returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from mentor_takip_kullanicilari k where k.user_id = auth.uid() and k.school_id = current_school_id())
$$;
create or replace function public.mentor_takip_erisimi(p_student uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select mentor_takip_acik() and exists (
    select 1 from mentorships m where m.student_id = p_student and m.mentor_id = auth.uid() and m.school_id = current_school_id())
$$;
revoke execute on function public.mentor_takip_acik() from anon, public;
revoke execute on function public.mentor_takip_erisimi(uuid) from anon, public;
grant execute on function public.mentor_takip_acik() to authenticated;
grant execute on function public.mentor_takip_erisimi(uuid) to authenticated;

create table if not exists mentor_kitaplari (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  ad text not null check (length(ad) between 1 and 120),
  ders text not null default '' check (length(ders) <= 60),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists mentor_kitaplari_student_idx on mentor_kitaplari (student_id) where deleted_at is null;

create table if not exists mentor_haftalari (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  hafta_basi date not null check (extract(isodow from hafta_basi) = 1),
  seviye smallint not null check (seviye between 0 and 2),
  soru_hedefi int not null check (soru_hedefi >= 0),
  icerik jsonb not null,
  gorusme jsonb not null default '{}'::jsonb,
  gorev_toplam int not null default 0, gorev_yapilan int not null default 0,
  soru int not null default 0, dogru int not null default 0 check (dogru <= soru),
  okuma_sayfa int not null default 0,
  islendi boolean not null default false,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (student_id, hafta_basi)
);
create index if not exists mentor_haftalari_school_idx on mentor_haftalari (school_id, hafta_basi);

create table if not exists konu_listesi (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  ders text not null, sinif smallint not null check (sinif between 9 and 12),
  ad text not null check (length(ad) between 1 and 120), grup text, sira int not null default 0,
  created_by uuid references profiles(id) on delete set null,
  unique (school_id, ders, sinif, ad)
);

create table if not exists ogrenci_konu_durumu (
  student_id uuid not null references students(id) on delete cascade,
  konu_id uuid not null references konu_listesi(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  durum smallint not null check (durum between 0 and 2),
  updated_at timestamptz not null default now(),
  primary key (student_id, konu_id)
);

alter table mentor_kitaplari enable row level security;
alter table mentor_haftalari enable row level security;
alter table konu_listesi enable row level security;
alter table ogrenci_konu_durumu enable row level security;

-- Mentör erişimi: bayrak açık + öğrencinin güncel mentörü + aynı okul. İdareye select YOK (özet RPC'den).
create policy mentor_kitaplari_all on mentor_kitaplari for all
  using (school_id = current_school_id() and mentor_takip_erisimi(student_id))
  with check (school_id = current_school_id() and mentor_takip_erisimi(student_id));
create policy mentor_haftalari_all on mentor_haftalari for all
  using (school_id = current_school_id() and mentor_takip_erisimi(student_id))
  with check (school_id = current_school_id() and mentor_takip_erisimi(student_id));
create policy ogrenci_konu_durumu_all on ogrenci_konu_durumu for all
  using (school_id = current_school_id() and mentor_takip_erisimi(student_id))
  with check (school_id = current_school_id() and mentor_takip_erisimi(student_id));

create policy konu_listesi_select on konu_listesi for select using (school_id = current_school_id());
create policy konu_listesi_insert on konu_listesi for insert
  with check (school_id = current_school_id() and mentor_takip_acik() and created_by = (select auth.uid()));

-- İdare özeti: yalnız rakamlar, öğrenci başına son işlenen hafta. icerik/gorusme asla dönmez.
create or replace function public.mentor_takip_ozet()
returns table (student_id uuid, hafta_basi date, gorev_toplam int, gorev_yapilan int, soru int, dogru int)
language sql stable security definer set search_path to 'public' as $$
  select distinct on (h.student_id) h.student_id, h.hafta_basi, h.gorev_toplam, h.gorev_yapilan, h.soru, h.dogru
  from mentor_haftalari h
  where h.school_id = current_school_id() and h.islendi and is_mudur_or_my()
  order by h.student_id, h.hafta_basi desc
$$;
revoke execute on function public.mentor_takip_ozet() from anon, public;
grant execute on function public.mentor_takip_ozet() to authenticated;
