-- homework_submissions.marked_at — öğretmenin durumu GERÇEKTEN işaretlediği an.
--
-- Gerekçe: `on_homework_created` trigger'ı ödev oluşturulur oluşturulmaz sınıftaki
-- her öğrenciye 'yapilmadi' satırı açıyor. Bu yüzden satırın VARLIĞI "öğretmen
-- işaretledi" anlamına gelmiyordu; ekrandaki "N/N öğrenci işaretlendi · %100"
-- göstergesi öğretmen hiçbir şeye dokunmadan %100 gösteriyordu.
--
-- Trigger'ı kaldırmak yerine additive kolon seçildi: 20+ tüketici satırın
-- varlığını varsayıyor, hiçbiri bu değişiklikten etkilenmiyor.

alter table homework_submissions
  add column if not exists marked_at timestamptz;

comment on column homework_submissions.marked_at is
  'Öğretmenin durumu işaretlediği an. NULL = trigger açtı, henüz dokunulmadı. Not yazmak bu damgayı DOLDURMAZ.';

-- Geriye dönük doldurma (1): durum değişikliği loglanmış çiftler.
-- homework_submission_logs 2026-06-13''ten beri her status değişiminde yazılıyor,
-- yani ilk log kaydı kesin bir "dokunuldu" kanıtı.
update homework_submissions hs
set    marked_at = l.ilk_dokunus
from (
  select homework_id, student_id, min(changed_at) as ilk_dokunus
  from   homework_submission_logs
  group  by homework_id, student_id
) l
where hs.homework_id = l.homework_id
  and hs.student_id  = l.student_id
  and hs.marked_at is null;

-- Geriye dönük doldurma (2): log''u olmayan (log tablosundan eski) ama durumu
-- 'yapilmadi' dışında olan satırlar — bu değeri biri elle vermiş olmalı.
update homework_submissions
set    marked_at = updated_at
where  marked_at is null
  and  status is not null
  and  status <> 'yapilmadi';

-- Kalan NULL'lar: durumu 'yapilmadi' ve log''u yok → gerçekten dokunulmamış
-- (ya da log tablosundan önceki dönemde dokunulmuş, ayırt edilemez; muhafazakâr
-- davranıp "işaretlenmedi" sayıyoruz).

-- ROLLBACK:
--   alter table homework_submissions drop column if exists marked_at;
