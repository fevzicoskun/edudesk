# Veli toplantısı kâğıdı (deneme gidişi + ödev raporu) — tasarım

Tarih: 2026-10-22 · Durum: taslak — kullanıcı onayı bekliyor (kurucu incelemesi yapıldı)

## Niyet ve neden

Birinci dönem veli toplantıları yaklaşıyor. Mentör, her öğrencisi için masaya koyacağı bir kâğıt istiyor. Kullanıcının
kendi sözüyle en çok işine yarayacak iki şey: **denemelerin sonuçları** ve **ödev raporları**. Ödev verisi EduDesk'te
Eylül'den beri birikiyor. Deneme sonuçları ise okulda Stoys'ta; mentör oradan Excel indirebiliyor ama bugün EduDesk'e
giremiyor.

Başarı: mentör toplantıdan önce kendi öğrencilerinin kâğıtlarını tek seferde basar. Veli kâğıtta çocuğunun
denemelerde **nereye gittiğini** (asıl önemli olan) ve hangi ödevleri yapmadığını görür.

## Kim, ne yapar

- **Mentör** kendi öğrencileri için her şeyi kendisi yapar: Stoys Excel'ini yükler, kâğıdı basar.
  ("herkes kendi mentörü için uğraşacak" — kullanıcı kararı.) Okul geneli toplu yükleme YOK.
- İdare için ayrı ekran yok, ama **müdür ve müdür yardımcısı deneme sonuçlarını okuyabilir** (kullanıcı kararı 2026-10-23; mevcut `is_mudur_or_my()` deseni). Yazma/silme yalnız güncel mentör.

## Deneme verisi

### Okulun deneme düzeni (kullanıcıdan)
- AGİS denemeleri üç türdür: **TM** (Türkçe, Matematik), **FKB** (Fizik, Kimya, Biyoloji), **TCD** (Tarih, Coğrafya, Din).
- Yaklaşık iki haftada bir AGİS yapılır, sıra TM → FKB → TCD. Her tür kabaca altı haftada bir tekrarlar.
- Arada genel denemeler de olur; **şu ana kadar hiç yapılmadı**, örnek dosya yok → bu sürümün DIŞINDA.

### Stoys Excel biçimi (3 gerçek dosyadan, 9-A)
- Tek sayfa. 1. satır birleştirilmiş başlık " Stoys Rapor ", 2. satır sütun adları, 3. satırdan itibaren öğrenciler.
  Hücreler satır içi metin (sharedStrings yok); Türkçe karakterler sağlam.
- Sütunlar: `OKUL, SINIF, Öğrenci No, Adı Soyadı`, sonra her ders için `<KOD>-SS, -D, -Y, -N, -YB`
  (soru sayısı, doğru, yanlış, net, yüzde), sonra `TOP-SS … TOP-YB`, `AGIS-Puan`, `AGIS-Sınıf/Okul/Genel` (sıralar BOŞ).
- Ders kodları: TM → `TÜR, MAT`; FKB → `FİZ, KİM, BİY`; TCD → `TAR, COĞ, DİN`. **Tür sütunlardan anlaşılır.**
- **Sınav adı ve tarihi Excel'de YOK** (PDF'in altında "GM2627 - 9 AGİS TCD 01" yazıyor ama Excel'e gelmiyor).
- Sınava girmeyen öğrenci dosyada hiç yok (aynı sınıfın dosyalarında 21/22/23 satır).
- Adlar büyük harfle ("YAĞMUR CEYLİN BAŞTÜRK"). Kullanıcı: **eşleştirme ad soyadla, numaraya gerek yok.**

### Yükleme akışı
1. Mentörlük sayfasında "Deneme yükle". Mentör .xlsx seçer ve **sınav tarihini** girer (varsayılan bugün).
2. Sistem türü sütunlardan bulur; tanımadığı bir dosyada açık bir hata verir ve hiçbir şey yazmaz.
3. Önizleme gösterilir:
   - mentörün öğrencilerinden **eşleşenler** ve toplam netleri;
   - mentörün öğrencilerinden **dosyada olmayanlar** ("katılmadı");
   - dosyada olup mentörün öğrencisi olmayan satırlar yalnız sayı olarak ("18 satır başka öğrencilere ait, alınmadı").
4. Mentör onaylar → kaydedilir.
- **Kimlik:** aynı okulda aynı tür + aynı tarih = aynı sınav. Aynı sınıfın dosyasını iki mentör yüklerse sınav ikilenmez;
  her mentör kendi öğrencilerinin satırlarını yazar. Aynı sınavı tekrar yüklemek o öğrencilerin sonucunu günceller.
- Yanlış yüklemeyi geri almak için mentör kendi öğrencileri için o sınavın sonuçlarını silebilmeli.

### Kurucu incelemesinden sonra verilen kararlar (benim kararım — kullanıcı onayına sunuldu)
- **Sınav kimliğine seviye girer:** okul + tür + **sınıf seviyesi** (SINIF sütunundan: "9-A" → 9) + tarih.
  Aynı gün 9 ve 10. sınıf TM'si ayrı sınavdır.
- **Tarih ikilenmesin:** önizlemede aynı okul+tür+seviye için son 14 günde yüklenmiş bir sınav varsa
  "Bu, 20 Ekim'deki TM ile aynı sınav mı?" diye o sınav önceden seçili gelir; mentör yeni tarih de girebilir.
- **"Katılmadı" yalnız dosyanın sınıfındaki öğrencilere:** mentörün başka sınıflardaki öğrencileri o yüklemeden
  etkilenmez (onlar için o sınav "yüklenmedi", kâğıtta görünmez). Mentör her sınıfın dosyasını ayrı yükler.
  "Katılmadı" saklanmaz: sınav o seviyede var + öğrencinin sınıfından yükleme var + öğrencinin satırı yok → katılmadı.
- **Ad eşleşmezse:** önizlemede eşleşmeyen öğrencinin yanında, aynı dosyada eşleşmemiş kalan satırlardan seçilebilen
  bir açılır liste (elle eşleştirme). Aynı sınıfta aynı ada sahip iki öğrenci varsa ikisi de eşleşmemiş sayılır,
  mentör seçer. Netler asla elle yazılmaz.
- **Mentör değişirse:** sonuçlar öğrenciye aittir; görünürlük **güncel** mentörlüğe bağlıdır (mevcut desen).
  Yeni mentör eski yüklemeleri görür, eski mentör görmez.

### Gizlilik (pazarlıksız)
- Mentör yalnız **kendi öğrencilerinin** sonuçlarını yazar ve görür (müdür/MY okur). Dosyadaki diğer öğrencilerin satırları
  **saklanmaz.** (Okul `school_id` + mentörlük ilişkisi RLS ile; projedeki mevcut mentör erişim kalıbı.)

## Kâğıt

Mentörün öğrenci sayfasından tek öğrenci için açılır; ayrıca mentörün bütün öğrencileri için "Hepsini yazdır"
(mevcut `takip-kagitlari` deseni). A4, yazdırmaya göre; **gerekirse iki sayfaya taşabilir** (kullanıcı onayı).
PDF adı mevcut desende: "Ad Soyad - Veli Toplantısı" (toplu: "Veli Toplantısı Kâğıtları").

İçerik, sırasıyla:

1. **Başlık:** okul adı, öğrenci adı, sınıf, mentör adı, tarih.
2. **Denemeler — gidiş önce.** Her tür (TM, FKB, TCD) **kendi içinde** izlenir; türler arası tek puan çizgisi
   YOK (kullanıcı kararı: AGİS puanı türler arasında kıyaslanmaz). Her tür için sınavlar eskiden yeniye: tarih,
   ders netleri, toplam net ve bir öncekine göre değişim. Son sınavın ders netleri bu tabloda zaten görünür
   ("ikisi de olsun, gidiş daha önemli").
   - Öğrencinin girmediği sınav "katılmadı" yazar; **asla 0 gösterilmez** (sonuç kâğıdındaki "girilmemiş ≠ 0" kuralı).
   - Hiç deneme yüklenmemişse bölüm tek satır: "Bu dönem için deneme sonucu yüklenmedi."
3. **Ödevler** — dönem başından (`donemBasi()`) bugüne:
   - ders ders yapma oranı;
   - yapılmayan ve eksik ödevlerin **tam listesi** (ders, ödev adı, teslim tarihi) — kullanıcı "hepsi görünmeli" dedi.
   - Öğretmenin işaretlemediği ödevler yapılmadı sayılmaz (`marked_at` kuralı; 2026-10-22 sabah maili hatasının dersi).
   - Var olan "Öğrenci Ödev Özeti" (`siniflar/[id]/ogrenciler/[studentId]/odev-raporu`, `dersGruplari`/`dersOzeti`)
     ve mentör sayfasındaki `OdevDurumu` aynı hesabı yapıyor → yeniden kullanılır, yeni ödev hesabı yazılmaz.
4. **Haftalık plan sonuçları** (kullanıcı ekledi, 2026-10-23): dönem içindeki her mentör takip haftası için TEK SATIR —
   tarih aralığı, programın yüzde kaçı tamamlandı, çözülen soru (hedefiyle), durum etiketi (iyi / orta / düşük).
   Hafta içi ayrıntı (aksayan görevler, kitap) YOK ("yeterli, böyle olsun").
   - Sonucu girilmemiş hafta "girilmedi" yazar, 0 yazmaz; soru girilmemişse soru hücresi "girilmedi".
   - Hesaplar sonuç kâğıdındakiyle AYNI olmalı: `ozetHesapla`, `durumYuzdesi`, `durumOf`, `soruGirildi`
     (`takipMath`, `SonucKagidi.tsx`) yeniden kullanılır — kâğıtlar arası çelişki olmasın.
   - Hiç hafta yoksa bölüm tek satır: "Bu dönem haftalık plan sonucu yok."
5. **Mentör notu:** kâğıtta elle yazmak için boş satırlar + mentör ve veli imza yeri. Sisteme not girilmez.

## Hedef dışı (bu sürüm)
- Genel denemeler (ilk dosya gelince eklenecek).
- Sınıf/okul sırası (Stoys boş veriyor).
- Veliye çevrim içi paylaşım, idare ekranı, okul geneli yükleme.
- Stoys PDF'ini okuma (yalnız Excel).

## Asla olmasın
- Bir mentörün başka öğrencilerin deneme sonucunu görmesi ya da saklanması.
- Katılmadığı sınavda öğrenciye 0 yazılması; işaretlenmemiş ödevin "yapılmadı" sayılması.
- Mentörün netleri elle yazmak zorunda kalması.

## Kurucuya bırakılanlar
Tablo ve sütun adları, deneme verisinin saklama biçimi (ders netleri satır mı JSON mu), ad eşleştirmede Türkçe
büyük/küçük harf normalizasyonu (`İ/I/ı/i`, fazla boşluk), Excel okuma kütüphanesi (projede `exceljs` kurulu),
gidişin tablo mu küçük çizgi grafik mi olacağı (siyah-beyaz baskıda okunur kalmak şartıyla), "Deneme yükle"
düğmesinin mentörlük sayfasında tam yeri.
