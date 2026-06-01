-- Teslim sonrası veli bildirimi dedup tablosu
create table if not exists homework_veli_notifications (
  homework_id  uuid        not null references homeworks(id)  on delete cascade,
  student_id   uuid        not null references students(id)   on delete cascade,
  sent_at      timestamptz not null default now(),
  primary key (homework_id, student_id)
);

-- Sadece service role erişebilir (Inngest)
alter table homework_veli_notifications enable row level security;
