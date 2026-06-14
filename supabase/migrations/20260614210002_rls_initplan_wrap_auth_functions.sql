-- Perf raporu #2: RLS auth_rls_initplan — auth.uid()/auth.role() her satırda yeniden değerlendiriliyor.
-- (select auth.uid()) şeklinde sararak initplan'a çevirir (sorgu başına bir kez).
-- Dönüşüm in-DB yapılır; uygulandığında hiçbir politika önceden sarılı değildi (çift-sarma riski yok).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual ~ 'auth\.(uid|role)\(\)' OR with_check ~ 'auth\.(uid|role)\(\)')
  LOOP
    EXECUTE format(
      'ALTER POLICY %I ON public.%I%s%s',
      r.policyname, r.tablename,
      CASE WHEN r.qual IS NOT NULL
        THEN ' USING (' || regexp_replace(regexp_replace(r.qual, 'auth\.uid\(\)', '(select auth.uid())', 'g'), 'auth\.role\(\)', '(select auth.role())', 'g') || ')'
        ELSE '' END,
      CASE WHEN r.with_check IS NOT NULL
        THEN ' WITH CHECK (' || regexp_replace(regexp_replace(r.with_check, 'auth\.uid\(\)', '(select auth.uid())', 'g'), 'auth\.role\(\)', '(select auth.role())', 'g') || ')'
        ELSE '' END
    );
  END LOOP;
END $$;
