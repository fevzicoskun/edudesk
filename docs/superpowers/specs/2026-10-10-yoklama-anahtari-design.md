# Yoklama Anahtarı — Tasarım + Uygulama Planı

**Tarih:** 2026-10-10 · **Durum:** tasarım kullanıcı onaylı (sohbette), bu belge onay bekliyor · **Yürütme:** doğrudan (native), TDD

## Amaç

Bahçeşehir bu yıl yoklamayı EduDesk'te almıyor (son kayıt 2026-05-30). Buna rağmen müdür/MY ekranlarında sürekli "yoklama girilmemiş", "0/6", kırmızı uyarılar çıkıyor; 10–25 Eylül'de idareye her gün "Eksik yoklamalar" bildirimi gitti. Okul yöneticisi **tek anahtarla** yoklama modülünü kapatıp açabilsin. Kapalıyken yoklama/devamsızlık hiçbir ekranda görünmez, hiçbir bildirim gitmez; açınca her şey geri gelir, veri silinmez.

## Kararlar

- Alan: `schools.yoklama_aktif boolean not null default true` (yeni okullar açık). Bahçeşehir (`00000000-0000-0000-0000-000000000001`) migration'da **kapalı** başlar.
- Değiştiren: yalnız **müdür ve müdür yardımcısı** — `set_yoklama_aktif(p_aktif boolean)` RPC, `security definer`, içeride `is_mudur_or_my()` + `current_school_id()`; değilse hata. `grant execute … to authenticated`, `revoke … from anon, public`.
- Okuyan: `SchoolService.yoklamaAktif()` (React `cache`, istek başına tek sorgu; hata = **açık** say → mevcut davranış bozulmaz, log).
- Anahtar yeri: `/ayarlar` → "Okul ayarları" kartı (yalnız müdür/MY görür): "Yoklama modülü" açık/kapalı + açıklama.

## Kapalıyken gizlenen / durdurulanlar

| # | Yer | Davranış |
|---|---|---|
| 1 | Sol menü / alt menü | Öğretmen "Yoklama" girdisi yalnız açıkken (2026-09-25'te kodla gizlenmişti → bayrağa bağlanır); idare "Devamsızlık Raporu" yalnız açıkken |
| 2 | `MYStatsWidget` (müdür+MY ana sayfa) | "Yoklama Alınan Sınıf", "Devamsız Öğrenci" kutuları ve yoklama/devamsızlık uyarı çipleri yok |
| 3 | `MYSolSutunWidget` | "Devamsızlık Riski" kartı yok |
| 4 | `MudurTrendWidget` | Devamsızlık ve yoklama kapsama trendleri + "Sınıf karşılaştırması — devamsızlık" yok |
| 5 | `MudurOgretmenAktivite`, `/rapor/ogretmen-aktivite` | "Yoklama" sütunu yok |
| 6 | `/yonetim` (Okul Durumu) | "Bugün yoklama" ve "Bu ay devamsızlık" kartları yok |
| 7 | Sınıf sayfası, öğrenci sayfası, ödev öğrenci modalı | Devamsızlık bölümü/sekmesi yok |
| 8 | Veli portalı (`/veli/[token]`) | Devamsızlık bölümü ve özet kartındaki devamsızlık yok |
| 9 | `/yoklama`, `/yoklama/analitik`, `/yoklama/cizelge`, `/rapor/devamsizlik`, `/yonetim/devamsizlar`, devamsızlık Excel dışa aktarımı | "Yoklama modülü kapalı — Ayarlar'dan açılabilir" (yönetici için Ayarlar linki) |
| 10 | Arka plan: `yoklamaHatirlatici`, `veliAbsenceNotifier` | Kapalı okul atlanır |
| 11 | Arka plan: `gunlukOzet`, `aylikBulten` | Kapalı okul için yoklama satırı / "En iyi yoklama" bölümü yok |

Kapsam dışı: tanıtım sayfası (`app/page.tsx`, landing), gizlilik/kullanım koşulları metinleri, mevcut yoklama verisi (dokunulmaz).

## Uygulama planı (TDD; her adım sonunda commit+push)

1. **Migration + tipler + okuyucu.** `supabase/migrations/20261010120000_yoklama_anahtari.sql` (alan, Bahçeşehir=false, RPC). `generate_typescript_types` → `database.types.ts`. `SchoolService.yoklamaAktif()` + `setYoklamaAktif(aktif)` (RBAC: `isMudurOrAbove`/MY; RPC). Birim testi: servis yetkisiz rolde hata, RPC hatası iletilir, okuma hatasında `true`.
2. **Saf filtre:** `yoklamaAciklar(okullar)` (cron'lar için kapalı okulları ayıklar) + birim testi; 4 cron'a uygulanır (#10–11).
3. **Ayarlar kartı** (#anahtar) + server action (Zod `z.boolean()`) + e2e: MY kapatır → ana sayfada "Yoklama Alınan Sınıf" yok, açar → var (test sonunda açık bırakılır); öğretmen kartı görmez.
4. **Menü** (#1): `gorunurNav`'a `yoklamaAktif` seçeneği + `yalnizYoklama` bayrağı; birim testi (nav.test.ts).
5. **Yönetim ekranları** (#2–#6): bileşenler `yoklamaAktif` ile koşullu; e2e (3. adımdaki testte kontrol listesi genişletilir: Okul Durumu, Devamsızlık Riski, trendler, Yoklama sütunu).
6. **Öğrenci/sınıf/veli** (#7–#8) + **kapalı sayfalar** (#9): e2e `/yoklama` kapalıyken mesaj.
7. **Doğrulama:** unit + tam e2e + build; canlıda Bahçeşehir MY ekranı (yoklama parçaları yok) + DB'de `yoklama_aktif=false`; Fevzi ana sayfası etkilenmez.

## Riskler

- Test okulu (`__PW_TEST__`) varsayılan açık → mevcut yoklama e2e testleri etkilenmez; anahtar testi her durumda `finally` ile açık bırakır.
- `yoklamaAktif()` okuma hatası → açık say (fail-open bilinçli: yanlışlıkla gizlemek veri kaybı gibi görünür; log atılır).
