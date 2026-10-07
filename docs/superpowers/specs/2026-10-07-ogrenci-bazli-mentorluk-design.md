# Öğrenci Bazlı Mentörlük — Tasarım

**Tarih:** 2026-10-07
**Durum:** Bölümler sohbette onaylandı; yazılı spec kullanıcı incelemesinde

## Amaç

Okul ödev takibinde STOYS'tan vazgeçti, ortak Excel dosyasına döndü; Excel'de
"aradığını bulmak" çok zor. EduDesk'e dönüş ihtimali var. Bu tasarım o dönüşün
önündeki en büyük boşluğu kapatır:

Sınıflar mentörler arasında **bölündü** (bir sınıfın yarısı bir öğretmende, yarısı
başkasında). Mentör, **kendi öğrenci grubunu** tek yerden görmeli, tüm derslerdeki
ödevlerini takip etmeli ve toplantı öncesi çıktı alabilmelidir.

**Başarı ölçütü:** mentör, öğrencilerinin tüm derslerdeki ödev durumunu tek ekranda
görür; veli toplantısı / kurul / öğrenci görüşmesi öncesi iki tıkla çıktı alır;
idare bir sınıfı iki mentöre birkaç tıkla bölebilir.

## Kullanıcı kararları (brainstorm, 2026-10-07)

1. **Atama:** hem idare (müdür / MY) atar, hem mentör kendine ekleyebilir (C).
2. **Bir öğrencinin tek mentörü** vardır.
3. **Görünüm:** mentörlük ekranında öğrenci × ders tablosu (A). `/odevler` listesine
   filtre EKLENMEZ (28 Eylül kararı: ödevler sekmesinde başkasının ödevi karışıklık yaratır).
4. **Çıktı:** üç toplantı türü de (veli, kurul/idare, öğrenci görüşmesi).
5. **Tarih aralığı:** varsayılan dönem başı, "şu tarihten itibaren" seçilebilir (B).
6. **Eski "Sınıf Rehber Öğretmeni" kartı kaldırılır** (A) — canlıda 0 atama.
7. Mentör değişince eski mentörün tanıma kartı/notları yeni mentöre **geçmez**.
8. Mentör, idarenin yaptığı atamayı kendisi kaldıramaz.
9. Hücre biçimi "4/5" (yüzde değil); tablo çıktısı yatay A4.

## Mevcut durum (canlı, 2026-10-07)

| Varlık | Durum |
|---|---|
| `mentorships` (mentor_id, student_id, school_id; unique(mentor_id, student_id)) | 1 kayıt, 1 mentör. RLS yalnız sahibine. |
| `mentor_profiles`, `mentor_reports` | 2 / 1 kayıt, yalnız mentöre görünür |
| `classes.mentor_teacher_id` + `MentorAtamaKarti` | 0 atama |
| Öğrenci sayfası | her öğretmen öğrencinin TÜM ödevlerini salt-okunur görür (`getStudentHomeworkProfile({tumOdevler:true})`) |
| `OgrenciOdevOzeti` | tek öğrenci A4 raporu; sınıf "Ödev Özetleri" toplu basımında da kullanılıyor |
| Veli linki | veli portalı öğrencinin tüm ödevlerini gösteriyor |
| `donemBasi()` | `src/shared/utils` — dönem başı ISO tarihi |

## Bölüm 1 — Veri modeli ve yetki

### Migration

- `mentorships`: `unique (mentor_id, student_id)` düşer → **`unique (student_id)`**.
  Canlıdaki tek kayıt bu kurala uyuyor (migration öncesi `group by student_id having count>1` = 0 doğrulanır).
- Yeni kolon `assigned_by uuid references profiles(id) on delete set null` — atamayı yapan.
  Mevcut satırlar için `assigned_by = mentor_id` (kendi eklemiş sayılır).
  "İdare atadı" = `assigned_by <> mentor_id`.
- DB tipleri regen edilir (tsc kırılmasın).

### RLS (`mentorships`)

| İşlem | Mentör (öğretmen rolleri) | Müdür / MY (`is_mudur_or_my()`) |
|---|---|---|
| SELECT | kendi satırları | okuldaki tüm satırlar |
| INSERT | yalnız `mentor_id = auth.uid()` ve `assigned_by = auth.uid()` | okuldaki herhangi bir öğretmen için |
| UPDATE (mentör değiştir) | ✗ | ✓ |
| DELETE | yalnız `mentor_id = auth.uid() and assigned_by = auth.uid()` | ✓ |

Her kol `school_id = current_school_id()` ile sınırlı. Öğrencinin ve mentörün aynı
okulda olduğu servis katmanında doğrulanır (fail-closed). "Bu öğrencinin mentörü X"
mesajı için mentör, mentörlüğü olan öğrencilerin **mentör adını** görmelidir:
`ogrenci_mentorleri(p_school)` SECURITY INVOKER yerine, ekleme listesinde yalnız
bunun için `ogrenci_mentor_adlari()` adlı dar bir SECURITY DEFINER RPC eklenir:
yalnız çağıranın okulundaki `student_id → mentör adı` çiftlerini döner (satırın geri
kalanı — kim atadı, ne zaman — açılmaz; SELECT policy genişletilmez).
INSERT çakışması (23505) satır içi hata olur.

### Değişmeyen

- `mentor_profiles` / `mentor_reports` yalnız mentöre ait; idare göremez.
- Ödevler için yeni yetki yok — homeworks / homework_submissions okul geneli okunur.
- `classes.mentor_teacher_id` kolonu ve onu okuyan yoklama yolları (yoklamaHatirlatici —
  kapalı, gunlukOzet yoklama eksik bloğu, AttendanceRepository) **dokunulmaz**. Yoklama
  geri açılırsa "sınıf sorumlusu" o işin parçası olarak ele alınır.

## Bölüm 2 — Ekranlar

### `/mentorluk` (Mentörlüğüm)

- Üstte `Şu tarihten itibaren: [date]` — değer `?bas=YYYY-MM-DD`; yoksa/bozuksa `donemBasi()`.
- Öğrenci × ders tablosu (masaüstü):
  - Satır: öğrenci, sınıf, her ders için hücre, son görüşme.
  - Hücre: `yapılan/değerlendirilen`, eksik varsa `(1e)`; dersten hiç ödev yoksa `—`.
    Hesap `dersOzeti` ile aynı (mazeretli + kontrol edilmemiş paydada yok).
  - Renk yalnız rakamda; kırmızı eşiği `odevSeviyesi` ile aynı.
  - Sütunlar: öğrencilerin seçilen aralıktaki ödevlerinin dersleri (`dersAnahtari`), alfabetik.
  - Öğrenci adı → `/mentorluk/[id]?bas=…`.
- Telefon: öğrenci başına satır + altında `dersOzetiMetni` biçiminde ders satırı (flex-wrap).
- Düğmeler: **Tabloyu yazdır**, **Hepsini yazdır** (öğrenci yoksa gizli).
- Ekleme kutusu: başkasına atanmış öğrenci "mentörü: X" ile, seçilemez.
- Listeden çıkarma: idare atamasında düğme yok, yerine "İdare atadı" notu.

### `/mentorluk/[id]`

Mevcut tanıma kartı + notlar + çalışma düzeni aynen. Eklenen:
- **Ödev durumu** bölümü: ders satırı + yapılmayan/eksik ödev listesi (seçilen aralık).
- **Yazdır** (tek öğrenci, `OgrenciOdevOzeti`).
- **Veli linki** (kopyala / WhatsApp) — mevcut veli token akışı.

### Sınıf sayfası (`/siniflar/[id]`) — yalnız müdür / MY

- Öğrenci listesine "Mentör" sütunu (yoksa `—`).
- Satır seçim kutuları + `Seçilenlere mentör ata → [öğretmen ▾]` ve `Mentörü kaldır`.
  Var olan mentörün üzerine yazar (upsert on student_id). Tek server action, tek sorgu.
- `MentorAtamaKarti` + `assignClassMentor` (action, servis, repo fn, unit testi) silinir.

### Öğrenci sayfası

- Başlık altına `Mentörü: X` (yoksa satır yok).
- "Rehberlik Raporları" bölümü `classes.mentor_teacher_id` yerine `mentorships`'e bakar:
  yalnız öğrencinin mentörü kendi notlarını görür (RLS zaten öyle).

### Menü

- En az bir mentörlük satırı olan öğretmende "Mentörlük" günlük gruba çıkar (`navMath`'e
  saf koşul + test). Diğerlerinde değişmez.

## Bölüm 3 — Çıktılar

Belge dili mevcut raporlarla aynı: beyaz zemin, renk yalnız rakamda, öğrenci numarası
YOK, alt bilgi `myedudesk.com.tr`, `yazdirmaBasligi`, print her zaman açık tema.

### Hepsini yazdır — `/mentorluk/yazdir?bas=`

- Mentörün öğrencileri, her biri `OgrenciOdevOzeti` ile ayrı A4 (`break-after-page`).
- Toplu yükleme sabit sorgu sayısıyla (öğrenci sayısından bağımsız; `fetchAll`), öğrenciler
  farklı sınıflardan gelebilir.
- Başlıkta `Mentör: [ad] · [bas] – bugün`.

### Tabloyu yazdır — `/mentorluk/tablo?bas=`

- Yatay A4 (`@page { size: A4 landscape }` yalnız bu sayfada).
- Başlık: okul adı · "Mentör Grubu Ödev Durumu" · mentör · aralık.
- Ekrandaki tablo; `thead` her sayfada tekrar, satır bölünmez.
- **Dikkat edilecekler:** aralıkta 3+ yapılmadı/eksik olan öğrenciler, dersleriyle
  (eşik `/yonetim/odevler` riskliler ile aynı sabit).
- Not + imza satırı.

### Tarih filtresi

`getStudentHomeworkProfile` (ve toplu karşılığı) `bas?: string` alır; ödevleri
`assigned_date >= bas` ile süzer. Ekran, iki çıktı ve tek öğrenci sayfası aynı
fonksiyondan beslenir (tek tanım). Mevcut çağıranlar `bas` geçmez → davranış değişmez.

## Hata davranışı

- Okuma hatası → sayfa error boundary (sessiz boş tablo YOK).
- Atama: başka okulun öğrencisi/öğretmeni → reddedilir; 23505 → "Bu öğrencinin mentörü X";
  0 satır güncellendi → hata (`{count:'exact'}`).
- Bozuk `?bas=` → `donemBasi()`; gelecek tarih → bugün.

## Test

- **Saf mantık (unit):** tablo kurma (`mentorTablosu`: sütunlar, hücre metni, kırmızı eşik,
  dikkat listesi), `bas` ayrıştırma, menü koşulu.
- **Integration (gerçek JWT, RLS):** öğretmen başkasının öğrencisini ekleyemez (unique);
  öğretmen idare atamasını silemez; MY okul içinde atar/değiştirir, başka okulda atayamaz;
  öğretmen başka mentörün satırını göremez; mentör-adı RPC'si yalnız ad döner.
- **E2E:** MY sınıfı ikiye böler → iki mentör kendi yarısını görür; tablo hücresi öğrenci
  sayfasıyla aynı sayıyı gösterir; `?bas=` süzer; hepsini yazdır öğrenci başına 1 PDF sayfası
  (sayfa sayısı ölçülür); tablo yatay; telefonda taşma yok (boundingBox, 6+ dersle).
- Kilit iddialar break-then-revert ile.

## Kapsam dışı (YAGNI)

- `/odevler`'e mentör filtresi.
- Mentör değişince not devri.
- `classes.mentor_teacher_id` kolonunu silmek / yoklama sorumlusu.
- Veliye otomatik periyodik rapor gönderimi.
