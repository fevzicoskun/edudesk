# Yapılacaklarım — Kişisel Aksiyon Katmanı

**Tarih:** 2026-06-24
**Durum:** Tasarım onaylandı

## Problem

Öğretmen anasayfası (`OgretmenDashboard`) zaten zengin bir komuta paneli: bugünkü
program, nöbet, hızlı aksiyonlar, ödev kokpiti, "Bugün Yapılacaklar", risk
uyarıları. Ancak "Bugün Yapılacaklar" widget'ı **salt-okunur bir başlatıcı**:

1. **Hafıza yok** — "Ali'nin velisini arayacağım" diye işaretleyip yarına
   taşıyamıyorsun.
2. **Yakalama (capture) yok** — öğretmenin kafasında taşıdığı küçük işler
   ("9-B'ye deneme sonuçlarını söyle", "yarın projeksiyon ayarlat") EduDesk'te
   gidecek bir yer bulamıyor.

Günlük bağımlılık (sabah-ara-akşam açtıran döngü) tam da bu eksikte kayıyor.

## Çözüm

Yeni bir panel değil; mevcut panele **durum + hafıza** ekleyen kişisel aksiyon
katmanı. Kullanıcı kendi işini yakalar, isteğe bağlı öğrenci/sınıfa bağlar,
tamamlar veya erteler. Otomatik sinyaller (yoklama/ödev/risk) olduğu gibi kalır;
kişisel maddeler onların yanında yaşar.

Bu, **A seçeneği** (kişisel aksiyon katmanı). B (sistem sinyallerini eylemli
yapmak) bilinçli olarak kapsam dışı.

## Veri modeli — tek tablo `tasks`

`user_notes` desenini izler: sahip-özel, `school_id` yok (FK'ler tenant'ı zaten
sabitliyor; `user_notes` precedent'i kişisel tabloların `school_id` atladığını
gösteriyor).

```sql
CREATE TABLE tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  student_id    UUID REFERENCES students(id) ON DELETE SET NULL,
  class_id      UUID REFERENCES classes(id)  ON DELETE SET NULL,
  due_date      DATE,            -- isteğe bağlı; geçmişse "gecikti" vurgusu
  snoozed_until DATE,            -- ertelenirse o güne kadar gizli
  done_at       TIMESTAMPTZ,     -- doluysa tamamlanmış
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_user_open ON tasks(user_id) WHERE done_at IS NULL;

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_own" ON tasks FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

### Türetilen durum (kolon yok)

- **açık** = `done_at IS NULL`
- **bugün görünür** = açık VE (`snoozed_until IS NULL OR snoozed_until <= bugün`)
- **gecikmiş** = açık VE `due_date < bugün` (UI'da kırmızı vurgu)

`ON DELETE SET NULL` → bağlı öğrenci silinse bile görev kaybolmaz.

Görünürlük + erteleme tarih matematiği **tek saf fonksiyona** iner ve **tek
vitest** ile test edilir.

## Katmanlar — `src/domains/tasks/`

CLAUDE.md domain desenine uygun (repository → service → actions):

- **repository** (`repositories/`): ham Supabase çağrıları, iş mantığı yok.
  - `listActiveForUser(userId)` — bugün görünür açık görevler
  - `listOpenForStudent(userId, studentId)` — öğrenci profili için
  - `create`, `complete`, `snooze`, `reopen`, `delete`
- **service** (`services/`): sahip-özel. `getCurrentUser()` ile `user_id`
  zorlanır. Yeni RBAC sabiti **yok** — kaynak tamamen kişisel olduğundan
  `getAbility()` israf olur. Service sadece "bu kayıt bu kullanıcının mı"yı
  garanti eder (RLS zaten ikinci hat).
- **actions** (`app/actions/`): ince server action'lar. Zod ile doğrula →
  service → `revalidatePath('/anasayfa')`.
  - Eylemler: ekle / tamamla / ertele (Yarın · +7 gün) / geri-aç / sil.

## UI

### Anasayfa kartı — capture sürtünmesi sıfır

- Yeni client bileşen `app/(dashboard)/anasayfa/Yapilacaklarim.tsx`:
  - Tek satır giriş kutusu (Enter ile ekle, optimistic update).
  - Altında bugün görünür açık görevler listesi. Her satır:
    - tamamla onay kutusu
    - ertele menüsü (Yarın / Gelecek hafta)
    - gecikmişse kırmızı tarih
    - bağlıysa öğrenci/sınıf çipi
- Yerleşim: `OgretmenDashboard`'da **otomatik sinyallerin (BugunYapilacaklar)
  üstünde** ayrı bir kart. Gerekçe: kendi taahhüdün, sistemin dürtmesinden
  yüksek niyetli. Mevcut salt-okunur widget'a dokunulmaz.
- Capture kutusunda öğrenci seçici **yok** (sürtünme + gereksiz veri yükü).
  Öğrenciye bağlama, öğrenci profilinden gelir (aşağı bkz.).

### Öğrenci bağlamı — linking'in bedelini ödediği yer

- Öğrenci profili sayfasında (`siniflar/[id]/ogrenciler/[studentId]`) küçük
  **"+ Hatırlatıcı"** eylemi: `student_id` önceden dolu görev oluşturur ve o
  öğrencinin açık görevlerini orada listeler. `student_notes` zaten benzer
  desende çalışıyor.

## Testler

- Görünürlük + erteleme mantığı saf fonksiyon → **1 vitest unit** dosyası:
  - snoozed_until gelecekteyse görünmez, bugün/geçmişse görünür
  - done_at doluysa görünmez
  - "Yarın" / "+7" tarih hesabı
- Action seviyesi: mevcut deseni izleyen ince doğrulama testi (kapsam: Zod
  reddi + sahiplik). Framework israfı yok.

## Bilinçli ertelenenler (YAGNI)

- **Push/bildirim yok.** v1'de hatırlatma = görevin erteleme/tarih gününde
  panelde geri belirmesi. *Eklenince:* mevcut sabah cron'una
  (`dersProgramiOzeti`) "bugünkü görevlerin" satırı.
- **Müdür/MY paneline koyulmuyor** (ayrı dashboard: `MudurWidgets`/`MYWidgets`).
  Tablo ve action'lar rol-bağımsız olduğundan sonra tek satırla eklenir.
- **Sistem sinyalleri eylemli değil** (B seçeneği) — bilinçli dışarıda.
