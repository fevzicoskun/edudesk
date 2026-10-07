-- Öğrenci bazlı mentörlük (spec 2026-10-07):
--  - Her öğrencinin TEK mentörü olur (unique student_id).
--  - Atamayı idare (müdür/MY) da yapabilir; assigned_by kimin atadığını tutar.
--    assigned_by <> mentor_id = "İdare atadı" → mentör kendi kendine kaldıramaz.
--  - mentor_profiles / mentor_reports DEĞİŞMEZ: yalnız mentöre aittir.

do $$ begin
  if exists (select 1 from mentorships group by student_id having count(*) > 1) then
    raise exception 'Birden fazla mentörü olan öğrenci var — önce elle çözülmeli';
  end if;
end $$;

alter table mentorships drop constraint if exists mentorships_mentor_id_student_id_key;
alter table mentorships add constraint mentorships_student_id_key unique (student_id);

alter table mentorships add column if not exists assigned_by uuid references profiles(id) on delete set null;
update mentorships set assigned_by = mentor_id where assigned_by is null;
create index if not exists mentorships_assigned_by_idx on mentorships (assigned_by);

drop policy if exists mentorships_owner_all on mentorships;

create policy mentorships_select on mentorships for select
  using (school_id = current_school_id() and (mentor_id = (select auth.uid()) or is_mudur_or_my()));

create policy mentorships_insert on mentorships for insert
  with check (
    school_id = current_school_id()
    and assigned_by = (select auth.uid())
    and (mentor_id = (select auth.uid()) or is_mudur_or_my())
  );

create policy mentorships_update on mentorships for update
  using (school_id = current_school_id() and is_mudur_or_my())
  with check (school_id = current_school_id() and is_mudur_or_my() and assigned_by = (select auth.uid()));

create policy mentorships_delete on mentorships for delete
  using (
    school_id = current_school_id()
    and (is_mudur_or_my() or (mentor_id = (select auth.uid()) and assigned_by = (select auth.uid())))
  );

-- "Bu öğrencinin mentörü X" için: yalnız öğrenci → mentör adı. Kim/ne zaman atadı açılmaz,
-- SELECT policy genişletilmez.
create or replace function public.ogrenci_mentor_adlari()
returns table (student_id uuid, mentor_id uuid, mentor_adi text)
language sql stable security definer
set search_path to 'public' as $$
  select m.student_id, m.mentor_id, coalesce(p.full_name, 'Öğretmen')
  from mentorships m
  join profiles p on p.id = m.mentor_id
  where m.school_id = current_school_id()
$$;
revoke execute on function public.ogrenci_mentor_adlari() from anon, public;
grant execute on function public.ogrenci_mentor_adlari() to authenticated;
