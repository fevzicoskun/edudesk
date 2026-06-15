-- Perf raporu #10 (devam — Tip 2): FOR ALL politikalarını komut-bazlıya böl, SELECT çakışmalarını gider.
-- Anlam korunur; eklenen auth.* çağrıları (select ...) ile sarılı (initplan 0 kalsın). multiple_permissive 15→0.

-- ============ push_subscriptions ============
-- Eski: "kendi kayıt"(ALL, uid=user_id) + "service_role okuma"(SELECT, service_role)
DROP POLICY IF EXISTS "push_subscriptions: kendi kayıt" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions: service_role okuma" ON public.push_subscriptions;

CREATE POLICY "push_subscriptions_select" ON public.push_subscriptions
  FOR SELECT USING (
    ((select auth.uid()) = user_id) OR ((select auth.role()) = 'service_role')
  );
CREATE POLICY "push_subscriptions_insert" ON public.push_subscriptions
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "push_subscriptions_update" ON public.push_subscriptions
  FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "push_subscriptions_delete" ON public.push_subscriptions
  FOR DELETE USING ((select auth.uid()) = user_id);

-- ============ zumre_meeting_templates ============
-- Eski: "zumre_baskani_manage_templates"(ALL, school=my AND role=zb) + "school_members_read_templates"(SELECT, school=my)
-- SELECT'i school_members_read tek başına karşılar; manage yalnız yazma komutlarına bölünür.
DROP POLICY IF EXISTS "zumre_baskani_manage_templates" ON public.zumre_meeting_templates;

CREATE POLICY "zumre_templates_insert" ON public.zumre_meeting_templates
  FOR INSERT WITH CHECK (
    (school_id = (select profiles.school_id from profiles where profiles.id = (select auth.uid())))
    AND ((select profiles.role from profiles where profiles.id = (select auth.uid())) = 'zumre_baskani')
  );
CREATE POLICY "zumre_templates_update" ON public.zumre_meeting_templates
  FOR UPDATE USING (
    (school_id = (select profiles.school_id from profiles where profiles.id = (select auth.uid())))
    AND ((select profiles.role from profiles where profiles.id = (select auth.uid())) = 'zumre_baskani')
  ) WITH CHECK (
    (school_id = (select profiles.school_id from profiles where profiles.id = (select auth.uid())))
    AND ((select profiles.role from profiles where profiles.id = (select auth.uid())) = 'zumre_baskani')
  );
CREATE POLICY "zumre_templates_delete" ON public.zumre_meeting_templates
  FOR DELETE USING (
    (school_id = (select profiles.school_id from profiles where profiles.id = (select auth.uid())))
    AND ((select profiles.role from profiles where profiles.id = (select auth.uid())) = 'zumre_baskani')
  );

-- ============ school_meetings ============
-- Eski (Tier1 sonrası): "yonetici"(ALL, EXISTS mudur/my) + "school_select"(SELECT, school=current)
-- SELECT'i school_select karşılar (daha geniş); yonetici yalnız yazma komutlarına bölünür.
DROP POLICY IF EXISTS "school_meetings_yonetici" ON public.school_meetings;

CREATE POLICY "school_meetings_yonetici_insert" ON public.school_meetings
  FOR INSERT WITH CHECK (
    EXISTS (select 1 from profiles
      where profiles.id = (select auth.uid())
        and profiles.school_id = school_meetings.school_id
        and profiles.role = ANY (ARRAY['mudur','mudur_yardimcisi']))
  );
CREATE POLICY "school_meetings_yonetici_update" ON public.school_meetings
  FOR UPDATE USING (
    EXISTS (select 1 from profiles
      where profiles.id = (select auth.uid())
        and profiles.school_id = school_meetings.school_id
        and profiles.role = ANY (ARRAY['mudur','mudur_yardimcisi']))
  ) WITH CHECK (
    EXISTS (select 1 from profiles
      where profiles.id = (select auth.uid())
        and profiles.school_id = school_meetings.school_id
        and profiles.role = ANY (ARRAY['mudur','mudur_yardimcisi']))
  );
CREATE POLICY "school_meetings_yonetici_delete" ON public.school_meetings
  FOR DELETE USING (
    EXISTS (select 1 from profiles
      where profiles.id = (select auth.uid())
        and profiles.school_id = school_meetings.school_id
        and profiles.role = ANY (ARRAY['mudur','mudur_yardimcisi']))
  );

-- ============ user_roles ============
-- Eski: admin(ALL, school=current AND role=mudur) + insert_service(INSERT) + read_own(SELECT) + select(SELECT)
-- read_own gereksiz (select ile aynı). admin SELECT/INSERT'i diğerleri karşılıyor; yalnız UPDATE/DELETE'e böl.
DROP POLICY IF EXISTS "user_roles_read_own" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin" ON public.user_roles;

CREATE POLICY "user_roles_admin_update" ON public.user_roles
  FOR UPDATE TO authenticated USING (
    (school_id = current_school_id())
    AND ((select profiles.role from profiles where profiles.id = (select auth.uid())) = 'mudur')
  ) WITH CHECK (
    (school_id = current_school_id())
    AND ((select profiles.role from profiles where profiles.id = (select auth.uid())) = 'mudur')
  );
CREATE POLICY "user_roles_admin_delete" ON public.user_roles
  FOR DELETE TO authenticated USING (
    (school_id = current_school_id())
    AND ((select profiles.role from profiles where profiles.id = (select auth.uid())) = 'mudur')
  );
