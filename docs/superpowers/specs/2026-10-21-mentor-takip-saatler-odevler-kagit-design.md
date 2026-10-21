# Mentör haftalık takip — çalışma saatleri, ödevlerin plana otomatik gelmesi, yeni öğrenci kâğıdı

Tarih: 2026-10-21 · Durum: tasarım (onay bekliyor)
İlgili: `2026-10-16-mentor-haftalik-takip-design.md`, `2026-10-17-mentor-takip-iyilestirme-design.md`

## Neden

Mentör her öğrenciye haftalık plan hazırlayıp kâğıt basıyor. Üç sorun var:

1. Öğrencilerin çalışma saatleri farklı; plan bunu bilmiyor, "Hafta içi düzen" elle yazılan tek metin.
2. Okul ödevleri planın altında ayrı listede duruyor; mentör her birini elle göreve çeviriyor.
3. Kâğıt uzun düz tablo (gün adı her satırda, gri boş hücreler, boş kitap/sayfa sütunu, ödevler altta tekrar,
   küçük yazı) — 9. sınıf öğrencisi karışık buluyor.

Başarı: mentör öğrencinin saatlerini bir kez girer; ödevler kendiliğinden plana, uygun güne düşer; öğretmen
"yapıldı" işaretleyince plan da işaretlenir; öğrenci gün gün okunan, saatli, sade bir kâğıt alır.

## Hedef dışı / yapılmayacaklar

- Ödev görevleri için ayrı tablo yok (plan `mentor_haftalari.icerik` JSON'unda kalır).
- Şablon/mentör görevlerini otomatik kısaltma yok — aşım yalnız uyarı.
- "Ödev payı" oranı, 3 hafta sınırı, varsayılan 2,5 saat için ayar ekranı yok (koddaki sabitler).
- Sonuç kâğıdı, veli raporu, Sonuç/Veli sekmeleri değişmez.
- Mevcut veriyi bozan migration yok: yalnız yeni tablo + yeni kolon.

## Mevcut durum (kod incelemesi, 2026-10-21)

- Plan: `mentor_haftalari` (öğrenci×hafta tek satır). Görevler, `duzen`, okuma, sonuçlar `icerik` jsonb'de
  (`Icerik` tipi, `src/domains/mentor/takip/takipMath.ts`). Kapalı hafta `kapali_at` + trigger ile salt okunur;
  kapatma anında okul ödevleri `okul_odevleri` jsonb'ye sabitlenir.
- Okul ödevi: `homeworks` (sınıfa verilir, `due_date`), öğretmen işareti `homework_submissions.status`
  (yapildi/gec/yapilmadi/eksik/mazeretli) + `marked_at` (null = işaretlenmemiş). Takip sayfası bunları
  `HomeworkService.getStudentHomeworkProfile(..., { tumOdevler: true })` → `HomeworkRecord[]` ile okur.
- Butonlar: "Sınıf şablonuna dön" tüm görevleri şablonla değiştirir; "Geçen haftayı kopyala" (`planKopyala`)
  görev+düzen+seviye+hedef taşır; "Herkese uygula" (`TakipService.herkeseUygula`) görev+düzen'i planı olmayan
  mentilere kopyalar; seviye (`seviyeDegistir`) tüm süreleri ölçekler.
- Canlı: takip 1 hesapta açık, 4 hafta satırı / 2 öğrenci; `mentorOdevleri` ve `okuma` hiç kullanılmamış.

## Bölüm 0 — Öğrenciye özel çalışma saatleri

**Veri** — yeni tablo `ogrenci_calisma_saatleri`:
`student_id uuid pk → students`, `school_id`, `gunler jsonb not null`, `not text not null default ''`
(≤300), `updated_by`, `updated_at`. RLS: `mentor_haftalari` ile aynı (`school_id = current_school_id() and
mentor_takip_erisimi(student_id)`). Hafta satırından ayrı olduğu için kopyala/uygula/şablon/seviye işlemleri
yapısı gereği dokunamaz.

`gunler`: 7 elemanlı dizi (0=Pzt…6=Paz), her biri `null` (çalışma yok) ya da
`{ bas: "18:00", bit: "20:30", molaBas?: "19:30", molaBit?: "20:00" }`. Doğrulama (zod, action sınırında):
HH:MM, bas < bit, mola varsa ikisi birden ve bas ≤ molaBas < molaBit ≤ bit.

**Öğrenci dosyası sekmesi** — "Çalışma saatleri" kartı: her gün başlangıç/bitiş (`type="time"`, boş = çalışma
yok), isteğe bağlı tek mola, "Hafta içi hepsine uygula" (Pzt'yi Sal–Cum'a kopyalar), not alanı. Her gün satırında
net süre: "Çar: 2 sa 15 dk" (bit−bas−mola). Kayıt: ayrı server action (otomatik kayıt değil, "Kaydet" düğmesi —
**benim kararım**: kart hafta kaydından bağımsız, basit form).

**Hafta içi düzen metni** — `icerik.duzen` kalır. Boşsa ya da eski varsayılan metne (`VARSAYILAN_DUZEN`)
eşitse "otomatik" sayılır ve saatlerden üretilir: ör. "Pzt–Cum 18.00–20.30 (mola 19.30–20.00) · Cmt 10.00–13.00".
Ardışık aynı günler birleşir; öğrenci notu varsa sona eklenir. Mentör yazarsa o metin kullanılır; alanın yanında
"Saatlerden oluştur" bağlantısı alanı boşaltır (otomatiğe döner). Yeni haftalar `duzen: ''` ile başlar
(**benim kararım**: kopyalanan eski metin saatleri ezmesin). Saat de not da yoksa ve alan boşsa kâğıtta satır çıkmaz.

**Plan sekmesi gün başlığı** — "Çar · 2 sa 10 dk / 2 sa 15 dk". Planlanan = o günün `birim: 'dk'` görevlerinin
toplamı (her gün görevleri her güne sayılır, ödev görevleri dahil; `soru`/`serbest` = 0). Planlanan > müsait →
başlık turuncu + "45 dk fazla". Engel yok. O gün çalışma yok ama görev varsa: "Çalışma saati yok" turuncu.
Saati hiç girilmemiş öğrencide yalnız planlanan süre gösterilir, uyarı yok; üstte tek satır ipucu:
"Çalışma saatleri girilmemiş — Öğrenci dosyası'ndan ekleyin" (bağlantılı).

Plan sekmesi bugünkü düzeninde ("Hafta içi her gün" bloğu + "Güne özel" gün listesi) kalır; sayaç "Güne özel"
altındaki gün başlıklarına eklenir.

## Bölüm 1 — Yapılmayan ödevler plana otomatik gelir

**Görev bağı** — `Gorev`'e isteğe bağlı alanlar: `odevId?: string` (homeworks.id), `teslim?: string`
(due_date, etiket için). Ödev görevi:
`ad = "<dersKisa(subject)> — <title>"` (kısaltılır, ≤120), `ders = subject`, `miktar 30`, `birim 'dk'`,
`soruSatiri false`, grupsuz. `icerik.gizliOdevler?: string[]` — mentörün o hafta sildiği ödev id'leri.

**Aday ödevler** (öğrencinin `HomeworkRecord`'larından):
- `status` ∉ {yapildi, gec, mazeretli} (işaretlenmemiş dahil),
- `due_date` ≤ gelecek haftanın Pazartesisi (P+7),
- `due_date` ≥ bugün − 21 gün (**3 hafta sınırı**, kullanıcı onayı); daha eskisi yalnız listede,
- planda (`odevId`) ya da `gizliOdevler`'de değil.

**Ne zaman birleşir** — `TakipService.sayfaVerisi` her açılışta, haftanın taslağına/kaydına saf bir fonksiyonla
(`odevleriYerlestir`) eklenir. Yalnız kapalı olmayan ve Pazarı ≥ bugün olan haftalarda (geçmiş haftaya
"geçmemiş gün" yok — **benim kararım**). Eklenen görevler istemci state'ine girer ve sonraki otomatik kayıtla
kalıcılaşır; kaydedilene kadar her açılışta aynı girdiyle yeniden hesaplanır. Kâğıt sayfası da aynı birleşmiş
veriyi kullanır.

**Yerleşim** (saf fonksiyon, `src/domains/mentor/takip/odevYerlesim.ts`):
- İlk açık gün `ilk` = bu hafta ise bugünün indeksi, gelecek hafta ise 0 (Pzt).
- Müsait süre: öğrencinin o günkü net süresi; saat hiç girilmemişse her gün **150 dk varsayılan** (yalnız
  yerleşimde kullanılır, ekranda/kâğıtta gösterilmez). O gün `null` ise o gün kapalı.
- **Ödev payı** = müsait sürenin yarısı (`floor(müsait/2)`). Yerleşim yalnız o güne düşmüş ödev görevlerinin
  süresine bakar; mentör/şablon görevleri hesaba katılmaz (kullanıcı onayı — ödevler haftaya yayılsın, kısaltma
  kararı mentörde).
- **Teslimi gelecek** (due ≥ bugün): hedef = due − 1 gün (P+7 teslim → Pazar). Hedef < `ilk` ise gecikmiş gibi
  davranılır. Hedef kapalıysa ve payı doluysa geriye doğru (`ilk`'e kadar) ilk açık ve payı yeten gün; bulunamazsa
  hedefin kendisi (kapalıysa hedeften önceki en yakın açık gün, o da yoksa hedef) → aşım uyarısı Bölüm 0 sayacından
  gelir. "Sonraki güne kaydır" teslim gününe/sonrasına düşeceği için uygulanmaz (**benim kararım**).
- **Gecikmiş** (due < bugün ya da hedef < `ilk`): en eski teslimli önce, `ilk`'ten Pazar'a ilk açık ve payı yeten
  gün. Sığmazsa plana **girmez** (kullanıcı onayı) → "Plana girmeyen ödevler" listesi; sonraki açılışta/haftada
  yer açılınca girer.
- Sıra: önce gelecek teslimliler (teslim tarihine göre), sonra gecikmişler — teslimi yakın olan yer kapmasın diye
  önce yerleşir (**benim kararım**).
- Determinizm: aynı girdi → aynı çıktı (sıralama: due_date, sonra subject, sonra id).

**Durum senkronu** — her açılışta ödev görevlerinin `yapti`'si öğretmen işaretinden yeniden hesaplanır
(yapildi/gec → true, diğer → false). Plan ekranında ödev görevinin "yapıldı" kutusu yok/salt okunur; kaynak
öğretmen. Öğretmen sonradan "mazeretli" derse görev planda kalır, yapti false (**benim kararım**; mentör silebilir).
Kapalı haftada senkron/birleşme yok.

**Planda duran ödev görevleri** (**benim kararım**): kaydedilmiş görevin günü sabittir; gün geçse de yer
değiştirmez. Öğretmen teslim tarihini değiştirirse görev yerinde kalır, `teslim`/etiket kayıttan tazelenir.
Ödev silinirse (homeworks.deleted_at) görev birleşmede plandan düşer. Kaydedilmemiş (taslak) birleşmede yerleşim
her açılışta yeniden hesaplanır — mentör dokunmadıysa gün ilerledikçe gecikmişler bugüne kayar; bu istenen davranış.

**Silme** — mentör ödev görevini silince `odevId` `gizliOdevler`'e eklenir; o hafta tekrar gelmez. Sonraki haftanın
gizli listesi boş başlar → hâlâ yapılmamışsa ve 3 hafta içindeyse yeniden gelir.

**Kopyalama/şablon/uygula/seviye** (mevcut veriye dokunmadan):
- `planKopyala` (Geçen haftayı kopyala + yeni hafta taslağı): `odevId`'li görevler ve `gizliOdevler` taşınmaz;
  ödevler yeni haftada birleşmeyle taze gelir. `duzen` taşınmaz (`''`).
- "Sınıf şablonuna dön": yalnız `odevId`'siz görevler değişir, ödev görevleri kalır.
- `herkeseUygula`: kaynaktan yalnız `odevId`'siz görevler kopyalanır; `duzen` kopyalanmaz (her öğrenci kendi
  saatlerinden). Hedefin ödevleri hedefin kendi planında birleşmeyle gelir.
- `seviyeDegistir`: `odevId`'li görevlerin süresi ölçeklenmez. `gruplandir`: ödev görevleri gruplanmaz.
- Çalışma saatlerine hiçbiri dokunmaz (ayrı tablo).

**Etiket** — plan ekranı ve kâğıtta: due < bugün → "gecikmiş" (kırmızı), due = yarın → "yarın teslim" (turuncu),
diğer → "teslim gg.aa" (gri). Siyah-beyaz kâğıtta metin olarak (renk tek ayırt edici değil).

**Yeni rozeti + tekrar yazdır uyarısı** — yeni kolon `mentor_haftalari.kagit_basildi_at timestamptz`.
Kâğıt sayfası (tekli `/takip/kagit` ve toplu `/mentorluk/takip-kagitlari`) açıldığında, hafta kayıtlıysa ve kapalı
değilse damga yazılır (**benim kararım**: "Yazdır"a basmayı yakalamak paylaşılan PrintButton'u değiştirir; sayfayı
açmak yazdırma niyeti). Kapalı haftada trigger yazımı reddeder → damga atlanır. Plan sekmesinde
`kagit_basildi_at`'ten sonra **verilmiş** (homeworks.created_at — `HomeworkRecord`'a eklenecek alan) ödev
görevlerinde "yeni" rozeti (görevin plana giriş zamanı kullanılmaz: kaydedilmemiş birleşme her açılışta yeniden
hesaplandığından giriş zamanı hep "şimdi" olur, rozet yanlış yanar); en az biri varsa üstte:
"Kâğıt yazdırıldıktan sonra N yeni ödev eklendi — tekrar yazdır." Damga hiç yoksa rozet/uyarı yok.
Not: hafta kaydı yokken (taslak) kâğıt açılırsa `YazdirBaglantisi` zaten önce kaydı zorluyor.

**Planın altındaki listeler** — tek bölüm "Plana girmeyen ödevler": gizlenenler, sığmayan gecikmişler, 3 haftadan
eski yapılmamışlar, teslimi P+7'den sonra olanlar (gelecek hafta). Her satırda etiket + "Plana ekle" düğmesi
(gizliden çıkarır / ilk açık güne koyar — **benim kararım**, mentörün elle göreve çevirme yolu kaybolmasın).
Plandaki ödevler burada tekrarlanmaz. Kapalı hafta sabit görüntüsü (`okul_odevleri`) eski biçimde de okunabilmeli.

**Özet sayıları** — `ozetHesapla` ödev görevlerini de sayar (gorev_toplam/yapilan); ayrıca bir şey gerekmez.

## Bölüm 2 — Öğrenci kâğıdı yeniden tasarım

`OgrenciKagidi.tsx` yeniden yazılır (sonuç kâğıdı ve onun kullandığı `OkulOdevTablosu`/`ImzaAlanlari` ihtiyacı
korunur). Tekli ve toplu kâğıt sayfası aynı bileşeni kullanır.

1. A4 dikey; `@page` kenar boşlukları; hedef 1 sayfa, en fazla 2. Gün kutuları `break-inside: avoid`.
2. **Üst bant**: solda okul adı, "Haftalık Çalışma Planı", öğrenci · sınıf; sağda hafta aralığı. Altında büyük:
   "Bu hafta hedefin: {soruHedefi} soru". Altında tek satır "Günlük düzen: …" (Bölüm 0 metni).
3. **Gövde**: 2 sütunlu ızgara, görevi olan her gün bir kutu (Pzt…Paz). Başlık kalın:
   "Çarşamba · 21 Ekim · 18.00–20.30" (saat yoksa yalnız gün · tarih). Görevler alt alta:
   `18.00  ☐ Matematik — MEB s.35-36 …… 30 dk`.
   - Saat: günün başlangıcından, sırayla `dk` sürelerine göre; molaya denk gelen ya da molayı kesen görev molanın
     bitişinden başlar. `soru`/`serbest` görevler saatsiz, sonda "+" ile. O gün saat yoksa saat sütunu yok.
   - Gün içi sıra: ödev görevleri önce (teslim tarihine göre), sonra diğerleri mevcut sırada (**benim kararım**).
   - Ödev görevinde etiket metni (gecikmiş / yarın teslim / teslim gg.aa).
   - Yalnız `soruSatiri` görevlerde altında küçük "Çözdüm: ___ Doğru: ___" (kitap varsa kitap adı + sayfa —
     `kitapSayfaYaz`).
   - Kutunun altında 2 boş satır: "Yeni ödev: ________ Teslim: ____".
4. **Alt bant** (küçük): "Plana girmeyen ödevler" kısa listesi (varsa); okuma kitabı/mentör ödevleri yalnız doluysa
   tek satır; yan yana "Öğretmen notu" kutusu ve "Veli imzası + Günlük ortalama ekran süresi: ___ saat".
5. Siyah-beyaz: gri dolgu ve gereksiz çizgi yok, gövde ≥ 11pt, gün başlıkları kalın, etiketler metinle ayırt edilir
   (gecikmiş kalın, diğerleri normal).
6. Sonuç kâğıdı (`SonucKagidi.tsx`, `/sonuc-kagidi`) değişmez.

## Saf fonksiyonlar (unit test hedefi)

`src/domains/mentor/takip/calismaSaatleri.ts`: `netSure(gun)`, `duzenMetni(gunler, not)`,
`gorevSaatleri(gun, gorevler)` (kâğıt saatleri, mola kaydırma), `gunSayaci(gorevler, gun, saatler)`.
`src/domains/mentor/takip/odevYerlesim.ts`: `odevleriYerlestir(...)`, `odevEtiketi(due, bugun)`,
`planaGirmeyenler(...)`. Mevcut `planKopyala`, `seviyeDegistir`, `gruplandir`, `herkeseUygula` için ödev görevi
korunma testleri.

## Test (kullanıcının listesi)

- İki öğrenciye farklı saat; "Bu planı tüm mentör öğrencilerime uygula" sonrası saatler değişmemiş (e2e + DB).
- Yerleşim: teslimi geçmiş, yarın teslim, hafta sonu teslim, gelecek Pazartesi teslim; saati boş güne ve payı dolu
  güne düşen ödev (unit, saf fonksiyon).
- Öğretmen "yapıldı" işaretleyince plandaki görev yapıldı (integration ya da e2e).
- Silinen otomatik görev geri gelmiyor (unit + e2e).
- 7 günü dolu, molalı plan: kâğıt baskı önizlemesi, saatler doğru, 1–2 sayfa (e2e `emulateMedia print` + PDF
  sayfa sayısı).
- Mevcut `mentor-takip.spec.ts` kâğıt testleri ("Program" tablosu) yeni yapıya güncellenir.

## Migration

`supabase/migrations/2026102112xxxx_mentor_calisma_saatleri.sql`: `create table ogrenci_calisma_saatleri` + RLS +
`alter table mentor_haftalari add column if not exists kagit_basildi_at timestamptz`. Canlıya uygulamadan önce
tam pg_dump (kullanıcı kuralı) ve DDL'in kullanıcıya gösterilmesi; ardından DB tipleri regen.

## Builder'a bırakılanlar

Bileşen bölünmesi, etiket renk tonları, kâğıt piksel ölçüleri, "Plana ekle" düğmesinin tam yerleşimi, ödev
görevi adının kısaltma uzunluğu.
