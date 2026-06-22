-- Hot FK covering index'leri. Advisor 0001 (unindexed_foreign_keys) ~50 FK
-- listeledi; ÇOĞU spekülatif (tek-okul ölçeğinde seq scan zaten ucuz, write
-- amplification net negatif — bkz. 0005 unused_index listesi). Bu yüzden tümü
-- DEĞİL, kod katmanında GERÇEKTEN sıcak filtre olan ve büyüyen iki tablo:
--
--   teacher_activity_log: ActivityReportRepository — .eq(school_id).gte(created_at)
--     .order(created_at).limit(2000) → append-heavy, çok-okullu dashboard taraması.
--   teacher_classes: UserRepository — .in('class_id', [...]) → sınıf→öğretmen join.
--
-- Diğer flagged FK'ler (RBAC, mentor, submission_logs...) zaten lider-kolon
-- index'iyle karşılanıyor (hot filtre user_id/student_id/homework_id, FK değil).

-- Eşitlik(school_id) + aralık/sıralama(created_at) tek index'le karşılanır.
create index if not exists idx_teacher_activity_log_school_created
  on public.teacher_activity_log (school_id, created_at desc);

-- (class_id, teacher_id) → .in('class_id') lookup + select'i index-only scan'le karşılar.
create index if not exists idx_teacher_classes_class_id
  on public.teacher_classes (class_id, teacher_id);
