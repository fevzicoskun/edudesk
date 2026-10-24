# Haftalık Çalışma Planı kâğıdı — yeniden tasarım (2026-10-24)

Kaynak: kullanıcının yapıştırdığı istek + `Downloads/plan-taslak.html` (Mert Koç, 23–29 Ekim). Veri modeli DEĞİŞMEZ;
yalnız öğrenci plan kâğıdı (`OgrenciKagidi.tsx`) ve plan ekranına uyarı bandı. Sonuç kâğıdı, toplu sayfa mantığı aynı.

## Düzen (taslak birebir)
- Başlık: sol "Okul · Mentörlük", "Haftalık Çalışma Planı", "Ad · Sınıf"; sağ tarih aralığı, "Haftalık hedef: X soru · Gecikmiş: N".
- "Her gün" rutin tablosu: rutin görevler + sabit "Ekran süresi" satırı × 7 gün ("Cu 23"…). Hücre: soru görevi `___/___`,
  kitap okuma `___ sf`, ekran `___ sa`, diğer onay kutusu. O gün planda yoksa taralı. Resmî tatilde "Okul tekrarı" taralı,
  sütun başlığı açık kırmızı.
- "Günlük ödevler": iki bağımsız sütun; sol Cu/Ct/Pz/Pt, sağ Sa/Ça/Pe + "Hafta sonu özeti" (toplam soru ___/hedef,
  toplam doğru, kapanan gecikmiş ___/N, Mentör notu). İmza yok, filigran yok.
- Gün kutusu: başlık "Cuma · 23 Ekim", sağda tatil/yarım gün rozeti ve (varsa) öğrencinin saat aralığı. Satırda saat yok.
  Gecikmişler üstte, gri zemin + sol kalın çizgi + "GECİKMİŞ". Test görevlerinde "Çözdüm ___ Doğru ___". Tek "Yeni ödev" satırı.

## Kurallar (saf fonksiyonlar, `planKagidi.ts`, `tatiller.ts`)
- **Rutin** = ödev olmayan ve aynı adla haftanın ≥ 4 gününde geçen görev (okul tekrarı, soru bankası, paragraf, kitap okuma;
  11–12 şablonunda "TYT Matematik" vb. de kendiliğinden). "Haftalık genel tekrar" hiç basılmaz.
- **Gecikmiş** = ödev görevi, teslim < bugün. N = kâğıttaki gecikmiş satır sayısı (plana girmeyenler basılmadığı için sayılmaz).
- **Metin temizliği** (yalnız çıktı): Sy/Syf/Sayfa/S./Sf → "s."; aralık en-dash; "a-b-c" (3+ sayı) → "a, b, c";
  "0–n" → "1–n"; Çözelim/Yapalım/Tamamlansın/Arası atılır; "41'e Kadar" → "41'e kadar"; Meb → MEB, St Book → Student Book,
  Kondüsyon → Kondisyon; kaynak ile sayfa arası " · ".
- **Genel satır** (yalnız ders adlarından oluşan: "Fizik", "Kimya / Biyoloji", "Edebiyat + Tarih/Coğrafya") → "— serbest tekrar".
  Şablon satırları "Matematik tarama testi" → "Matematik — tarama testi", "Matematik tekrarı" → "Matematik — haftanın tekrarı".
- **Tekrar**: aynı gün aynı ders+kaynak hem gecikmiş hem değilse yalnız gecikmiş kalır.
- **Sığmaz**: tek aralık, sayfa sayısı > dakika → "37 sayfa · 30 dk'ya sığmaz" YALNIZ plan ekranında mentöre
  (ilk sürümde kâğıtta da vardı; kullanıcı 2026-10-24: 9 kâğıdın 9'unda çıkıyordu, öğrenci değiştiremez → kâğıttan kalktı).
- **Tatil**: sabit tarihli resmî tatiller + elle liste (dini bayramlar, arifeler yarım gün). 28 Ekim yarım gün, 29 Ekim bayram.
- **Mentöre uyarı** (plan ekranı, sarı bant): sığmaz satırlar + tatil gününde > 2 gecikmiş.

## Sığdırma
Tek A4. TekSayfa önce boşlukları sıkıştırır (`data-sik`), yine taşarsa son çare zoom.
