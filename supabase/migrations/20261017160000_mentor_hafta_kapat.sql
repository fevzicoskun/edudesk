-- Mentör haftalık takip: haftayı kapat (2026-10-17, spec 2026-10-17-mentor-takip-iyilestirme-design.md).
-- kapali_at dolu = hafta salt okunur; okul_odevleri = kapatma anındaki okul ödevi durumu (ödev modülü sonradan değişse de sabit).
alter table public.mentor_haftalari
  add column if not exists kapali_at timestamptz,
  add column if not exists okul_odevleri jsonb;

-- Kapalı haftaya yazım DB'de de engellenir; yalnız kilidi açan güncelleme (kapali_at → null) geçer.
create or replace function public.mentor_haftalari_kapali_koru() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if old.kapali_at is not null and new.kapali_at is not null then
    raise exception 'Bu hafta kapalı; düzenlemek için kilidi açın.' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists mentor_haftalari_kapali_koru on public.mentor_haftalari;
create trigger mentor_haftalari_kapali_koru before update on public.mentor_haftalari
  for each row execute function public.mentor_haftalari_kapali_koru();
