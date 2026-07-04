-- school_events RLS sertleştirme (Task 1 review bulguları):
--   1) auth fonksiyonları (select ...) ile sarmalanır → auth_rls_initplan WARN'ı kalkar
--      (desen: 20260704162824_parent_meetings_select_mudur).
--   2) SELECT'e deleted_at backstop'u: üyeler yalnız silinmemişleri görür,
--      müdür/MY silinmişleri de görür (restore için; desen: classes_school_read).

drop policy if exists "school_events_select" on public.school_events;
create policy "school_events_select" on public.school_events
  for select to authenticated
  using (
    (school_id = (select current_school_id()) and deleted_at is null)
    or (school_id = (select current_school_id()) and deleted_at is not null and (select is_mudur_or_my()))
  );

drop policy if exists "school_events_insert" on public.school_events;
create policy "school_events_insert" on public.school_events
  for insert to authenticated
  with check (
    school_id = (select current_school_id())
    and (select is_mudur_or_my())
    and created_by = (select auth.uid())
  );

drop policy if exists "school_events_update" on public.school_events;
create policy "school_events_update" on public.school_events
  for update to authenticated
  using (school_id = (select current_school_id()) and (select is_mudur_or_my()))
  with check (school_id = (select current_school_id()) and (select is_mudur_or_my()));
