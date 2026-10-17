# Mentör haftalık takip — iyileştirme (2026-10-17)

Kullanıcı isteği 0–6 adım (sohbet 2026-10-17). 0. adım: haftalar `mentor_haftalari (student_id, hafta_basi)` tekil satırında,
plan+sonuç aynı satırda; hafta değişimi / kopyalama / görev silme başka haftaya dokunmuyor → düzeltme yok (kullanıcı onayladı).

Sınırlar: konu haritası ve veli mesajı değişmez; ödev modülü yalnız okunur; bayrak (`mentor_takip_kullanicilari`) değişmez.

## Veri (icerik jsonb — geriye uyumlu, eski satırlar okunur)
- `Gorev` + `kitapId: string|null`, `kitapAdi: string`, `sayfaBas/sayfaSon: number|null`. Eski serbest `sayfa` metni kalır (kitapsız görev).
  Görevdeki `soru/dogru` artık girilmiyor (canlıda hiç girilmemişti: 2 satır, 0 soru) — şemada nullable kalır.
- `icerik.sonuclar: Sonuc[]` — haftanın soru görevlerinden türeyen satırlar: kitaplı → anahtar `k:<kitapId>`, kitapsız → `d:<ders|görev adı>`.
  `{ anahtar, ad, ders, cozulen, dogru, yanlis, bos }` (sayılar null = girilmedi). Net = D − Y/4, Doğruluk = D/Ç.
  Kural: D ≤ Ç zorunlu (DB `dogru <= soru`); D+Y+B > Ç yalnız uyarı.
- Özet: `soru = ΣÇ`, `dogru = ΣD` (idare RPC'si ve geçmiş tablo aynı sütunları okur).

## Okul ödevleri (salt okuma, `getStudentHomeworkProfile` tumOdevler)
- Tamamlanmamış: `status = 'yapilmadi'` ve teslim < pazartesi (öğretmen yapıldı işaretleyene kadar her hafta).
- Bu hafta: teslim Pzt–Paz (mevcut). Gelecek hafta: teslim P+7…P+13 (DB'de var = verilmiş).

## Haftayı kapat (migration)
`mentor_haftalari.kapali_at timestamptz`, `okul_odevleri jsonb` (kapatma anı anlık görüntüsü). Kapalıyken `kaydet` reddedilir
(sunucu), ekran `fieldset disabled`; okul ödevi bölümleri anlık görüntüden okunur. "Kilidi aç" `kapali_at = null`.

## Kopyala / herkese uygula
- Kopya = önceki kaydın planı, sonuçsuz. Kitap sayfası kitap başına kaydırılır: ofset = maxSon − minBas + 1 (45–60 → 61–76).
  Yeni haftanın otomatik taslağı da aynı fonksiyonu kullanır.
- Herkese uygula: aynı hafta, kaydı olan öğrenci atlanır; kitap öğrencide (ad+ders) yoksa tanımlanır. Sonuç: uygulanan sayısı.

## Küçük
- Takip ekranı ve kâğıtlarda hafta Pzt–Paz (`takipHaftaEtiketi`); veli bülteni/mesajı okul haftası (Pzt–Cum) olarak kalır.
- Mentörlük tablosu: "Geçen hafta" = önceki haftanın program % · doğruluk % (%50 altı kırmızı).
