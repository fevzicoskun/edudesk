-- Perf raporu #10: yalnızca KANITLANABILIR gereksiz tek-kolonlu index'ler düşürülür.
-- Her biri, aynı tablodaki bir composite index'in lead kolonuyla karşılanır → lead-column
-- lookup'ları composite'i kullanabilir. (Salt "unused" olanlar genç DB nedeniyle korunur.)
DROP INDEX IF EXISTS public.audit_logs_action_idx;        -- (action) ⊂ idx_audit_logs_action(action, created_at DESC)
DROP INDEX IF EXISTS public.idx_zumre_meetings_school_id;  -- (school_id) ⊂ idx_zumre_meetings_school_date(school_id, meeting_date DESC)
DROP INDEX IF EXISTS public.idx_student_notes_school_id;   -- (school_id) ⊂ idx_student_notes_school_student(school_id, student_id, created_at DESC)
DROP INDEX IF EXISTS public.grade_entries_column_id_idx;   -- (grade_column_id) ⊂ grade_entries_grade_column_id_student_id_key(grade_column_id, student_id)
