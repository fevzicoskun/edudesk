-- Güvenlik advisor (0028/0029): SECURITY DEFINER fonksiyonların gereksiz REST erişimini kapat.
-- NOT: RLS politikalarında kullanılan yardımcılar (current_school_id, is_zumre_baskani*, can_*,
-- has_permission, is_school_member, is_yonetici_in_school) authenticated EXECUTE'a MUHTAÇ;
-- onlara dokunulmadı (revoke RLS değerlendirmesini "permission denied" ile kilitler).

-- Hiçbir yerde (policy/fonksiyon/app) çağrılmayan fonksiyonlar -> anon + authenticated kaldır.
-- get_first_unread_announcement: parametreli, iç yetki kontrolü yok (latent IDOR) ve kullanılmıyor.
revoke execute on function public.get_first_unread_announcement(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.is_mudur_in_school() from public, anon, authenticated;
revoke execute on function public.permission_scope(uuid, text, text, uuid) from public, anon, authenticated;

-- Uygulamadan authenticated olarak RPC ile çağrılanlar -> sadece anon kaldır.
revoke execute on function public.assign_user_role(uuid, text) from public, anon;
grant  execute on function public.assign_user_role(uuid, text) to authenticated;
revoke execute on function public.get_user_permissions(uuid, uuid) from public, anon;
grant  execute on function public.get_user_permissions(uuid, uuid) to authenticated;
