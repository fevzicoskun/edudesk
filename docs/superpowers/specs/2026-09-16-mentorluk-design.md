# Mentörlük Ekranı — Tasarım

**Tarih:** 2026-09-16
**Durum:** Onaylandı (kullanıcı onayı alındı, implementasyona hazır)

## Amaç

Öğretmenin mentörlük yaptığı öğrenciler için (a) öğrenciyi tanıma bilgilerini
saklamak, (b) görüşme notlarını biriktirmek, (c) mentörlük çalışma düzenini
yazılı olarak elinin altında tutmak.

Mentörlük maddeleri okul yönetimiyle (müdür yardımcısı) birlikte belirlenmiştir;
bu tasarım o maddeleri olduğu gibi karşılar, fazlasını yapmaz.

## Mevcut durum

Kısmi bir altyapı zaten var ama hiç kullanılmamış:

| Varlık | Durum | Karar |
|---|---|---|
| `mentor_reports` (student_id, class_id, content, report_date) | 0 kayıt, servis + repo yazılmış | **Kullanılacak** — görüşme notları bu tabloda |
| `mentor_students` (teacher_id, full_name, parent_name, phone) | 0 kayıt, okul öğrencisine bağlı değil, UI'sı yok | **Silinecek** — amacı bu işle örtüşmüyor, iki benzer tablo karışıklık yaratır |
| `classes.mentor_teacher_id` + `MentorAtamaKarti` | çalışıyor, hiç atama yapılmamış | **Dokunulmayacak** — sınıf rehberliği ayrı bir kavram |
| `RehberlikRaporlariSection` (öğrenci detay sayfasında) | çalışıyor ama gömülü | **Kalacak** — aynı veriyi gösterir; mentörlük ekranı ikinci bir giriş noktası olur |

**Yan etki (kabul edildi):** `mentor_reports` okuması mentöre daraltılınca, öğrenci
detay sayfasındaki "Rehberlik Raporları" bölümü müdür / müdür yardımcısı / zümre
başkanı için boş görünecek. Şu an 0 kayıt olduğu için kimse bir şey kaybetmiyor;
kullanıcının "sadece ben" kararının doğrudan sonucudur.

Hiç kullanılmamış olmasının sebebi teşhis edildi: not alma özelliği var ama
kendi ekranı yok — öğrenci detay sayfasının içine gömülü olduğu için
mentörlük bir "yer" değil, bir alt bölüm.

## Kararlar

Brainstorm sırasında kullanıcıyla netleştirildi:

1. **Çalışma düzeni maddeleri sabit metindir.** Her öğrencide aynı olduğu için
   veri değil içerik olarak durur. Öğrenci başına tek bir "anlatıldı" tarihi tutulur.
2. **Öğrenci listesi kişiseldir.** Mentör, okul öğrencileri arasından kendi
   listesini kurar; sınıf rehberliğinden bağımsızdır.
3. **Notlar yalnız mentöre aittir.** Müdür, müdür yardımcısı, zümre başkanı ve
   veli göremez. Bu, mevcut `mentor_reports` SELECT politikasının daraltılmasını
   gerektirir (şu an yönetici rollerine tüm notları okutuyor).

## Veri modeli

Tablo adlandırması kod tabanının mevcut düzenine uyar (İngilizce tablo/kolon).

### `mentorships` (yeni)

Mentörün kişisel öğrenci listesi.

| Kolon | Tip | Not |
|---|---|---|
| id | uuid pk | |
| mentor_id | uuid not null | profiles(id) |
| student_id | uuid not null | students(id) |
| school_id | uuid not null | tenant |
| created_at | timestamptz default now() | |

- UNIQUE (mentor_id, student_id) — aynı öğrenci iki kez eklenemez
- Index: (mentor_id, school_id)
- Öğrenci listeden çıkarılırsa satır silinir (hard delete); notlar ve profil kalır.

### `mentor_profiles` (yeni)

Öğrenci tanıma kartı — öğrenci başına bir satır, zamanla güncellenir.

| Kolon | Tip | Karşılığı (mentörlük maddesi) |
|---|---|---|
| id | uuid pk | |
| mentor_id | uuid not null | |
| student_id | uuid not null | |
| school_id | uuid not null | |
| goals_short | text | Kısa vadeli hedefler |
| goals_long | text | Uzun vadeli hedefler |
| interests | text | Hobi / spor / sanat / ilgi |
| family_info | text | Aile, anne-baba iş durumu, kardeşler |
| study_environment | text | Ders çalışma ortamı |
| special_note | text | Aktarmak istediği özel durum |
| support_request | text | İstediği destek / özel isteği |
| rules_explained_at | date | Okul kuralları ve mentörlük düzeni anlatıldı |
| updated_at | timestamptz | |

- UNIQUE (mentor_id, student_id) — upsert anahtarı
- Tüm metin alanları nullable; her alan 2000 karakterle sınırlı (servis doğrulaması)

### `mentor_reports` (mevcut, değişiklik: yalnız RLS)

Görüşme notları. Şema aynı kalır.

- SELECT politikası daraltılır: `mentor_id = auth.uid() AND school_id = current_school_id()`
- Yönetici rollerinin okuma kolu kaldırılır

### `mentor_students` (mevcut)

Tablo ve ona bağlı servis/repo/action kodu silinir (0 kayıt, ölü kod).

## Yetki

Üç tabloda da tek kural: **satır mentöre aittir.**

```sql
mentor_id = (select auth.uid()) and school_id = current_school_id()
```

- SELECT / INSERT / UPDATE / DELETE — hepsi aynı koşul
- Uygulama katmanında `getAbility()` ile `P.STUDENTS.READ` kontrolü (öğrenci
  listesini görebilme), yazma işlemlerinde ayrıca satır sahipliği
- Öğrenci ekleme sırasında `student_id`'nin aynı okula ait olduğu doğrulanır
  (cross-tenant koruması)

Bugün ödev yetkisinde kurulan ilkeyle aynı çizgidedir: yazma ve okuma sahibine aittir.

## Ekranlar

### `/mentorluk` — liste

- Başlık: "Mentörlüğüm (N öğrenci)"
- Her satır: öğrenci adı, sınıfı, son görüşme tarihi
- 30 günden uzun süredir görüşülmemiş öğrenci soluk bir uyarı rozetiyle işaretlenir
- Hiç görüşülmemiş öğrenci "henüz görüşülmedi" olarak görünür
- `+ Öğrenci ekle` → okul öğrencilerinde ada göre arama, seçince listeye eklenir
- Boş durum: mentörlüğün ne işe yaradığını anlatan kısa metin + ekleme çağrısı

### `/mentorluk/[studentId]` — öğrenci detayı

Üç bölüm, alt alta:

1. **Tanıma kartı** — 7 alan, tek formda düzenlenir, kaydet ile upsert edilir.
   Boş alanlar "—" ile gösterilir; düzenle moduna geçince textarea olur.
2. **Görüşme notları** — tarih + serbest metin. Yeni not ekleme formu üstte,
   geçmiş notlar tarihe göre tersten listelenir. Not silinebilir.
3. **Mentörlük düzenimiz** — sabit 5 madde (aşağıdaki metin) + "Öğrenciye
   anlatıldı" kutusu; işaretlenince `rules_explained_at` bugüne set edilir.

### Mentörlük düzeni metni (kodda sabit)

```
• Ödev ve deneme kontrolleri yapılır; sonuca göre etüt veya ekstra ders tanımlanır.
• Ödev defteri tutmak zorunludur.
• Veli bilgilendirmesi en fazla iki haftada bir yapılır.
• Her ödev, ödev kaşesiyle mentör tarafından kontrol edilir.
• Her dersten en az bir ana kaynak getirilir; haftada bir gün kontrol edilir.
```

Metin `src/domains/mentor/mentorshipRules.ts` içinde dizi olarak tutulur.

## Katmanlar

Mevcut domain düzenine uyar (`repositories → services → actions`):

- `src/domains/mentor/repositories/MentorRepository.ts` — yeni tablolar için
  sorgular eklenir, `mentor_students` fonksiyonları silinir
- `src/domains/mentor/services/MentorService.ts` — yetki + doğrulama
- `src/domains/mentor/validators/index.ts` — zod şemaları (yeni)
- `app/actions/mentor.ts` — server action'lar, `revalidatePath('/mentorluk')`
- `app/(dashboard)/mentorluk/` — sayfa ve bileşenler
- Kenar çubuğuna "Mentörlük" girişi

## Hata durumları

- Öğrenci başka okuldansa → "Öğrenci bulunamadı"
- Aynı öğrenci ikinci kez eklenirse → 23505 yakalanır, "Bu öğrenci zaten listenizde"
- Yazma işlemi 0 satır etkilerse → sessiz başarı değil, açık hata
  (bugün ödev silmede öğrenilen ders: `.select('id')` ile satır sayısına bağla)
- Not içeriği boşsa → kaydedilmez

## Test

**Unit (vitest):**
- Servis: giriş yok / yetki yok / başka okulun öğrencisi / mükerrer ekleme
- Servis: profil upsert, alan uzunluk sınırı
- Not ekleme/silme: yalnız kendi notu
- 0 satır etkilenmesi → hata döner

**E2E (playwright):**
- Mentörlük sayfası açılır, boş durum görünür
- Öğrenci eklenir, listede görünür
- Tanıma kartı doldurulur, kaydedilir, sayfa yenilenince durur
- Görüşme notu eklenir, listede görünür

**Canlı doğrulama:** SQL ile satırlar + tarayıcıda ekran (iki katman ayrı ayrı).

## Kapsam dışı

Bilinçli olarak yapılmayacaklar — madde metninde yazılı durur, sistem takip etmez:

- Veli bilgilendirme hatırlatması / sayacı
- Etüt ve ekstra ders tanımlama akışı
- Ödev kaşesi kaydı, ödev defteri takibi
- Kaynak kontrolü çizelgesi
- Mentörlük raporu / yönetime özet

Gerekçe: kullanıcının açık isteği "basit olsun, sistemi de yormayalım".
Bu maddelerin her biri ayrı bir takip mekanizması demek; ihtiyaç kanıtlanınca
ayrı iş olarak ele alınır.
