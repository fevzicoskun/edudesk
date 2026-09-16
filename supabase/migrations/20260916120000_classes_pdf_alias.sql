-- Sınıfın ders programı PDF'inde geçen alternatif adı.
--
-- Okul PDF'i şubeyi alan koduyla yazabiliyor ("11TM-A"), EduDesk'te ise sade ad
-- kullanılıyor ("11-A"). İçe aktarmada eşleşme kurulamadığı için dersler boşa
-- düşüyordu. Sınıf adını değiştirmek okul genelini etkilediğinden, eşleşme
-- ayrı bir takma adla kurulur.
alter table classes add column if not exists pdf_alias text;

comment on column classes.pdf_alias is
  'Ders programı PDF''inde bu sınıf için kullanılan ad (örn. 11-A için 11TM-A). Boşsa yalnız name ile eşleşilir.';
