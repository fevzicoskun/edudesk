-- app_errors — kalıcı hata kaydı.
--
-- Gerekçe: client render hataları sendCriticalAlert ile e-posta olarak geliyordu,
-- ama server/cron tarafındaki hatalar yalnızca logger.error ile Vercel loglarına
-- düşüyordu; log retention kısa olduğu için birkaç saat sonra iz kalmıyordu.
-- Artık hem e-posta gider hem burada birikir, /platform'dan görülür.

create table if not exists app_errors (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  message     text not null,
  fingerprint text not null,
  source      text not null default 'server' check (source in ('client', 'server', 'cron')),
  context     jsonb not null default '{}'::jsonb,
  user_id     uuid references profiles(id) on delete set null,
  school_id   uuid references schools(id)  on delete set null,
  created_at  timestamptz not null default now()
);

comment on table app_errors is
  'Kalıcı hata kaydı. Yazım YALNIZ service_role ile (kaydetHata); okuma /platform süper-admin.';

-- Panelin tek sorgusu: son N hata, zaman sırasıyla
create index if not exists app_errors_created_idx on app_errors (created_at desc);
-- "Bu hata kaç kez oldu" gruplaması
create index if not exists app_errors_fingerprint_idx on app_errors (fingerprint, created_at desc);

-- RLS açık + policy YOK = deny-all (feedback tablosuyla aynı bilinçli desen).
-- Yazan: createServiceClient (RLS bypass). Okuyan: /platform, o da service client.
-- Böylece normal kullanıcı kendi hatasını bile okuyamaz — hata mesajları iç bilgi sızdırabilir.
alter table app_errors enable row level security;

-- ROLLBACK:
--   drop table if exists app_errors;
