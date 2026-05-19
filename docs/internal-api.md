# Internal API Mimarisi

`/api/internal/*` — heavy operasyonlar için standartlaştırılmış sunucu katmanı.

---

## Mimari Şema

```
Client (Browser / Server Component)
        │
        ▼
app/api/internal/*          ← Route Handlers ("use server" değil, Next.js API routes)
        │
        ├── withInternalAuth()  ← src/infrastructure/api/middleware.ts
        │     • Auth: getAbility() → cookie-based Ability engine
        │     • Perm guard: ability.cannot(perm) → 403
        │     • Request ID: X-Request-ID header (UUID per request)
        │     • Structured logging: pino → { path, method, user_id, school_id, duration_ms }
        │     • Error boundary: translateError() → Turkish messages
        │
        ├── parseBody() / parseSearchParams()  ← src/infrastructure/api/validation.ts
        │     • Zod schema validation
        │     • Discriminated union: { success, data, error }
        │     • TypeScript narrowing-safe (no destructuring anti-pattern)
        │
        └── apiOk() / apiErr()  ← src/infrastructure/api/response.ts
              • Consistent envelope: { ok, data|error, meta }
              • meta: { request_id, duration_ms, timestamp }
```

---

## Response Schema

Her endpoint aynı zarfı kullanır:

```typescript
// Başarı
{
  ok: true,
  data: T,
  meta: {
    request_id:  string,  // UUID — X-Request-ID header ile aynı
    duration_ms: number,
    timestamp:   string,  // ISO 8601
  }
}

// Hata
{
  ok: false,
  error: {
    code:     string,   // Sabit string — istemci switch/match için
    message:  string,   // Türkçe hata mesajı
    details?: unknown,  // Opsiyonel detay
  },
  meta: { request_id, duration_ms, timestamp }
}
```

### HTTP Status Kodları

| Status | Durum |
|--------|-------|
| 200 | Başarı (GET, DELETE) |
| 202 | Kabul edildi (async POST — örn. export kuyruğu) |
| 400 | Validation hatası |
| 401 | Giriş gerekli |
| 403 | Yetki yok |
| 404 | Kayıt bulunamadı |
| 422 | İş mantığı hatası (örn. iptal edilemez iş) |
| 500 | Sunucu hatası |

### Hata Kodları

| Kod | Anlam |
|-----|-------|
| `UNAUTHENTICATED` | Oturum yok veya süresi dolmuş |
| `UNAUTHORIZED` | İzin eksik |
| `VALIDATION_ERROR` | Zod şema ihlali |
| `NOT_FOUND` | Kayıt bulunamadı |
| `ENQUEUE_FAILED` | Export kuyruğu hatası |
| `CANCEL_FAILED` | İptal edilemez durum |
| `DB_ERROR` | Veritabanı hatası |
| `INTERNAL_ERROR` | Beklenmeyen sunucu hatası |

---

## Response Headers

| Header | Değer |
|--------|-------|
| `X-Request-ID` | UUID (her request için benzersiz) |
| `X-Duration-Ms` | İşlem süresi (ms) |

---

## Endpoint Referansı

### POST `/api/internal/export`
**Yetki:** `P.EXPORT.CREATE`  
**Açıklama:** Asenkron dışa aktarma işi kuyruğa alır.

Request:
```json
{
  "jobType": "excel_odevler" | "excel_yoklama" | "excel_mufredat" | "excel_notlar" | "excel_sinif_ogrencileri",
  "params": { "class_id": "uuid", "since": "2026-01-01" }
}
```
Response `202`:
```json
{ "ok": true, "data": { "jobId": "uuid" }, "meta": { ... } }
```

---

### GET `/api/internal/export?jobId=<uuid>`
**Yetki:** Herhangi bir oturum (kendi işleri)  
**Açıklama:** Export işinin mevcut durumunu döner.

Response `200`:
```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "status": "pending" | "processing" | "done" | "error" | "cancelled" | "dead_letter",
    "progress": 60,
    "progressStep": "Excel oluşturuluyor…",
    "resultUrl": "https://…",
    "errorMsg": null,
    "jobType": "excel_odevler",
    "attempt": 1,
    "createdAt": "…",
    "updatedAt": "…"
  },
  "meta": { ... }
}
```

---

### DELETE `/api/internal/export`
**Yetki:** Herhangi bir oturum (kendi işleri)  
**Açıklama:** Çalışan veya bekleyen export işini iptal eder.

Request:
```json
{ "jobId": "uuid" }
```
Response `200`:
```json
{ "ok": true, "data": { "cancelled": true, "jobId": "uuid" }, "meta": { ... } }
```

---

### GET `/api/internal/analytics?period=7d|30d|90d`
**Yetki:** Herhangi bir oturum  
**Açıklama:** Okul genelinde özet istatistikler. schoolId ile otomatik sınırlandırılır.

Response `200`:
```json
{
  "ok": true,
  "data": {
    "period": "30d",
    "since": "2026-04-19",
    "homework": {
      "completionRate": 73,
      "total": 1240,
      "done": 905
    },
    "attendance": {
      "rate": 88,
      "total": 3600,
      "present": 3168
    },
    "activeTeachers": 12,
    "atRiskStudents": 7
  },
  "meta": { ... }
}
```

**Not:** `atRiskStudents` = en az 5 gün kayıtlı öğrencilerden devamsızlık oranı %70 altında olanların sayısı.

---

### GET `/api/internal/reporting?type=class|teacher|student&...`
**Yetki:** Herhangi bir oturum  
**Açıklama:** Rapor sayfaları için sunucu taraflı veri toplama.

#### `type=class&class_id=<uuid>&period=30d`
```json
{
  "ok": true,
  "data": {
    "type": "class",
    "classId": "uuid",
    "period": "30d",
    "since": "2026-04-19",
    "rows": [
      {
        "studentId": "uuid",
        "fullName": "Ali Veli",
        "studentNumber": "123",
        "homework":   { "rate": 80, "done": 8, "total": 10 },
        "attendance": { "rate": 90, "present": 18, "total": 20 }
      }
    ]
  }
}
```

#### `type=teacher&teacher_id=<uuid>&period=30d`
```json
{
  "ok": true,
  "data": {
    "type": "teacher",
    "teacherId": "uuid",
    "period": "30d",
    "since": "2026-04-19",
    "homeworks": { "created": 5, "list": [...] },
    "submissions": { "total": 120, "done": 88, "completionRate": 73 },
    "attendanceDaysLogged": 22
  }
}
```

#### `type=student&student_id=<uuid>&period=30d`
```json
{
  "ok": true,
  "data": {
    "type": "student",
    "studentId": "uuid",
    "period": "30d",
    "since": "2026-04-19",
    "homework":   { "completionRate": 80, "done": 8, "total": 10, "list": [...] },
    "attendance": { "rate": 90, "present": 18, "total": 20, "records": [...] },
    "recentNotes": [...]
  }
}
```

---

### POST `/api/internal/batch/attendance`
**Yetki:** `P.ATTENDANCE.CREATE`  
**Açıklama:** Bir sınıfın tüm öğrencilerini tek round-trip ile işaretler.

Request:
```json
{
  "class_id": "uuid",
  "date": "2026-05-19",
  "default_status": "present",
  "overrides": [
    { "student_id": "uuid", "status": "absent" },
    { "student_id": "uuid", "status": "late" }
  ]
}
```
Response `200`:
```json
{
  "ok": true,
  "data": {
    "processed": 28,
    "overridden": 2,
    "classId": "uuid",
    "date": "2026-05-19"
  },
  "meta": { ... }
}
```

---

## Auth & Güvenlik

- Tüm endpointler cookie tabanlı Supabase session gerektirir (middleware: `getAbility()`)
- Permission check `withInternalAuth(P.RESOURCE.ACTION, ...)` ile satır başında yapılır
- `null` geçilirse herhangi bir authenticated user geçer (schoolId ile scope'lanır)
- Her DB sorgusu `school_id` filtresi içerir — tenant isolation RLS + uygulama katmanı çift güvence
- `X-Request-ID` her log satırına yazılır — hata debuglamada request izleme

## Middleware Kullanımı

```typescript
// src/infrastructure/api/middleware.ts
import { withInternalAuth } from '@/src/infrastructure/api/middleware'
import { parseBody } from '@/src/infrastructure/api/validation'
import { apiOk, apiErr } from '@/src/infrastructure/api/response'
import { P } from '@/src/shared/permissions'

export const POST = withInternalAuth(P.EXPORT.CREATE, async (req, ctx) => {
  // ctx.ability   — Ability engine (can/cannot/schoolId/userId)
  // ctx.requestId — UUID string
  // ctx.startedAt — Date.now() at request start

  const parsed = await parseBody(req, MySchema)
  if (!parsed.success) return NextResponse.json(apiErr('VALIDATION_ERROR', parsed.error, ctx), { status: 400 })
  // parsed.data narrowed to MySchema type here

  return NextResponse.json(apiOk({ result: '...' }, ctx))
})
```

## Yeni Endpoint Ekleme

1. `app/api/internal/<domain>/route.ts` oluştur
2. `withInternalAuth(P.RESOURCE.ACTION, handler)` wrap et
3. `parseBody` / `parseSearchParams` + Zod schema ekle
4. `apiOk` / `apiErr` ile yanıt döndür
5. Bu belgeye endpoint ve request/response örneklerini ekle
