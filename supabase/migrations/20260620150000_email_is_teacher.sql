-- 5c: Veli e-postası okuldaki bir öğretmenin e-postasıyla çakışıyor mu? (boolean)
-- Öğretmen e-postaları auth.users'ta; RLS'li client erişemez → SECURITY DEFINER gerekli.
-- Güvenlik: sadece boolean döner (e-posta listesi sızmaz) + current_school_id() ile
-- yalnız ÇAĞIRANIN okulu taranır (cross-tenant yok). search_path sabit.
create or replace function public.email_is_teacher(p_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    join public.profiles p on p.id = u.id
    where lower(u.email) = lower(trim(p_email))
      and p.school_id = current_school_id()
  );
$$;

-- Yalnız giriş yapmış kullanıcılar çağırabilsin (anon'a kapalı — advisor disiplinine uygun).
-- NOT: Supabase default privileges yeni fonksiyona anon EXECUTE veriyor → PUBLIC revoke yetmez,
-- explicit "revoke from anon" gerekli (aksi halde anon advisor WARN'ı tetikler).
revoke all on function public.email_is_teacher(text) from public;
revoke execute on function public.email_is_teacher(text) from anon;
grant execute on function public.email_is_teacher(text) to authenticated;
