#!/usr/bin/env bash
# Test Supabase projesinin (edudesk-test) şemasını canlıdan eşitler — VERİ TAŞINMAZ.
# Canlıya yalnız okuma: pg_dump --schema-only. Test projesindeki public şeması + test kullanıcıları SİLİNİR
# (global-setup ilk e2e koşusunda yeniden kurar). Her canlı migration'dan sonra çalıştır.
#   bash scripts/test-db-esitle.sh
set -euo pipefail
cd "$(dirname "$0")/.."
PG="${PG:-/c/Users/mehme/tools/pgsql/bin}"
TEST_REF=ozllydtpgixzgwuegbnd

# shellcheck disable=SC1090
source "$HOME/.edudesk-db.env" # DB_URL = canlı (proje dışı)
TEST_DB_URL=$(grep '^TEST_DB_URL=' .env.test | cut -d= -f2-)
# Pozitif kontrol: hedef test projesi değilse dur (canlıya drop schema GİTMESİN)
case "$TEST_DB_URL" in *"$TEST_REF"*) ;; *) echo "TEST_DB_URL boş ya da test projesi ($TEST_REF) değil — durdu."; exit 1 ;; esac
case "$DB_URL" in *"$TEST_REF"*) echo "DB_URL test projesini gösteriyor — durdu."; exit 1 ;; esac

tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
command -v cygpath >/dev/null && tmp=$(cygpath -m "$tmp") # Windows psql'i \i için C:/… yolu ister
# Hazır projede olanlar ayıklanır: public şeması ve supabase_admin varsayılan yetkileri (postgres değiştiremez)
"$PG/pg_dump" "$DB_URL" --schema-only --schema=public --no-owner \
  | grep -v -e '^CREATE SCHEMA public;$' -e '^COMMENT ON SCHEMA public' -e 'FOR ROLE supabase_admin' > "$tmp/sema.sql"
# Storage bucket + politikaları ve auth tetikleyicisi public'e bağlı (drop cascade siler) → canlıdan üret
"$PG/psql" "$DB_URL" -X -A -t -v ON_ERROR_STOP=1 > "$tmp/ekler.sql" <<'SQL'
select format('insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values (%L,%L,%s,%s,%L) on conflict (id) do nothing;',
  id, name, public, coalesce(file_size_limit::text, 'null'), allowed_mime_types) from storage.buckets
union all
select format('create policy %I on storage.objects as %s for %s to %s%s%s;', policyname, permissive, cmd, array_to_string(roles, ','),
  coalesce(' using (' || qual || ')', ''), coalesce(' with check (' || with_check || ')', '')) from pg_policies where schemaname = 'storage'
union all
select format('alter publication supabase_realtime add table %I.%I;', schemaname, tablename)
  from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'
union all
select 'create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();';
SQL

"$PG/psql" "$TEST_DB_URL" -X -q -v ON_ERROR_STOP=1 -1 <<SQL
delete from auth.users;
drop trigger if exists on_auth_user_created on auth.users;
do \$\$ declare p record; begin
  for p in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop; end \$\$;
drop schema public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
\i $tmp/sema.sql
\i $tmp/ekler.sql
SQL
"$PG/psql" "$TEST_DB_URL" -X -A -t -c "select 'test şeması: ' || count(*) || ' tablo' from pg_tables where schemaname = 'public'"
