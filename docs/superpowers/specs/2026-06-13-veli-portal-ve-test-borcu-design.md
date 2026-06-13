# Spec: Veli Portalı Genişletme + Test Borcu

**Tarih:** 2026-06-13  
**Durum:** Onaylandı

---

## Bağlam

Veli portalı (`/veli/[token]`) şu an öğrencinin ödevleri, devamsızlığı ve öğretmen notlarını gösteriyor. Ancak veliye tek bakışta genel durumu veren bir özet yok; ödev açıklamaları görünmüyor; devamsızlık trend olarak değil sadece liste olarak sunuluyor.

Test tarafında `notifications` domain'inde 6 server action ve 6 Inngest fonksiyon var ama sıfır test mevcut. `attendance`, `auth`, `users` domain'lerinde de yüzeysel test kapsamı var.

---

## Özellik 1 — Veli Portalı Genişletme

### A. Özet Kart

**Dosya:** `app/veli/[token]/VeliOzetKart.tsx` (yeni bileşen)  
**Konum:** `page.tsx`'te öğrenci adı/sınıf bloğunun hemen altı, section'lardan önce

3 metrik gösterilir:
- **Devamsızlık** — toplam gelmedi gün sayısı (son 90 gün)
- **Ödev Tamamlanma** — tamamlanan / toplam ödev yüzdesi
- **Aktif Ödev** — teslim tarihi geçmemiş ödev sayısı

Renk mantığı:
- Devamsızlık: `≤2` → yeşil, `3-5` → sarı, `≥6` → kırmızı
- Ödev tamamlanma: `≥80%` → yeşil, `50-79%` → sarı, `<50%` → kırmızı

**Veri kaynağı:** `page.tsx`'te zaten `devamsizliklar` ve `odevler` array'leri var — ekstra DB sorgusu yok. Prop olarak indirilir.

---

### B. Ödev Açıklaması

**Dosya:** `app/veli/[token]/VeliOdevlerSection.tsx`  
**Değişiklik:** Her ödev kartına `description` alanı ekle

- `homework.description` boşsa veya `null`sa → hiç render etme
- 120 karakterden uzunsa `truncate` + `"Devamını gör"` toggle (client-side `useState`)
- Toggle ikonu: `ChevronDown` / `ChevronUp` (lucide-react, projede mevcut)

**Veri kaynağı:** Mevcut sorgu zaten `description` çekiyor (`VeliOdevlerSection` prop'una ekle).

---

### C. Devamsızlık Trend Grafiği

**Dosya:** `app/veli/[token]/VeliDevamsizlikSection.tsx`  
**Değişiklik:** Mevcut listenin üstüne Recharts `BarChart` ekle

- X ekseni: Son 3 ay (Türkçe ay adı — `date-fns/tr` locale ile)
- Y ekseni: Gün sayısı (tam sayı)
- İki seri: `Gelmedi` (kırmızı) ve `Geç Geldi` (sarı) — yığılmış (`stacked`)
- Veri: `devamsizliklar` array'i client'ta `groupBy(month)` ile toplanır — `date-fns/getMonth` kullan
- Hiç devamsızlık yoksa grafik gösterilmez

**Recharts:** Projede `recharts` zaten var (`HomeworkCalendar`, `OdevTamamlanmaChart`).

---

## Özellik 2 — Test Borcu (Derinlemesine)

### 2A — Notifications Actions

**Dosya:** `tests/vitest/unit/notifications/notifications-actions.test.ts` (yeni)  
**Hedef:** ~40 test

| Action | Test Senaryoları |
|--------|-----------------|
| `getNotifications` | happy path, unauthenticated → hata, okul filtresi uygulanır, pagination |
| `getUnreadCount` | happy path, unauthenticated → 0 döner |
| `markRead` | kendi bildirimi → başarı, başka okul bildirimi → hata |
| `markAllRead` | happy path, bildirim yok → hata yok |
| `getNotificationPreferences` | mevcut tercih → döner, yoksa → varsayılan oluşturur |
| `saveNotificationPreferences` | geçerli veri → başarı, geçersiz → Zod hatası |

Mock pattern: `vi.mock()` + `getAbility()` factory (homework testlerindeki gibi).

---

### 2B — Notifications Inngest Fonksiyonları

**Dosya:** `tests/vitest/unit/notifications/notifier-logic.test.ts` (yeni)  
**Hedef:** ~30 test

Inngest wrapper'ını değil, fonksiyonların **saf iş mantığını** test et. Gerekirse iş mantığını ayrı helper fonksiyona çıkart:

| Fonksiyon | Çıkartılacak / Test Edilecek Mantık |
|-----------|-------------------------------------|
| `veliAbsenceNotifier` | `opt_out=true` olan veliler e-posta almaz; `veli_email` null olanlar atlanır |
| `odevSonrasiVeliNotifier` | teslim tarihi dün olan ödevler seçilir, bugün değil |
| `yoklamaHatirlatici` | eksik yoklama tespiti doğru mu, hafta sonu ise çalışmaz |
| `homeworkCreatedNotifier` | `homework_veli_notifications` dedup tablosu — aynı ödev iki kez gönderilmez |

---

### 2C — Attendance Actions

**Dosya:** `tests/vitest/unit/attendance/attendance-action.test.ts` (yeni)  
**Hedef:** ~20 test

Mevcut `attendanceMath.test.ts` pure math fonksiyonlarını test ediyor. Eksik olan action katmanı:
- `takeAttendance`: yetki yok → hata, kendi sınıfı değil → hata, geçerli veri → başarı
- `getAttendance`: sınıf filtresi, okul filtresi, unauthenticated
- `deleteAttendance`: yetki kontrolü

---

### 2D — Auth Edge Case'leri

**Dosya:** `tests/vitest/unit/auth/auth-service.test.ts` (mevcut, genişlet)  
**Hedef:** ~15 yeni test

Eksik senaryolar:
- Hatalı şifre → `AuthApiError` → doğru hata mesajı
- Onaylanmamış e-posta → doğru hata mesajı
- Token süresi geçmiş → yeni token isteği gerektirir
- `getCurrentProfile()` cache: aynı istek içinde iki kez çağrı → Supabase bir kez hit

---

### 2E — Users Edge Case'leri

**Dosya:** `tests/vitest/unit/users/user-service.test.ts` (mevcut, genişlet)  
**Hedef:** ~15 yeni test

Eksik senaryolar:
- Kendi rolünü değiştirme girişimi → hata
- `mudur` olmayan biri kullanıcı davet etmeye çalışır → `cannot()` hatası
- Zaten davet edilmiş e-posta → duplicate hata
- `inviteUser` → `veli_email_opt_out` false ile student oluşturulur

---

## Test Sayısı Özeti

| Alan | Mevcut | Yeni | Toplam |
|------|--------|------|--------|
| Notifications actions | 0 | ~40 | ~40 |
| Notifications Inngest | 0 | ~30 | ~30 |
| Attendance actions | 77 | ~20 | ~97 |
| Auth | ~15 | ~15 | ~30 |
| Users | ~20 | ~15 | ~35 |
| **Toplam** | **~112** | **~120** | **~232** |

Proje genelinde: 708 → ~830 test hedefi.

---

## Dokunulmayacak Dosyalar

- `src/infrastructure/supabase/database.types.ts` — migration yok
- `proxy.ts` (middleware) — değişiklik yok
- Veli token mekanizması — değişiklik yok

---

## Doğrulama

1. `npx vitest run` — tüm testler yeşil
2. `npx tsc --noEmit` — 0 hata
3. Veli portal'ı gerçek token ile tarayıcıda aç:
   - Özet kart görünür, renkler doğru
   - Ödev kartlarında açıklama var (boşsa gizli)
   - Devamsızlık grafiği son 3 ayı gösteriyor
4. Bildirim action testleri `okul filtresi` kontrolünü doğrular
