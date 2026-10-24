-- Deneme sonuçları (spec 2026-10-22 veli toplantısı kâğıdı). Stoys AGİS Excel'i mentör yükler; yalnız KENDİ
-- öğrencilerinin satırları saklanır. Kapı: mentör takip özelliği (mentor_takip_acik / mentor_takip_erisimi).

-- Sınav kimliği: okul + tür + sınıf seviyesi + tarih (aynı gün 9 ve 10. sınıf TM'si ayrı sınav)
create table if not exists public.deneme_sinavlari (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  tur text not null check (tur in ('TM', 'FKB', 'TCD')),
  seviye smallint not null check (seviye between 9 and 12),
  tarih date not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (school_id, tur, seviye, tarih)
);

-- "Bu sınıfın dosyası yüklendi": katılmadı çıkarımı buna dayanır (sınav var + sınıfı yüklendi + satır yok)
create table if not exists public.deneme_sinav_siniflari (
  sinav_id uuid not null references public.deneme_sinavlari(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  primary key (sinav_id, class_id)
);

-- dersler: [{ "kod": "TÜR", "ss": 30, "d": 27, "y": 3, "n": 26.25 }]; sayılar float8 (numeric PostgREST'te string döner)
create table if not exists public.deneme_sonuclari (
  sinav_id uuid not null references public.deneme_sinavlari(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  dersler jsonb not null check (jsonb_typeof(dersler) = 'array'),
  toplam_net double precision not null,
  puan double precision,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (sinav_id, student_id)
);
create index if not exists deneme_sonuclari_student_idx on public.deneme_sonuclari (student_id);

alter table public.deneme_sinavlari enable row level security;
alter table public.deneme_sinav_siniflari enable row level security;
alter table public.deneme_sonuclari enable row level security;

-- Sınav ve sınıf kaydı okul içinde görünür (sonuç içermez); yalnız kapıdaki kullanıcı ekler; değiştirme/silme yok
create policy deneme_sinavlari_select on public.deneme_sinavlari for select using (school_id = current_school_id());
create policy deneme_sinavlari_insert on public.deneme_sinavlari for insert
  with check (school_id = current_school_id() and mentor_takip_acik());
create policy deneme_sinav_siniflari_select on public.deneme_sinav_siniflari for select using (school_id = current_school_id());
create policy deneme_sinav_siniflari_insert on public.deneme_sinav_siniflari for insert
  with check (school_id = current_school_id() and mentor_takip_acik());

-- Sonuç: güncel mentör yazar/okur, müdür/MY yalnız okur
create policy deneme_sonuclari_select on public.deneme_sonuclari for select
  using (school_id = current_school_id() and (mentor_takip_erisimi(student_id) or is_mudur_or_my()));
create policy deneme_sonuclari_insert on public.deneme_sonuclari for insert
  with check (school_id = current_school_id() and mentor_takip_erisimi(student_id));
create policy deneme_sonuclari_update on public.deneme_sonuclari for update
  using (school_id = current_school_id() and mentor_takip_erisimi(student_id))
  with check (school_id = current_school_id() and mentor_takip_erisimi(student_id));
create policy deneme_sonuclari_delete on public.deneme_sonuclari for delete
  using (school_id = current_school_id() and mentor_takip_erisimi(student_id));
