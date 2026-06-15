-- ============================================================
-- GÜVENLİK: public view'lerine security_invoker = on.
--
-- active_students / active_classes / active_homeworks / tenant_metrics
-- view'leri postgres sahipliydi (rolbypassrls=true) ve SECURITY DEFINER
-- davranıyordu → altındaki tabloların RLS'ini BYPASS ediyorlardı.
-- Üstelik anon + authenticated rollerine SELECT verilmişti.
--
-- Sonuç (doğrulandı): giriş yapmamış (anon) bir kullanıcı bile
-- GET /rest/v1/tenant_metrics ile TÜM okulların verisini çekebiliyordu
-- — kritik kiracı izolasyonu / veri sızıntısı açığı.
--
-- security_invoker = on → view artık sorgulayan rolün izinleriyle
-- (ve RLS'iyle) çalışır:
--   • anon/authenticated → kendi okulu dışını göremez (açık kapanır)
--   • service_role (admin paneli) → RLS'i zaten bypass eder, panel çalışır
--
-- Not: active_* view'leri migration geçmişinde tanımlı değil (drift);
-- bu yüzden yalnızca mevcut olanlar güvenle ALTER edilir (fresh-reset güvenli).
-- ============================================================

do $$
declare v text;
begin
  foreach v in array array['active_students', 'active_classes', 'active_homeworks', 'tenant_metrics']
  loop
    if exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = v and c.relkind = 'v'
    ) then
      execute format('alter view public.%I set (security_invoker = on)', v);
    end if;
  end loop;
end $$;
