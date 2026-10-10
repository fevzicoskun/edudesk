# Yönetici ana sayfası (MY + müdür) — tasarım

2026-10-10 · kullanıcı: "müdür yardımcısının ve müdürün sayfasını daha kullanışlı hale getirmek lazım."

## Sorun
Okul (Bahçeşehir) EduDesk'i esas olarak ödev, mentörlük ve bülten için kullanıyor; yoklama kapalı. İdare ana sayfası
yoklama odaklı. Ödev yalnız bir düğme, öğretmen bilgisi iki ayrı kartta tekrarlanıyor ("Öğretmenler" ve "Öğretmen Aktivitesi"),
"Okul Durumu" ayrı bir sayfa ve bir mentörün bülteni gönderip göndermediği idare tarafından görülemiyor.

## Kararlar (kullanıcı)
- Tek sayfa, MY ve müdür için aynı. Yalnız müdürde altta trend grafikleri var.
- Dört alan var: Bugün, Ödev durumu, Öğretmen takibi, Mentörlük/veli.
- Okul Durumu ana sayfaya katılır. Menüden kalkar ve `/yonetim` adresi `/anasayfa`'ya yönlenir. `/yonetim/odevler` ve `/yonetim/ogrenciler` yerinde kalır.
- Bülten gönderimi otomatik kaydedilir. Kaydedilen şey mentörün gönder/paylaş düğmesine basmasıdır, iletimin gerçekleşmesi değildir.

## Sayfa (yukarıdan aşağı)
0. **Başlık:** selam, tarih ve sağda Karne PDF, Kullanıcılar, Öğrenciler, Ödev Takibi bağlantıları. Altında uyarı rozetleri ve sayı kartları (mevcut `MYStatsWidget`) ile "bu ay toplantı yok" bandı (`UyariBandi`).
1. **Bugün:** bugünün nöbetçileri, bugün teslimi olan ödev sayısı, kontrolü gecikmiş ödev sayısı (son teslimden 3 günden fazla geçmiş) ve bugünkü okul takvimi etkinlikleri (`school_events`).
2. **Ödev durumu:** kontrol bekleyen en eski 5 ödev (gecikenler kırmızı), sınıflara göre tamamlanma çubukları ve riskli öğrenci özeti ("N öğrenci · en çok <ders> M"). Rakamların tümü `odevTakibiVerisi` üzerinden gelir, bu yüzden Ödev Takibi ekranıyla aynıdır.
3. **Öğretmen takibi:** tek tablo. Sütunlar: öğretmen, verdiği ödev, kontrol oranı, en eski bekleyen kontrol (gün) ve son kullanım. En üstte sorunlular yer alır: önce en eski bekleyen kontrolü büyük olan, sonra son 2 haftada girmeyen, sonra hiç ödev vermeyen. Ödev sayıları tüm yılı kapsar (Ödev Takibi ile aynı); "son 2 hafta" penceresi YAGNI olarak bırakıldı. Bu tablo `MudurOgretmenAktivite` ile `MYSolSutunWidget`'in Öğretmenler kartının yerini alır.
4. **Mentörlük ve veli:** bu haftanın (`haftaSec(bugün)`, bülten sayfasıyla aynı hafta) bülten ilerlemesi mentör başına "gönderilen/öğrenci" biçiminde, sınıf başına mentörü olmayan öğrenci sayısı ve veli telefonu eksik öğrenci sayısı.
5. **Yoklama açıksa:** Devamsızlık Riski, Aylık devamsızlık, Bugün yoklama (mevcut bileşenler). Erken Uyarılar her iki rolde de gösterilir.
6. **Yalnız müdür:** `MudurTrendWidget`.

Kademe kartları (`OkulSeviyesiKartlari`) kaldırılır, çünkü öğrenci ve sınıf sayısı zaten sayı kartlarında var. Tam nöbet çizelgesi `/nobet` sayfasında kalır.

## Bülten kaydı
- Tablo `bulten_gonderimleri(student_id, hafta date, school_id, mentor_id, created_at)`, PK `(student_id, hafta)`.
- RLS: okuma okulda mentörün kendisine ya da müdür/MY'ye açık. Ekleme ve silme yalnız mentörün kendisine açık; mentör öğrencinin mentörü olmalı ve kayıt kendi okulunda olmalı.
- Server action `bultenGonderildi(studentId, hafta, gonderildi)`. Zod ile uuid ve Pazartesi tarihi doğrulanır. Gönderildi ise upsert, değilse delete yapılır.
- `BultenIstemci`: localStorage işareti kaldırılır, ilk durum sunucudan gelir. Paylaş, WhatsApp'a gönder, WhatsApp'ta aç ve Kopyala düğmeleri işareti otomatik koyar; kutucuk elle düzeltme için kalır. Sayaç metnindeki "(yalnız bu cihazda)" ibaresi silinir.

## Saf hesap ve test
`src/domains/dashboard/lib/yoneticiOzeti.ts` dosyasında üç fonksiyon olur: `ogretmenTakibi`, `bultenIlerlemesi` ve `mentorsuzSiniflar`. Her biri unit testlidir.
E2e testleri şunlardır: idare ana sayfasında 4 bölüm başlığı, `/yonetim` yönlendirmesi, menüde Okul Durumu bulunmaması, bülten düğmesinin DB'ye kayıt yazması ve bunun idare ana sayfasında sayıya yansıması. Bozulan eski e2e'ler yeni düzene göre güncellenir.
