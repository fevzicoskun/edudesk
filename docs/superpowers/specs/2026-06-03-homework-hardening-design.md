# Ödev Sistemi Sağlamlaştırma — Tasarım Dokümanı

**Tarih:** 2026-06-03  
**Kapsam:** Backend güvenlik + servis, frontend UI, testler  
**Yaklaşım:** Katman katman (backend → frontend → testler)

---

## 1. Backend — Güvenlik ve Servis Katmanı

### 1.1 Güvenlik: `findStudentHomeworkProfile` school_id Filtresi

**Sorun:** `HomeworkRepository.findStudentHomeworkProfile()` içindeki `homeworks` sorgusu `school_id` filtresi içermiyor. Multi-tenant sistemde farklı okul verileri teorik olarak karışabilir.

**Düzeltme:** `src/domains/homework/repositories/HomeworkRepository.ts` — `homeworks` sorgusuna `.eq('school_id', schoolId)` eklenir. `schoolId` parametre olarak servisten geçirilir.

### 1.2 Error Handling Standardizasyonu

**Sorun:** `deleteHomework` ve `restoreHomework` action'ları `throw` ederken diğer tüm homework action'ları `{ error: string }` döndürüyor.

**Düzeltme:** `app/actions/homework.ts` — `deleteHomework` ve `restoreHomework` try/catch içine alınır, `{ error: string }` pattern'ına geçirilir. Tüm action'lar tutarlı hale gelir.

### 1.3 Çoklu Sınıf Oluşturma — Promise.allSettled

**Sorun:** `createHomework` action'ındaki sınıf döngüsü sıralı çalışıyor; ilk başarısızlıkta sonraki sınıflar işlenmiyor ve kullanıcıya belirsiz hata dönüyor.

**Düzeltme:** `app/actions/homework.ts` — döngü `Promise.allSettled()` ile yeniden yazılır. Response şeması:
```ts
{
  success: string[],   // başarıyla oluşturulan sınıf ID'leri
  failed: string[],    // başarısız sınıf ID'leri
  error?: string       // tamamı başarısızsa genel hata
}
```
UI kısmi başarıyı kullanıcıya bildirir ("3 sınıftan 2'sine ödev atandı").

---

## 2. Frontend — UI Sağlamlaştırma

### 2.1 StatusBoard — 3 Düzeltme

**2.1.a Not kaydetme hatası:** `saveNote()` şu an hata sessizce yutulur. Try/catch + inline hata mesajı eklenir (`"Kaydedilemedi, tekrar deneyin"`). Başarı işaretinin yanına hata durumu eklenir.

**2.1.b Toplu işlem pending state:** `setAllStatuses` çağrısı sonrası `isPending` flag global. Toplu işlem tamamlanana kadar tekrar tetiklenemez; tamamlandıktan sonra temizlenir.

**2.1.c Concurrent update koruması:** Aynı öğrenci için uçuktaki bir request varken ikinci update bloklanır. `pendingStudentIds: Set<string>` state ile yönetilir; request tamamlanınca ID kaldırılır.

### 2.2 HomeworkForm — Form Reset

**Sorun:** Başarılı submit sonrası seçili sınıflar, kaynak ve tarih resetlenmez.

**Düzeltme:** `useActionState` başarı dönüşünde `useEffect` ile form state'i (`selectedClassIds`, `selectedSourceId`, `dueDate`) sıfırlanır. Başlık ve açıklama alanları zaten controlled input, bunlar da resetlenir.

### 2.3 Boş Liste Empty State

**Sorun:** `/odevler` filtreleme sonrası boş liste için hiçbir geri bildirim yok.

**Düzeltme:** Ödev listesi boş döndüğünde koşullu render:
- "Bu kriterlere uygun ödev bulunamadı" mesajı
- "Filtreyi Sıfırla" butonu (URL params temizler)

---

## 3. Testler

### 3.1 Servis Unit Testleri — Edge Case'ler

Dosya: `tests/vitest/unit/homework/homework-service.test.ts`

| Test | Senaryo |
|------|---------|
| `null due_date` create | `due_date: null` ile ödev oluşturulur, hata fırlatılmaz |
| `null due_date` update | Mevcut ödevde `due_date` null'a set edilir |
| Boş sınıf | Öğrencisi olmayan sınıfa ödev atanır, submission satırı oluşmaz (DB trigger yok) |
| `source_id: null` create | Kaynak olmadan ödev oluşturulur |
| RBAC sınır | Başka okul öğretmeninin ödevi erişilemez, `ForbiddenError` fırlatılır |

### 3.2 Çoklu Sınıf Create — Integration Testleri

Dosya: `tests/vitest/integration/server-actions/homework.test.ts`

| Test | Senaryo |
|------|---------|
| Tam başarı | 3 sınıfa ödev atanır, `success: [3 ID]`, `failed: []` |
| Partial failure | 1 sınıf ID geçersiz, `success: [2 ID]`, `failed: [1 ID]` |
| Tam başarısızlık | Tüm sınıflar geçersiz, `error` döner |

### 3.3 Concurrency Unit Testi

Dosya: `tests/vitest/unit/homework/homework-repository.test.ts`

Aynı `homework_id` + `student_id` için `Promise.all([update1, update2])` — son kayıt DB'de tutarlı, iki güncelleme birbirini bozmaz.

---

## Etkilenen Dosyalar

```
src/domains/homework/repositories/HomeworkRepository.ts  — school_id fix
app/actions/homework.ts                                  — error handling + Promise.allSettled
app/(dashboard)/odevler/[id]/StatusBoard.tsx            — 3 UI düzeltme
app/(dashboard)/odevler/yeni/HomeworkForm.tsx           — form reset
app/(dashboard)/odevler/page.tsx                        — empty state
tests/vitest/unit/homework/homework-service.test.ts     — edge case testleri
tests/vitest/integration/server-actions/homework.test.ts — çoklu sınıf testleri
tests/vitest/unit/homework/homework-repository.test.ts  — concurrency testi
```

---

## Kapsam Dışı (LOW severity — sonraki sprint)

- Hardcoded tatil tarihleri
- WhatsApp URL edge case
- Geçmiş tarih uyarısı enforced hale getirme
- Sınıf matrisi öğrenci filtresi
