# Mentör Haftalık Takip — Tasarım (2026-10-16)

Mentör öğretmen öğrenciyle haftalık plan yapar, plan kâğıda basılır, öğrenci hafta boyunca işaretleyip getirir,
mentör kâğıda bakarak sonucu sisteme işler; veliye otomatik özet mesajı gider.

Kaynak: kullanıcının dış spec'i (`Downloads/EduDesk_Mentorluk_Spec (1).md`) fikir olarak alındı, sisteme göre
yeniden tasarlandı. Eski veri içe aktarımı ve Excel/CSV dışa aktarma **kapsam dışı** (kullanıcı kararı / YAGNI).

## 1. Kararlar (kullanıcıyla konuşuldu)

| Konu | Karar |
|---|---|
| Akış | Plan birlikte yapılır → kâğıt basılır → öğrenci işaretler → mentör kâğıttan işler |
| Kâğıt içeriği | Program (sınıf şablonu + düzenleme) + o haftanın **okul ödevleri** (otomatik) + **mentör ödevleri** + **okuma** |
| İşlenen bilgi | Her görev yaptı/yapmadı; **yalnız soru satırlarında** soru + doğru |
| Okul ödevleri | Kâğıttan işlenmez; dersin öğretmeninin EduDesk işareti salt okunur gösterilir |
| Görünürlük | Mentör her şeyi; müdür/MY **yalnız özet rakamları**; diğer öğretmen hiçbir şey |
| Veli | Ayrı veli mesajı (otomatik metin, düzenlenebilir, Kopyala / WhatsApp) + yazdırılabilir veli raporu. Mevcut bülten değişmez |
| Mentör ödevi | Öğrencinin kitap listesinden seç + konu + sayfa |
| Konu haritası | Tüm dersler için yapı; yalnız **matematik listesi dolu** gelir, diğerleri kullanıldıkça okul içinde dolar |
| Seviye | Hafif ×0,7 / Normal / Yoğun ×1,25 (5'e yuvarlanır) |
| Okuma | Kâğıtta günlük sayfa kutuları; sisteme **haftalık toplam** + "Bitti" |
| Mentör değişimi | Geçmiş öğrenciyle gider (yeni mentör görür, eski mentör göremez) |
| Veri modeli | Öğrenci×hafta tek satır: içerik JSONB + görüşme JSONB + özet sütunları |
| Matematik satırı baskısı | Kalın + hafif gri zemin (turuncu değil; siyah-beyaz yazıcı) |

## 2. Açma / erişim

- `profiles.mentor_takip_aktif boolean not null default false`. İlk aşamada yalnız kullanıcının hesabında SQL ile açılır.
- Kapalı kullanıcı: Mentörlüğüm'de "Haftalık Takip" öğeleri görünmez; `/mentorluk/[studentId]/takip/*` ve
  yazdırma rotaları sunucuda `notFound()`; server action'lar reddeder; RLS de bayrağı ister (aşağıda).
- Eşleşme kaynağı mevcut `mentorships` (öğrenci başına tek mentör, idare atayabilir). Yeni grup tablosu yok.

## 3. Ekranlar

**Mentörlüğüm listesi (`/mentorluk`)**: her öğrencide bu haftanın durumu — *Plan yok* / *Kâğıtta* / *İşlendi · %80*.
"Bu haftanın kâğıtlarını toplu yazdır" düğmesi (planı olan tüm öğrenciler, her biri yeni sayfa).

**Takip sayfası (`/mentorluk/[studentId]/takip?hafta=YYYY-MM-DD`)**: üstte hafta seçici (‹ 13–19 Ekim › · Bu hafta)
ve kayıt durumu. Dört sekme:

1. **Plan** — seviye, soru hedefi; günlere göre görev tablosu (ad, süre, konu, sayfa; konu kutusu `konu_listesi`'nden
   öneri verir); okul ödevleri (salt okunur liste); mentör ödevleri (kitap seç + konu + sayfalar, ekle/sil);
   okuma kitabı; "Sınıf şablonuna dön"; **Kâğıdı yazdır**.
2. **Sonuç** — kâğıtla aynı sıra; her satırda ✓, soru satırlarında Soru/Doğru; okul ödevleri öğretmen işaretiyle
   salt okunur; mentör ödevleri ✓; okuma toplam sayfa + Bitti; özet kartları (program %, soru/hedef, doğruluk %
   + geçen haftaya fark, mentör ödevi x/y, okuma); görüşme alanları: iyi giden, zorlandığı, öğrencinin hedefi,
   gelecek odak, evde veliden ricam.
3. **Veli mesajı** — otomatik metin (textarea, düzenlenebilir), Kopyala, WhatsApp'ta gönder (bültendeki mevcut
   paylaşım deseni), Veli raporunu yazdır.
4. **Öğrenci dosyası** — kitaplar (ekle/sil), konu haritası (tıkla: başlanmadı → çalışılıyor → oturdu; "konu ekle"),
   okuduğu kitaplar (kitap, başlama–bitiş haftası, toplam sayfa), geçmiş haftalar tablosu (hafta, seviye,
   program %, soru, doğruluk, okuma, "Aç"), hafta içi düzen metni.

**Yeni hafta açılışı**: önceki kayıtlı haftanın görevleri (sonuçlar boşaltılmış), seviyesi, soru hedefi, hafta içi
düzen metni ve bitmemiş okuma kitabı kopyalanır. Mentör ödevleri ve görüşme alanları kopyalanmaz. Hiç hafta
yoksa sınıf şablonu + Hafif. Haftanın kaydı ilk düzenlemede oluşur (yalnız bakmak satır yaratmaz).

> Not (tasarım sırasında sadeleştirme): Bölüm 3 konuşmasındaki ayrı `mentor_programlari` tablosu **kaldırıldı**.
> "Önceki haftayı kopyala" zaten kalıcı programın işini görüyor; iki kaynak (öğrenci programı + geçen hafta)
> hangisinin geçerli olduğu karışıklığı yaratırdı. Sıfırlama "Sınıf şablonuna dön" ile yapılır.

**Hafta durumu** (türetilir): satır yok → *Plan yok*; satır var, `islendi_at` boş → *Kâğıtta*; `islendi_at` dolu →
*İşlendi*. `islendi_at`, Sonuç sekmesinde ilk ✓/soru/okuma girildiğinde atanır; tüm sonuçlar silinirse boşalır.

## 4. Çıktılar (A4, tarayıcıdan yazdır)

Ortak yazdırma şablonu kullanılır → okul adı, logo filigranı, tarih/URL'siz kenar (bfe527d) kendiliğinden gelir.

- **Öğrenci kâğıdı** (dikey, tek sayfa hedefli): okul adı, "Haftalık Çalışma Planı", öğrenci adı/sınıfı, hafta,
  seviye, soru hedefi; varsa geçen haftanın öğrenci hedefi → "Bu haftaki hedefim" kutusu; hafta içi düzen satırı;
  program tablosu (Gün | Görev | Süre | Konu | Sayfa | Soru | Doğru | ✓; soru satırı olmayanlarda Soru/Doğru gri;
  matematik satırları kalın + hafif gri zemin); okul ödevleri (Ders | Ödev | Son teslim | ✓); mentör ödevleri
  (Kitap | Konu | Sayfalar | ✓); okuma kutusu (kitap + Pzt…Paz sayfa kutuları); öğretmen notu + veli imzası.
- **Veli raporu** (dikey, tek sayfa): özet kutuları (program, soru/doğruluk, mentör ödevi, okuma) + mesaj + öğretmen adı.
- **Toplu kâğıt**: aynı kâğıt, öğrenci başına `break-before: page`.

## 5. Veri modeli

```
profiles.mentor_takip_aktif   boolean not null default false

mentor_kitaplari
  id uuid pk, school_id, student_id → students, ad text, ders text, created_at, deleted_at

mentor_haftalari
  id uuid pk, school_id, student_id → students, hafta_basi date (pazartesi, check),
  seviye smallint (0 hafif / 1 normal / 2 yoğun), soru_hedefi int,
  icerik jsonb      -- görevler + sonuçlar, mentör ödevleri, okuma, hafta içi düzen
  gorusme jsonb     -- iyi, zor, hedef, odak, evde (yalnız mentör)
  -- özet (her kayıtta sunucu hesaplar; idare yalnız bunları görür):
  gorev_toplam int, gorev_yapilan int, soru int, dogru int, okuma_sayfa int,
  islendi_at timestamptz, updated_by uuid, updated_at timestamptz
  unique (student_id, hafta_basi)

konu_listesi
  id uuid pk, school_id, ders text, sinif smallint (9–12), ad text, grup text null, sira int, created_by
  unique (school_id, ders, sinif, ad)

ogrenci_konu_durumu
  student_id, konu_id → konu_listesi, school_id, durum smallint (0/1/2), updated_at
  pk (student_id, konu_id)
```

`icerik` şeması (Zod ile action sınırında doğrulanır):

```ts
{
  duzen: string,                         // hafta içi düzen metni
  gorevler: { id: string, gun: 0..6, ad: string, ders: string | null,
              miktar: number | null, birim: 'dk' | 'soru' | 'serbest',
              soruSatiri: boolean, konu: string, sayfa: string,
              yapti: boolean, soru: number | null, dogru: number | null }[],
  mentorOdevleri: { id: string, kitapId: string | null, kitapAdi: string,  // kitap silinse de ad kalır
                    konu: string, sayfalar: string, yapti: boolean }[],
  okuma: { kitap: string, sayfa: number | null, bitti: boolean } | null
}
```

`miktar` Normal seviye içindir; gösterim seviyeye göre hesaplanır, saklanan değer değişmez.
Okul ödevleri saklanmaz: her açılışta mevcut ödev verisinden `haftaOdevleri` (bultenMath.ts) ile okunur.
Okuduğu kitaplar listesi `mentor_haftalari.icerik.okuma`'dan türetilir (ayrı tablo yok).

**Sınıf şablonları** ve **matematik konu listeleri** kodda sabit dosya (`src/domains/mentor/takip/sablonlar.ts`).
Matematik listesi okul için ilk kullanımda `konu_listesi`'ne tohumlanır (idempotent).

9–10. sınıf şablonu (Normal): Pzt–Cum her gün Okul tekrarı 15 dk · Matematik soru bankası 60 dk (M, soru) ·
Paragraf 15 soru (soru); ek: Pzt Matematik yanlışların çözümü 45 dk (M), Sal Fizik 45 dk, Çar Matematik konu
testi 45 dk (M, soru), Per Kimya/Biyoloji 45 dk, Cum İngilizce 45 dk. Cmt: Matematik tarama testi 90 dk (M, soru),
Edebiyat + Tarih/Coğrafya 90 dk. Paz: Matematik tekrarı 60 dk (M), Haftalık genel tekrar (serbest).

11–12. sınıf şablonu (Normal): Pzt–Cum her gün Okul tekrarı 15 dk · TYT Matematik 45 dk (M, soru) · Paragraf
20 soru (soru); ek: Pzt AYT Matematik 60 dk (M, soru), Sal Fizik/Edebiyat 45 dk, Çar AYT Matematik 60 dk (M, soru),
Per Kimya/Biyoloji/Tarih-Coğrafya 45 dk, Cum Matematik yanlışların çözümü 45 dk (M). Cmt: TYT denemesi 165 dk
(soru), Deneme analizi 45 dk. Paz: AYT Matematik tekrarı 90 dk (M), Haftalık genel tekrar (serbest).

Hafta içi düzen varsayılanı: "16.30–18.00 dinlenme · 18.00 ana çalışma · yemek · günün dersi · 21.00'den sonra serbest".

Matematik konu listeleri (9–11 Maarif, 12 YKS): dış spec'in 4. bölümündeki listeler aynen; kullanıcı yıllık planla
karşılaştırıp düzeltebilir.

## 6. Güvenlik (RLS)

- Yardımcı: `mentor_takip_erisimi(p_student uuid) returns boolean` SECURITY DEFINER — çağıranın bayrağı açık **ve**
  `mentorships` içinde o öğrencinin mentörü **ve** aynı okul. (anon/authenticated EXECUTE çekilmez — RLS helper kuralı.)
- `mentor_haftalari`, `mentor_kitaplari`, `ogrenci_konu_durumu`: select/insert/update/delete yalnız
  `school_id = current_school_id() and mentor_takip_erisimi(student_id)`. İdareye select policy **yok**.
- `konu_listesi`: okul içi herkes select; insert bayrağı açık kullanıcı; update/delete yok (YAGNI).
- İdare özeti: `mentor_takip_ozet()` SECURITY DEFINER RPC, yalnız `is_mudur_or_my()`; döner: student_id, son
  işlenen hafta, gorev_toplam/yapilan, soru, dogru. `icerik`/`gorusme` asla dönmez.
- Mentör değişirse erişim `mentorships` üzerinden yeni mentöre geçer (geçmiş öğrenciyle gider).
- Öğrenci mentörlükten çıkarılırsa satırlar silinmez.

## 7. Kayıt ve hata durumları

- Otomatik kayıt: metin alanlarında ~800 ms gecikme, kutu/seçimlerde hemen. Tek server action tüm haftayı upsert eder
  (`icerik` + `gorusme` + seviye/hedef); özet sütunları sunucuda `icerik`'ten hesaplanır (istemciye güvenilmez).
- Eşzamanlılık: istemci son bildiği `updated_at`'i gönderir; uyuşmazsa kayıt reddedilir → "Başka bir ekranda
  değişti, yenileyin". Veri sessizce ezilmez.
- Durum göstergesi: "Kaydedildi · 19:20" / "Kaydediliyor…" / kırmızı "Kaydedilemedi · Tekrar dene".
- Kaydedilmemiş değişiklikle çıkışta `beforeunload` uyarısı.
- Doğrulama: `dogru <= soru`, sayılar ≥ 0 tamsayı, metin uzunluk sınırları; istemcide ve Zod'da.
- Silmelerde (kitap, mentör ödevi, görev) onay.

## 8. Hesaplar (saf fonksiyonlar, `src/domains/mentor/takip/takipMath.ts`)

- `programYuzde` = (yapılan görev + yapılan mentör ödevi) / (toplam görev + toplam mentör ödevi); payda 0 → null.
  Okul ödevleri dahil değil.
- `dogrulukYuzde` = Σdoğru / Σsoru (yalnız soru satırları); Σsoru 0 → null ("—").
- Soru toplamı ve hedef: tüm soru satırları (matematik + paragraf + deneme).
- `fark`: iki hafta da işlendiyse doğruluk puan farkı; değilse null.
- `seviyeMiktar(miktar, seviye)`: Hafif ×0,7, Yoğun ×1,25, 5'e yuvarlanır (Normal değişmez).
- `sureYaz(dk)`: <60 → "45 dk"; 60 → "1 saat"; 90 → "1,5 saat"; 135 → "2 saat 15 dk".
- `varsayilanHedef(sinif, seviye)`: 9–10 → 120/200/300; 11–12 → 200/300/400.
- `yeniHafta(onceki | null, sinif)`: kopyalama kuralları (§3).
- `veliMesaji(...)`: dış spec'teki şablon; boş satırlar atlanır; okuma satırı ("… 120 sayfa okudu" / "… bitirdi");
  imza öğretmen adı.

## 9. İdare görünümü

`/yonetim/mentorluk` tablosuna üç sütun: son işlenen hafta, program %, doğruluk % (`mentor_takip_ozet()`'ten).
Modülü kullanmayan mentörün öğrencilerinde "—".

## 10. Testler

- **Birim**: §8'deki tüm fonksiyonlar (sınır değerleri: payda 0, doğru>soru reddi, yuvarlama, süre yazımı, boş satır atlama,
  kopyalama — mentör ödevi/görüşme kopyalanmaz, bitmiş kitap taşınmaz), Zod şeması.
- **E2E**: bayrak kapalı öğretmen takip rotasına giremez (404) ve menüde görmez; başka mentörün öğrencisi görünmez/yazılamaz;
  idare özet rakamlarını görür, notları göremez (RPC çıktısında alan yok); kâğıttan işleme → yenile → veri yerinde;
  eşzamanlılık reddi; kâğıt ve veli raporu çıktısında filigran var, `@page` kenarı 0.
- **Canlı**: SQL ile satır + özet sütunları, tarayıcıda ekran; ikisi ayrı.

## 11. Uygulama aşamaları (her biri ayrı canlıya çıkar)

1. Bayrak, tablolar/RLS, şablonlar, Plan sekmesi + okul ödevleri + mentör ödevleri + kitap ekleme (Plan içinden) + kâğıt yazdırma.
2. Sonuç sekmesi + özet kartları + Mentörlüğüm hafta durumu.
3. Veli mesajı + veli raporu çıktısı.
4. Öğrenci dosyası (konu haritası, okuma geçmişi, geçmiş haftalar, düzen metni) + idare sütunları + toplu yazdırma.

## Kapsam dışı

Eski JSON içe aktarımı, Excel/CSV dışa aktarma, öğrenci girişi/öğrenci ekranı, veli portalında gösterim,
konu listesi düzenleme/silme ekranı, idare için ayrıntı görünümü.
