-- Mentör takip: öğrenciye özel çalışma saatleri + kâğıt basım damgası (spec 2026-10-21-mentor-takip-saatler-odevler-kagit-design.md).
-- Saatler haftaya değil öğrenciye ait: hafta satırından ayrı tablo → kopyala/uygula/şablon/seviye dokunamaz.
create table if not exists public.ogrenci_calisma_saatleri (
  student_id uuid primary key references public.students(id) on delete cascade,
  school_id  uuid not null references public.schools(id) on delete cascade,
  gunler     jsonb not null check (jsonb_typeof(gunler) = 'array' and jsonb_array_length(gunler) = 7),
  "not"      text not null default '' check (length("not") <= 300),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.ogrenci_calisma_saatleri enable row level security;
-- mentor_haftalari ile aynı erişim: bayrak açık + öğrencinin güncel mentörü + aynı okul
create policy ogrenci_calisma_saatleri_all on public.ogrenci_calisma_saatleri for all
  using (school_id = current_school_id() and mentor_takip_erisimi(student_id))
  with check (school_id = current_school_id() and mentor_takip_erisimi(student_id));

-- Öğrenci kâğıdının son açılışı: sonra verilen ödevlere "yeni" rozeti + "tekrar yazdır" uyarısı
alter table public.mentor_haftalari add column if not exists kagit_basildi_at timestamptz;
