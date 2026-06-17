-- ============================================================
-- GÜVENLİK: SECURITY DEFINER fonksiyonlarının PostgREST RPC
-- yüzeyini daralt (advisor: anon/authenticated_security_definer_
-- function_executable).
--
-- KRİTİK AÇIK: admin_set_profile / admin_onboard_user içlerinde
-- HİÇBİR yetki kontrolü yok ve rol-yükseltme trigger korumasını
-- kendileri kapatıyor. anon (giriş yapmamış) role bunları
-- /rest/v1/rpc/... ile çağırıp herhangi bir profili 'admin'
-- yapabiliyordu → privilege escalation.
--
-- NOT: Postgres fonksiyonları varsayılan olarak EXECUTE'u PUBLIC
-- role'üne grant'ler; anon/authenticated PUBLIC üyesidir. Bu yüzden
-- revoke hedefi PUBLIC olmalı (yalnız anon/authenticated yetersiz).
-- service_role da PUBLIC üyesi olduğundan revoke sonrası ona
-- EXECUTE'u explicit geri veriyoruz (uygulama createServiceClient
-- ile çağırıyor). Trigger gövdelerine grant gerekmez — trigger
-- bağlamında tanımlayıcı yetkisiyle çalışırlar.
--
-- DOKUNULMAYANLAR (bilinçli):
--   * RLS helper'ları (is_*, can_*, has_permission, current_school_id,
--     permission_scope) → RLS policy gövdelerinde çağrılıyor; revoke
--     authenticated'ı kırardı.
--   * assign_user_role → authenticated + içeride auth.uid() kontrollü.
--   * find_school_by_slug, get_user_permissions,
--     get_first_unread_announcement → authenticated okuma.
-- ============================================================

-- service_role-only mutasyonlar: PUBLIC'ten al, service_role'e ver
revoke execute on function public.admin_set_profile(uuid, text, text, text, uuid) from public;
grant  execute on function public.admin_set_profile(uuid, text, text, text, uuid) to service_role;

revoke execute on function public.admin_onboard_user(uuid, uuid, text) from public;
grant  execute on function public.admin_onboard_user(uuid, uuid, text) to service_role;

revoke execute on function public.delete_school(uuid) from public;
grant  execute on function public.delete_school(uuid) to service_role;

revoke execute on function public.soft_delete(text, uuid) from public;
grant  execute on function public.soft_delete(text, uuid) to service_role;

revoke execute on function public.restore_record(text, uuid) from public;
grant  execute on function public.restore_record(text, uuid) to service_role;

-- trigger gövdeleri: PUBLIC'ten al (RPC olarak çağrılmaları gereksiz)
revoke execute on function public.create_submissions_for_homework() from public;
revoke execute on function public.handle_new_user()                from public;
revoke execute on function public.prevent_self_role_escalation()   from public;
revoke execute on function public.sync_profile_to_user_roles()     from public;
revoke execute on function public.update_lesson_schedules_updated_at() from public;
