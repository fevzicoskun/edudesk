# Ders Programım — OCR Faz 2 Tasarım (2026-06-20)

## Amaç ve kapsam

Öğretmen, haftalık ders programının bir **görüntüsünü** yükleyerek `/ders-programi`
ızgarasını otomatik **ön-doldurabilsin**; sonra ızgaradan gözden geçirip düzeltip kaydetsin.
Amaç: 5 gün × ~9 periyot = ~45 hücreyi elle doldurma zahmetini ortadan kaldırmak.

Faz 1 (`2026-06-19-ders-programi-design.md`) ızgarayı **tek doğruluk kaynağı + düzeltme
arayüzü** yaptığı için OCR yalnızca bir **girdi yardımcısıdır**: client ızgara state'ini
doldurur, başka hiçbir şeyi değiştirmez. Şema, kaydetme yolu ve doğrulama **aynen** kalır.

**Kapsam (bilinçli kararlar):**
- Girdi: **hem temiz ekran görüntüsü/çıktı hem de telefonla çekilmiş fotoğraf** (vision LLM ikisini de okur).
- OCR yalnızca **`slots`** (sınıf yerleşimi) çıkarır. **`periods` (zil saatleri) OCR'a dahil DEĞİL** —
  faz 1'deki `DEFAULT_PERIODS` + öğretmen düzenlemesi yeterli. Daha basit prompt, daha az hata yüzeyi.
- Görüntü **saklanmaz**: işlenir ve atılır. `lesson_schedules.file_url/file_name` boş kalır
  (privacy + YAGNI; ileride "yüklenen görseli sakla" istenirse kolon zaten hazır).

**Kapsam dışı:** zil saatleri OCR'ı, görüntü arşivleme, çoklu sayfa/PDF (ilk teslimde yalnız tek görüntü;
genişletilebilir), öğretmen dışı roller için OCR.

## Mimari karar: işleme nerede çalışır

**Server action içinde senkron** çalışır. Öğretmen görüntüyü yükler → action görüntü baytlarını +
okulun aktif sınıf listesini Vercel AI Gateway'e (Gemini Flash) gönderir → model `slots` benzeri
yapı döndürür → action eşleştirilmiş `Slot[]` döndürür → client ızgarayı doldurur.

Gerekçe: OCR birkaç saniyelik **tek seferlik senkron** bir iş. Mevcut `app/actions/` desenine
birebir oturur. Route handler (streaming yok → gereksiz) veya Inngest (asenkron polling/bildirim
gerektirir → aşırı mühendislik) tercih edilmedi.

## Veri akışı

```
DersProgramiClient
  └─ "Fotoğraftan doldur" → <input type="file" accept="image/*"> (mobilde kamera)
       └─ ocrSchedule(formData) server action
            ├─ Zod + dosya doğrulama (image/*, ≤ 8MB)
            ├─ ScheduleService.ocrFromImage(bytes)
            │    ├─ getAbility() → schoolId, öğretmen rolü kontrolü
            │    ├─ okulun aktif sınıfları (id, name) — deleted_at IS NULL
            │    ├─ buildOcrPrompt(classNames) → AI Gateway generateText (image part)
            │    └─ parseOcrResult(modelJson, classes) → Slot[]  (eşleştirme + normalize)
            └─ { slots } veya { error } döner
       └─ client: dönen slots ile ızgara state'ini doldurur (henüz KAYDETMEZ)
  └─ öğretmen düzeltir → mevcut "Kaydet" (saveSchedule) → faz 1 doğrulaması + upsert
```

OCR **kaydetme yapmaz**. Kaydetme yalnızca faz 1'in `saveSchedule` action'ı ile olur; onun
Zod + `validateSlots` + cross-tenant sınıf doğrulaması her durumda son kapıdır.

## Eşleştirme (en kritik nokta)

Model sınıf isimlerini metin olarak okur ("9-A", "10/B"). DB'de ise `class_id` (uuid) gerekir.

1. **Prompt'a okulun aktif sınıf isimleri verilir.** Modelden her **dolu** hücre için
   `{ day, period, class }` döndürmesi istenir; `class` ya verilen listeden bir isim ya da atlanır.
   Boş hücreler hiç döndürülmez.
2. **Sunucuda isim → class_id eşlemesi** yapılır. Eşleştirme **normalize edilmiş** karşılaştırmadır:
   küçük harfe çevir, boşlukları sök, `-` ve `/` ayraçlarını eşitle (`"9 / A"` ≡ `"9-A"` ≡ `"9a"`).
3. **Eşleşmeyen / belirsiz hücre boş bırakılır** — öğretmen ızgaradan seçer. **Asla yanlış/uydurma
   sınıf yazılmaz.** Model listede olmayan bir isim döndürürse o hücre düşürülür.
4. Aynı `(day, period)` için birden fazla satır gelirse ilki alınır, kalanı düşürülür
   (faz 1 `validateSlots` zaten teki zorlar; OCR çıktısını da temiz tutarız).

Sonuç `slots` faz 1 `validateSlots`'tan **geçecek** biçimde üretilir; geçmezse kaydetmede yakalanır.

## Model / sağlayıcı

> **Güncelleme (2026-06-20):** Başlangıçta Vercel AI Gateway planlanmıştı; ancak AI Gateway
> free kredileri açmak için bile kredi kartı zorunlu kılıyor. Kart gerektirmemek için
> **doğrudan Google Gemini** (Google AI Studio ücretsiz tier) sağlayıcısına geçildi.

- **Doğrudan Google Gemini** (vision): `@ai-sdk/google` provider + `ai` paketi.
- Model: **`google('gemini-2.5-flash')`** — canlı model listesinden seçildi
  (`GET https://generativelanguage.googleapis.com/v1beta/models`), stabil ve vision destekli.
- AI SDK `generateObject` + Zod şema (slot dizisi) ile yapılandırılmış çıktı; `messages` içinde
  bir `text` ve bir `image` part. Kesin API impl sırasında `node_modules/ai/docs/`'tan doğrulanır.
- Bağımlılık: `ai` + `@ai-sdk/google`.
- Env: `GOOGLE_GENERATIVE_AI_API_KEY` (`.env.local`; provider bunu otomatik okur). Anahtar yoksa
  OCR çağrısı net hata döndürür (sayfa çökmez).

## Katmanlar (faz 1 yapısına ekleme)

```
app/actions/schedule.ts                  + ocrSchedule(formData) action (YENİ)
src/domains/schedule/
  ocrPrompt.ts                           SAF: buildOcrPrompt(classNames) + parseOcrResult(json, classes) → Slot[]  (YENİ, birim test)
  services/ScheduleService.ts            + ocrFromImage(bytes): getAbility, sınıf listesi, AI çağrısı, parse
  repositories/ScheduleRepository.ts     (değişiklik yok — sınıf listesi için mevcut classes erişimi kullanılır)
app/(dashboard)/ders-programi/DersProgramiClient.tsx   + "Fotoğraftan doldur" butonu + sonucu ızgaraya uygula
package.json                             + "ai"
```

`ocrPrompt.ts` saf tutulur (DB/AI yok): prompt string üretimi ve model JSON'unu sınıf listesine
göre `Slot[]`'a çeviren parser. Tüm eşleştirme/normalize mantığı burada → birim test edilir.

## Güvenlik / yetki

- `ocrSchedule` action `getAbility()` ile **yalnız öğretmen rollerine** açık
  (`ogretmen`, `zumre_baskani`, `mudur_yardimcisi`) — faz 1 yazma rolleriyle aynı.
- Sınıf listesi **çağıranın `school_id`'sine** göre çekilir; OCR çıktısı yalnız bu listeyle eşleşir →
  cross-tenant sınıf imkânsız. Kaydetme yine faz 1'in server-side okul-sınıf doğrulamasından geçer.
- Görüntü baytları işlenir, kalıcı yazılmaz; loglara görüntü içeriği yazılmaz.

## Hata yönetimi

- **Dosya doğrulama** (action sınırı): `image/*` MIME ve ≤ 8MB; aşılırsa anlaşılır hata, AI çağrılmaz.
- **AI çağrısı patlarsa / yanıt JSON parse edilemezse:** ızgara state'i değişmez,
  kullanıcıya "Görüntü okunamadı, ızgarayı elle doldurabilirsiniz" mesajı.
- **Model uydurma sınıf döndürürse:** eşleşmez → o hücre boş kalır (zararsız).
- **API anahtarı yok / Gateway 4xx-5xx:** action net hata döndürür; sayfa çalışır durumda kalır.
- Best-effort felsefe: OCR başarısız olsa bile faz 1 elle giriş + kaydetme tam çalışır.

## Test

- **Birim (vitest) — `ocrPrompt.test.ts`:**
  - `buildOcrPrompt`: verilen sınıf isimlerini prompt'a koyar; gün/periyot çerçevesini tanımlar.
  - `parseOcrResult`:
    - exact eşleşme → doğru `class_id`.
    - normalize eşleşme (`"9 / A"`, `"9a"`, `"9-A"` hepsi aynı sınıfa).
    - listede olmayan isim → hücre düşürülür (boş).
    - aynı `(day, period)` çift → tek slota indirgenir.
    - bozuk/eksik JSON → güvenli boş sonuç + hata, exception fırlatmaz.
  - AI çağrısı **mock**; gerçek görüntü/model testi manuel.
- Üretilen `Slot[]` faz 1 `validateSlots`'tan geçer (birim testte çapraz kontrol).
- **E2E (opsiyonel):** AI çağrısı mock'lanarak "Fotoğraftan doldur → ızgara doldu → Kaydet" akışı.

## Teslim sırası (writing-plans girdisi)

1. `ai` paketi + `AI_GATEWAY_API_KEY` env; AI Gateway erişim dumanı testi (geçici).
2. `ocrPrompt.ts` (`buildOcrPrompt` + `parseOcrResult`) + birim testleri (TDD).
3. `ScheduleService.ocrFromImage` — getAbility, sınıf listesi, AI Gateway `generateObject`, parse.
4. `ocrSchedule` action — dosya/Zod doğrulama → service → `{ slots } | { error }`.
5. `DersProgramiClient` — "Fotoğraftan doldur" butonu, yükleme/hata durumları, sonucu ızgaraya uygula.
6. Manuel doğrulama: gerçek bir program görüntüsüyle uçtan uca dene.
