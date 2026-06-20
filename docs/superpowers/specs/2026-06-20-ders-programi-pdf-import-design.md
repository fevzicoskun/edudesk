# Ders Programı PDF İçe Aktarma — Tasarım

**Tarih:** 2026-06-20
**Durum:** Onaylandı
**Bağlam:** Faz 2 OCR (Gemini vision) kaldırıldı (commit f06b446) — vision modeli ızgara hücre geometrisini güvenilir okuyamıyor (birleştirilmiş hücreler ±1 sütun kayıyor). Yerine ASC TimeTables PDF'inin **metin katmanından koordinat tabanlı deterministik parse**.

## Neden çalışır

ASC PDF'i metin katmanlıdır: her yazının gerçek (x, y) konumu ve genişliği yazılıdır. POC (pymupdf, FEVZİ COŞKUN sayfası) ile kanıtlandı:
- Period başlıkları eşit aralıklı (~72.7px sütun genişliği).
- Tek-saatlik dersin sınıf-adı merkez-x'i sütun **merkezine** düşer; birleşik (2 saat) dersin merkez-x'i iki sütun **sınırına** düşer. Arada gri bölge yok → kesin ayrım.
- Öğle yemeği boşluğu (6→7 aralığı normalin 2 katı) otomatik elenir.
- POC çıktısı fotoğrafla birebir: 14 blok = 22 ders saati.

## Mimari

Parse **tarayıcıda** yapılır (sunucuya PDF gitmez). PDF tüm-okuldur (her öğretmen 1 sayfa); öğretmenin kendi sayfası **adıyla** bulunur:
```
"PDF'ten doldur" → tüm-okul .pdf seç
  → lazy import('pdfjs-dist'), HER sayfanın textContent'i
  → her sayfanın başlığı = extractPageTitle (en üst satır = öğretmen adı)
  → findTeacherPageIndex(titles, profile.full_name) → eşleşen sayfa
     ├─ bulundu → parseSchedulePdf(o sayfa, classes) → Slot[]
     └─ bulunamadı → sayfa başlıkları liste olarak gösterilir, öğretmen seçer
  → setSlots(...) ızgaraya dolar (kaydedilmez)
  → öğretmen kontrol → "Kaydet" (mevcut saveSchedule)
```
Sunucu tarafı yok, gizli anahtar yok (vision OCR'dan farkı bu), yeni server action yok. (Tek-sayfa PDF de çalışır: numPages=1, başlık eşleşir.)

## Bileşenler

### `src/domains/schedule/parseSchedulePdf.ts` (saf, test edilebilir)
- **Girdi:** `items: { str: string; x: number; y: number; width: number }[]` (pdfjs textContent'ten normalize), `classes: { id: string; name: string }[]`, `pageHeight`/yön fark etmez (nearest mantığı yön-bağımsız).
- **Adımlar:**
  1. Period merkez-x: üst banttaki tek/iki haneli sayı item'ları (period başlıkları).
  2. Gün merkez-y: `Pa|Sa|Ça|Pe|Cu` item'ları.
  3. Sınıf adayları: `^\d{1,2}[A-Za-zÇĞİÖŞÜçğıöşü]$` eşleşen item'lar (başlık bandı dışında).
  4. Her sınıf → en yakın gün (|Δy| min); period(ler): en yakın iki period merkezi a<b, merkez-x ortalarına yakınsa **[a,b]** (ve aralık < 1.5×ortalama sütun genişliği), değilse en yakın tek period.
  5. `normalizeClassName(name)` ile okul sınıfına eşle (eşleşmeyen düşer); `(gün,period)` tekilleştir.
- **Yardımcı:** `normalizeClassName` (küçük harf, harf/rakam dışı ayraçları sök — eski ocrPrompt'tan).
- **Çıktı:** `Slot[]` (`{ day, period, class_id }`).

- `extractPageTitle(items)`: en üst satır (max y, pdfjs alt-köken) = öğretmen adı.
- `findTeacherPageIndex(titles, fullName)`: tr-locale kelime kümesi eşleştirme (büyük/küçük + göbek adı toleranslı), yoksa -1.

### `app/(dashboard)/ders-programi/DersProgramiClient.tsx`
- `.pdf` kabul eden gizli file input + "PDF'ten doldur" butonu. Yeni prop: `teacherName` (= `profile.full_name`).
- Handler: `import('pdfjs-dist')` (lazy), tüm sayfaların `getTextContent()`'i → `{str,x,y,width}`; başlıklar → `findTeacherPageIndex`. Eşleşirse `applyPage` (parse + setSlots + mesaj "Ad — N ders bulundu"). Eşleşmezse sayfa başlıklarını buton listesi olarak göster; tıklayınca `applyPage`.

## Test
`parseSchedulePdf.test.ts` — POC'tan türetilen **gerçek** FEVZİ COŞKUN item fixture'ı; beklenen 22-saatlik Slot listesi assert edilir. normalizeClassName ve edge case'ler (eşleşmeyen sınıf, boş girdi) için ayrı testler.

## Hata yönetimi
- Metin katmanı yok / boş (taranmış PDF): item'lar boş → parser `[]` döner; UI "PDF metin içermiyor, ızgarayı elle doldurun".
- Seçilen sayfada ders yok / eşleşmedi: `applyPage` boş slot → "Sayfa: ders bulunamadı".
- İsim otomatik bulunamadı: hata değil → sayfa seçim listesi gösterilir.
- `import('pdfjs-dist')` / parse hatası: try/catch → "PDF okunamadı, ızgarayı elle doldurabilirsiniz".

## Kapsam dışı (YAGNI)
- Zil saatlerini PDF'ten okuma (DEFAULT_PERIODS zaten okula uygun).
- Sunucu tarafı parse, dosya yükleme/saklama.
