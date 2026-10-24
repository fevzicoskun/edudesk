-- Bireysel ödev (spec 2026-10-24): öğretmenin tek bir öğrenciye verdiği ekstra ödev.
-- YALNIZ yeni tablo + bu tabloya ait index ve RLS. Mevcut tablo, policy ya da fonksiyon DEĞİŞMEZ
-- (current_school_id() yalnız çağrılır; FK'ler mevcut tablolara yalnız referans verir).

create table if not exists public.bireysel_odevler (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  ogrenci_id uuid not null references public.students(id) on delete cascade,
  ogretmen_id uuid not null references public.profiles(id) on delete cascade,
  aciklama text not null check (length(btrim(aciklama)) between 1 and 300),
  teslim_tarihi date,
  yapildi boolean not null default false,
  yapildi_tarihi timestamptz,
  olusturma_tarihi timestamptz not null default now()
);

-- "Verdiğim bireysel ödevler" listesi ve öğrenci sayfası sorguları
create index if not exists bireysel_odevler_ogretmen_idx on public.bireysel_odevler (ogretmen_id, yapildi, teslim_tarihi);
create index if not exists bireysel_odevler_ogrenci_idx on public.bireysel_odevler (ogrenci_id, olusturma_tarihi desc);

alter table public.bireysel_odevler enable row level security;

-- Öğretmen yalnız KENDİ verdiklerini görür/ekler/düzenler/siler. Görünürlük ileride genişlerse yalnız select
-- policy'sine "or ..." eklenir (ör. mentör, idare) — sahiplik ogretmen_id üzerinden.
create policy bireysel_odevler_select on public.bireysel_odevler for select to authenticated
  using (school_id = current_school_id() and ogretmen_id = auth.uid());

-- Ekleme/düzenleme: öğrenci aynı okulda ve silinmemiş olmalı (başka okulun öğrencisine kayıt açılamaz)
create policy bireysel_odevler_insert on public.bireysel_odevler for insert to authenticated
  with check (
    school_id = current_school_id() and ogretmen_id = auth.uid()
    and exists (select 1 from public.students s where s.id = ogrenci_id and s.school_id = current_school_id() and s.deleted_at is null)
  );

create policy bireysel_odevler_update on public.bireysel_odevler for update to authenticated
  using (school_id = current_school_id() and ogretmen_id = auth.uid())
  with check (
    school_id = current_school_id() and ogretmen_id = auth.uid()
    and exists (select 1 from public.students s where s.id = ogrenci_id and s.school_id = current_school_id() and s.deleted_at is null)
  );

create policy bireysel_odevler_delete on public.bireysel_odevler for delete to authenticated
  using (school_id = current_school_id() and ogretmen_id = auth.uid());
