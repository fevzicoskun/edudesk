-- bireysel_odevler RLS: auth.uid() / current_school_id() satır başına değil sorgu başına
-- bir kez hesaplansın (advisor 0003 auth_rls_initplan). Anlam değişmez; ALTER POLICY ile
-- policy hiç düşmeden güncellenir.

alter policy bireysel_odevler_select on public.bireysel_odevler
  using (school_id = (select current_school_id()) and ogretmen_id = (select auth.uid()));

alter policy bireysel_odevler_delete on public.bireysel_odevler
  using (school_id = (select current_school_id()) and ogretmen_id = (select auth.uid()));

alter policy bireysel_odevler_insert on public.bireysel_odevler
  with check (
    school_id = (select current_school_id()) and ogretmen_id = (select auth.uid())
    and exists (
      select 1 from public.students s
      where s.id = bireysel_odevler.ogrenci_id
        and s.school_id = (select current_school_id())
        and s.deleted_at is null
    )
  );

alter policy bireysel_odevler_update on public.bireysel_odevler
  using (school_id = (select current_school_id()) and ogretmen_id = (select auth.uid()))
  with check (
    school_id = (select current_school_id()) and ogretmen_id = (select auth.uid())
    and exists (
      select 1 from public.students s
      where s.id = bireysel_odevler.ogrenci_id
        and s.school_id = (select current_school_id())
        and s.deleted_at is null
    )
  );
