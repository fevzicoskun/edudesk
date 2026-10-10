-- Okul başvuruları (2026-10-10): /kayit formu önce buraya yazar, mail yalnız bildirim.
-- info@ adresi bounce verince başvurular SESSİZCE kayboluyordu. Erişim yalnız service-role
-- (/platform süper-admin paneli) — RLS açık, policy YOK (feedback tablosuyla aynı desen).
create table if not exists okul_basvurulari (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  school_name  text not null check (char_length(school_name) between 2 and 200),
  contact_name text not null check (char_length(contact_name) between 2 and 120),
  email        text not null check (char_length(email) <= 254),
  phone        text check (char_length(phone) <= 30),
  note         text check (char_length(note) <= 2000),
  durum        text not null default 'yeni' check (durum in ('yeni', 'arandi', 'demo', 'kazanildi', 'kaybedildi')),
  updated_at   timestamptz not null default now()
);
alter table okul_basvurulari enable row level security;
create index if not exists okul_basvurulari_created_idx on okul_basvurulari (created_at desc);
