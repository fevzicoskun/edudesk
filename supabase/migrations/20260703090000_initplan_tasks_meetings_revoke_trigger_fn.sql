-- RLS initplan (advisor 0003): tasks_own ve parent_meetings_own policy'leri
-- auth.uid()/current_school_id()'yi her satır için yeniden değerlendiriyordu.
-- (select ...) sarması sorgu başına bir kez değerlendirir (mevcut
-- 20260614210002 pattern'i; yeni tablolar o migration'dan sonra eklendiği
-- için kapsam dışı kalmıştı).

alter policy "tasks_own" on public.tasks
  using (school_id = (select current_school_id()) and user_id = (select auth.uid()))
  with check (school_id = (select current_school_id()) and user_id = (select auth.uid()));

alter policy "parent_meetings_own" on public.parent_meetings
  using (school_id = (select current_school_id()) and teacher_id = (select auth.uid()))
  with check (school_id = (select current_school_id()) and teacher_id = (select auth.uid()));

-- update_parent_meetings_updated_at (advisor 0028/0029): trigger fonksiyonu
-- SECURITY DEFINER olarak anon/authenticated'a RPC üzerinden açıktı.
-- RLS helper DEĞİL (hiçbir policy kullanmıyor) → EXECUTE güvenle çekilebilir;
-- trigger tablo üzerinden çalışmaya devam eder.
revoke execute on function public.update_parent_meetings_updated_at()
  from public, anon, authenticated;
