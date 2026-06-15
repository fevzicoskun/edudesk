-- ============================================================
-- GÜVENLİK sertleştirme (advisor WARN temizliği)
--
-- 1) function_search_path_mutable (10 fonksiyon):
--    search_path set edilmemiş SECURITY DEFINER/trigger fonksiyonları
--    çağıranın search_path'ini miras alıyordu → search_path injection
--    riski. Sabit `search_path = public` ile kapatılır (pg_catalog zaten
--    implicit ilk sırada). `public` seçildi çünkü bu fonksiyonlar public
--    tablolara niteliksiz (unqualified) referans veriyor; '' kullanmak
--    onları bozardı.
--
-- 2) notifications INSERT policy:
--    "Service role bildirim ekleyebilir" policy'si aslında PUBLIC role'e
--    (anon + authenticated dahil) WITH CHECK (true) ile açıktı → herhangi
--    bir kullanıcı başkası adına sahte bildirim ekleyebiliyordu. Tüm meşru
--    insert'ler service_role (Inngest) üzerinden geldiği için policy
--    service_role'e kısıtlandı.
-- ============================================================

-- 1. search_path sabitleme
alter function public.update_lesson_schedules_updated_at()        set search_path = public;
alter function public.soft_delete(text, uuid)                     set search_path = public;
alter function public.restore_record(text, uuid)                  set search_path = public;
alter function public.create_submissions_for_homework()           set search_path = public;
alter function public.is_zumre_baskani()                          set search_path = public;
alter function public.find_school_by_slug(text)                   set search_path = public;
alter function public.prevent_role_escalation()                   set search_path = public;
alter function public.prevent_school_id_change()                  set search_path = public;
alter function public.prevent_self_role_escalation()              set search_path = public;
alter function public.protect_audit_logs_worm()                   set search_path = public;

-- 2. notifications INSERT policy'sini service_role'e kısıtla
drop policy if exists "Service role bildirim ekleyebilir" on public.notifications;
create policy "Service role bildirim ekleyebilir" on public.notifications
  for insert to service_role
  with check (true);
