# Haftalık Veli Bülteni — Tasarım

**Tarih:** 2026-10-09 · **Durum:** onaylandı (brainstorm) · **Pilot:** 9. sınıflar (yapı mentörlüğe bağlı, her sınıfta çalışır)

## Amaç

Müdür talebi: her cuma her mentör, mentörlük öğrencilerinin velileriyle (1) gelecek haftanın ödevlerini ve (2) geçen haftanın ödev eksiklerini paylaşacak. Mentör bunu EduDesk'ten hazır alsın; başarı ölçütü: bir mentör cuma günü tüm velilerine gönderimi **5 dakikadan kısa** sürede bitirir.

Prototip (2026-10-09, elle üretildi ve kullanıcı onayladı): `C:\Users\mehme\edudesk_excel_aktarim\bulten\bulten.mjs`.

## Kullanıcı kararları

- Veliye **tek kişisel mesaj**: çocuğun geçen hafta eksikleri (yoksa tebrik) + bu hafta kontrol edilecek ödevler.
- Eksikler grupta **isimli paylaşılmaz** (KVKK). Grupta yalnız isimsiz özet.
- Veli grubu için 2 görsel: "bu haftanın ödevleri" ve "geçen haftanın özeti" (yalnız o mentörün öğrencileri üzerinden; alt başlıkta "<Branş> Öğretmeni <Ad>", ör. "Matematik Öğretmeni Fevzi Coşkun").
- Öğrenci başına **kişisel görsel de** olacak.
- Gönderim hem telefondan hem bilgisayardan (WhatsApp uygulaması / WhatsApp Web) + kopyala.
- Hafta seçimi: sayfa **Cuma–Pazar** açılırsa gelecek hafta (önümüzdeki pazartesi), **Pzt–Perş** açılırsa içinde bulunulan hafta; önceki/sonraki hafta okları.
- Görseller **sunucuda PNG** (`next/og` ImageResponse) — yeni npm bağımlılığı yok.
- Mesaj imzası: `Saygılarımızla,\n<Mentör adı>\n<Sınıf> Mentör Öğretmeni` (kullanıcı bu haliyle kalsın dedi).

## Tanımlar

- **Hafta** = pazartesi `P` ile cuma `P+4` (ödev listesinde Pzt–Cuma gösterilir; `P..P+6` aralığındaki kontrol tarihleri dahil edilir, Cumartesi/Pazar kontrollü ödev varsa yalnız o zaman ayrı bir "Hafta sonu" satırı gösterilir).
- **Bu hafta kontrol edilecek ödevler** = mentörün öğrencisinin sınıfında, silinmemiş, şablon olmayan, `due_date ∈ [P, P+6]` ödevler; kontrol gününe göre gruplanır.
- **Geçen hafta** = `[P-7, P-1]`. Bir öğrencinin **eksiği** = o aralıkta `due_date`'li ödevde `marked_at` dolu ve `status ∈ {eksik, yapilmadi}`. Mazeretli, işaretsiz (kontrol edilmedi/bekliyor) eksik sayılmaz.
- **Grup özeti** = geçen haftanın her ödevi için, mentörün o sınıftaki öğrencileri arasında `marked_at` dolu ve mazeretli olmayanlar: toplam, yapıldı, eksik, yapılmadı. Hiç işaretlenmemiş ödev özete girmez.

## Mimari

```
/mentorluk ──[Haftalık veli bülteni]──▶ /mentorluk/bulten?hafta=YYYY-MM-DD
   MentorService.getMyMentorships()              (mentörün öğrencileri)
   HomeworkService.getMentorHomeworkProfiles(ids, P-7)   (mevcut; yetki içinde)
                     ▼
   src/domains/mentor/lib/bultenMath.ts   (saf; DB yok; unit test)
     haftaSec(bugunISO) · haftaAraligi(P) · gecenHaftaEksikleri(kayitlar, P)
     buHaftaOdevleri(kayitlar, P) · grupOzeti(ogrenciler, P) · veliMesaji(...)
     whatsappLink(metin, telefon?) · telefonNormalize(tel)
                     ▼
   Sayfa (server component) + istemci bileşeni (Paylaş/Kopyala/WhatsApp/İndir, "Gönderildi" işareti)

/api/bulten/gorsel?tur=odevler|ozet|ogrenci&hafta=P&sinif=<id>|ogrenci=<id>
   yetki → aynı bultenMath verisi → ImageResponse (PNG)
```

- **Yeni tablo / migration yok.** Tüm veri mevcut tablolardan.
- Mentörün öğrencileri birden çok sınıftaysa grup görselleri **sınıf başına** üretilir.
- `/mentorluk` sayfasına yalnız bir link eklenir ("Hepsini yazdır" yanına).

## Sayfa (`/mentorluk/bulten`)

- Başlık, hafta gezinme (‹ önceki · `12–16 Ekim` · sonraki ›), özet satırı ("Geçen hafta 5–9 Ekim · 9 öğrenci · 7'sinin eksiği var").
- **Veli grubu için:** her sınıf için 2 görsel önizlemesi + [Paylaş] [İndir].
- **Velilere kişisel mesaj:** öğrenci listesi (ad, sınıf, "N eksik" / "tebrik"); açılır satırda mesaj önizlemesi + kişisel görsel + [Paylaş] [WhatsApp'ta aç] [Kopyala] [Görseli indir] + "Gönderildi ✓".
- **Paylaş:** `navigator.share({ files: [png], text })` (Web Share Level 2). Desteklenmiyorsa düğme gizlenir; İndir + WhatsApp'ta aç kalır.
- **WhatsApp'ta aç:** `https://wa.me/<tel>?text=<encoded>`; `veli_telefon` yoksa `https://wa.me/?text=<encoded>` (mentör kişiyi seçer). Telefon normalizasyonu: rakamlar; `0` ile başlayan 11 hane → `90…`; 10 hane `5…` → `90…`.
- **Gönderildi ✓:** yalnız tarayıcıda `localStorage` (`bulten:<P>:<studentId>`), try/catch ile; sunucuya yazılmaz.
- Boş durumlar: mentörlükte öğrenci yok → açıklama + `/mentorluk` linki; haftada ödev yok → "Bu hafta kontrol edilecek ödev yok".
- Rol: `isTeachingRole` (mevcut mentörlük sayfalarıyla aynı). A11y: 44px dokunma hedefi, karanlık tema, klavye odağı, görsellere `alt`.

## Görseller (`/api/bulten/gorsel`)

- `runtime = 'nodejs'`; `next/og` `ImageResponse`; genişlik 1080px (CSS 540 × 2).
- Yazı tipi: Bricolage Grotesque (OFL) TTF, `assets/fonts/` altında repoya eklenir (Regular + ExtraBold); Türkçe karakter kapsamı test edilir.
- Tasarım prototiple aynı: lacivert `#1D2B5F`, sarı vurgu `#FFD23F` altlı büyük sınıf adı, ders renk noktaları (bultenMath'ta `dersRengi`), yapıldı `#2E9E6B` / eksik `#F2B233` / yapılmadı `#D9534F` çubuk; alt bilgi solda okul adı (`schools.name`, ör. "Bahçeşehir Koleji Denizli"), sağda "EduDesk".
- **Yetki (her istek):** giriş yok → 401; `P.HOMEWORK.READ` yok → 403; `ogrenci`: öğrenci çağıranın mentörlüğünde değilse → 403 (okul dışı da buradan düşer); `odevler`/`ozet`: çağıranın o sınıfta en az bir mentörlük öğrencisi yoksa → 403.
- **Doğrulama (Zod):** `tur` enum; `hafta` geçerli ISO tarih ve pazartesi; `sinif`/`ogrenci` uuid → değilse 400.
- `Cache-Control: private, no-store`.
- Hata: üretim hatası → 500 + log; sayfa görseli yüklenemezse "Görsel oluşturulamadı" gösterir, metin akışı etkilenmez.

## Test

- **Unit (`bultenMath`):** haftaSec Perş/Cuma/Cmt/Paz/Pzt sınırları ve TR saati; eksiklerde mazeretli/işaretsiz/bekliyor hariç; grupOzeti sayıları ve mentör gruplarının toplamı = sınıf toplamı; veliMesaji metni (eksikli ve tebrik); whatsappLink kodlama; telefonNormalize.
- **API:** başka öğretmenin öğrencisi → 403; geçersiz hafta (pazartesi değil) → 400; geçerli → 200 `image/png`.
- **E2E (Playwright):** mentör `/mentorluk/bulten` açar → öğrencileri ve mesaj önizlemesini görür; Kopyala panoya yazar; görsel URL'i PNG döner.
- **Canlı doğrulama:** 9-A, hafta 2026-10-12 → prototiple aynı sayılar (Fevzi grubu Fizik 4/9 vb.; 9 + 15 öğrenci).

## Kapsam dışı (YAGNI)

Otomatik cuma gönderimi; gönderim kaydının sunucuda tutulması / idare raporu; veli telefonlarının toplu girişi (ayrı iş); PDF çıktı.
