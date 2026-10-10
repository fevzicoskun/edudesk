-- Haftalık veli bülteni gönderim kaydı (spec 2026-10-10 yönetici ana sayfası):
-- mentör paylaş/gönder düğmesine bastığında (veya kutucuğu işaretlediğinde) satır yazılır;
-- idare ana sayfası "Fevzi 9/9" ilerlemesini buradan okur. İletimi değil, düğmeye basmayı kaydeder.

create table if not exists bulten_gonderimleri (
  student_id uuid not null references students(id) on delete cascade,
  hafta      date not null,
  school_id  uuid not null references schools(id) on delete cascade,
  mentor_id  uuid not null default auth.uid() references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, hafta)
);
create index if not exists bulten_gonderimleri_school_hafta_idx on bulten_gonderimleri (school_id, hafta);
create index if not exists bulten_gonderimleri_mentor_idx on bulten_gonderimleri (mentor_id);

alter table bulten_gonderimleri enable row level security;

create policy bulten_gonderimleri_select on bulten_gonderimleri for select
  using (school_id = current_school_id() and (mentor_id = (select auth.uid()) or is_mudur_or_my()));

-- yalnız öğrencinin GÜNCEL mentörü kendi okulunda yazar
create policy bulten_gonderimleri_insert on bulten_gonderimleri for insert
  with check (
    school_id = current_school_id()
    and mentor_id = (select auth.uid())
    and exists (select 1 from mentorships m
                where m.student_id = bulten_gonderimleri.student_id
                  and m.mentor_id = (select auth.uid())
                  and m.school_id = current_school_id())
  );

create policy bulten_gonderimleri_delete on bulten_gonderimleri for delete
  using (school_id = current_school_id() and mentor_id = (select auth.uid()));
