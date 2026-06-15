-- ============================================================
-- schools tablosu abonelik kolonları — production drift düzeltmesi.
--
-- baseline.sql (1098-1105) bu kolonları tanımlıyor ancak production
-- DB'sine yalnızca `status` uygulanmış; plan / suspended_at /
-- suspended_by / trial_ends_at eksikti. Kod (OkulBilgileri.tsx,
-- platform/actions.ts) ve database.types.ts bu kolonları beklediği için
-- /ayarlar "Okul Bilgileri" kartı production'da sessizce düşüyordu
-- (sorgu olmayan kolona gidip null dönüyordu).
--
-- Bu migration baseline tanımını birebir tekrarlar (IF NOT EXISTS →
-- mevcut `status` için no-op). Stripe/abonelik altyapısının temeli.
-- ============================================================

alter table schools
  add column if not exists status        text not null default 'active'
    check (status in ('active', 'suspended', 'trial', 'cancelled')),
  add column if not exists plan          text not null default 'free'
    check (plan in ('free', 'starter', 'pro', 'enterprise')),
  add column if not exists suspended_at  timestamptz,
  add column if not exists suspended_by  uuid references auth.users(id),
  add column if not exists trial_ends_at timestamptz;
