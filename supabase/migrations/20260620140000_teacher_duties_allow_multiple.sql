-- Öğretmen birden fazla nöbete sahip olabilir (farklı gün/saat) → tek-kayıt kısıtını kaldır.
-- Bundan sonra her nöbet bağımsız satır; ekleme = insert, silme = delete by id (RLS korumalı).
alter table public.teacher_duties
  drop constraint if exists teacher_duties_school_teacher_uniq;
