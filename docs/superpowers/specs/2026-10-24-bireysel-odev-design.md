# Bireysel Ödev — tasarım (2026-10-24)

Kaynak: kullanıcının yapıştırdığı istek (tam metin sohbette). Dal: `bireysel-odev` (worktree). main'e doğrudan commit YOK.

## Güvenlik sınırları (kullanıcı kuralları)
- Başlamadan pg_dump: `EduDesk-Yedekler\canli-tam-2026-10-24-094604-bireysel-odev-oncesi.dump` ✓
- Migration'ı Claude ÇALIŞTIRMAZ: dosya yazılır, kullanıcıya gösterilir, onay beklenir.
- Migration yalnız yeni tablo + o tabloya ait RLS/index. Mevcut tablo/policy/fonksiyonda ALTER/DROP/UPDATE/DELETE yok
  (mevcut `current_school_id()` yalnız ÇAĞRILIR, değiştirilmez; FK'ler mevcut tablolara referans verir, onları değiştirmez).
- Mevcut ödev modülü, öğrenci tablosu, mevcut ekran davranışı değişmez. Öğrenci sayfasına yalnız yeni bölüm, menüye yalnız yeni satır.

## Veri
`bireysel_odevler`: id, school_id (çok kiracılı kural — her tabloda), ogrenci_id → students, ogretmen_id → profiles,
aciklama (zorunlu, 1–300), teslim_tarihi (date, boş olabilir), yapildi (false), yapildi_tarihi, olusturma_tarihi.
RLS dört işlem için: `school_id = current_school_id() and ogretmen_id = auth.uid()`; ekleme/düzenlemede öğrenci aynı
okulda ve silinmemiş. İleride görünürlük: select policy'ye `or ...` eklenerek genişler (ogretmen_id üzerinden).

## Ekranlar
- Öğrenci sayfası (`/siniflar/[id]/ogrenciler/[studentId]`, aramanın götürdüğü sayfa), başlığın hemen altında "Bireysel Ödevler"
  bölümü: "Bireysel ödev ekle" → açıklama + teslim tarihi (isteğe bağlı) → Kaydet. Altında bu öğretmenin bu öğrenciye
  verdikleri, yeniden eskiye: açıklama, veriliş, teslim, durum; tek tık yapıldı/geri al; düzenle; iki adımlı sil.
  Yalnız öğretmen rolleri (ogretmen, zumre_baskani) görür.
- `/odevler/bireysel` "Verdiğim Bireysel Ödevler": öğrenci (sınıfıyla, öğrenci sayfasına bağlantı), açıklama, teslim, durum.
  Gecikmiş (teslim < bugün, yapılmamış) kırmızı ve en üstte; sonra bekleyenler teslime göre (tarihsizler sonda);
  "Tümü"nde yapılanlar en altta. Filtre: Bekleyenler (varsayılan) / Tümü (`?filtre=tumu`). Yapıldı/geri al, düzenle, sil.
- Menü: öğretmen rolleri için "Verdiğim Bireysel Ödevler" (Ödevler'in altında).
- Telefon: dokunma alanları ≥ 44px, liste kart düzeni, yatay kaydırma yok.

## Adres
Liste ekranı `/odevler/bireysel` (ayrı üst modül DEĞİL): yeni modül klasörü featureMap + DB `increment_usage`
beyaz listesinin değişmesini gerektirirdi (mevcut fonksiyon → kural 3). Ödevler altında kullanım "odevler" sayılır,
DB'ye dokunulmaz; menüde aktiflik en uzun önekle (navMath.aktifHref) doğru kalır. İstek "Kapsam dışı" listesi aynen geçerli.
