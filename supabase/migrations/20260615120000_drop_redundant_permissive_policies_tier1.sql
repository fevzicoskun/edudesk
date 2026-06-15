-- Perf raporu #10 (devam — Tip 1): saf-gereksizlik PERMISSIVE policy temizliği.
-- Her silinen policy, kalan bir policy'nin STRICT alt kümesidir → anlam korunur,
-- yalnızca satır başına değerlendirilen policy sayısı azalır. multiple_permissive 32→15.

-- 1) notification_preferences: SELECT policy, ALL policy ile birebir aynı USING (user_id=auth.uid())
DROP POLICY IF EXISTS "Kullanici kendi tercihlerini okuyabilir" ON public.notification_preferences;

-- 2) teacher_classes: tc_school_read USING'i tc_school_write (ALL) ile birebir aynı
DROP POLICY IF EXISTS "tc_school_read" ON public.teacher_classes;

-- 3) permissions: (authenticated, true) ⊆ permissions_select (public, true)
DROP POLICY IF EXISTS "permissions_read_all" ON public.permissions;

-- 4) roles: (authenticated, dar) ⊆ roles_select (public, true)
DROP POLICY IF EXISTS "roles_read_school" ON public.roles;

-- 5) school_meetings: mudur_write (authenticated) ≡ yonetici (public); yonetici daha geniş
--    current_school_id() = profilin school_id'si → iki koşul mantıken özdeş.
DROP POLICY IF EXISTS "school_meetings_mudur_write" ON public.school_meetings;
