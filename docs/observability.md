# Observability

## Structured Logging

### Logger (`src/infrastructure/observability/logger/index.ts`)

Pino tabanlı, JSON-formatlı, production-ready logger.

```ts
import { logger, securityLog, childLogger } from '@/src/infrastructure/observability/logger'

logger.info({ school_id, user_id }, 'attendance saved')
logger.warn({ label, duration_ms }, 'slow query')
logger.error({ error_name, error_message }, 'export failed')

securityLog('auth.unauthenticated_server_action', { path: '/api/...' })

const reqLogger = childLogger({ request_id, school_id })
reqLogger.info('request started')
```

### Redacted fields

Şu alanlar logda `[REDACTED]` olarak görünür:

```
password, token, jti, access_token, refresh_token
*.password, *.token, *.jti, *.access_token, *.refresh_token
```

---

## Correlation IDs

### AsyncLocalStorage (`src/infrastructure/observability/correlation.ts`)

Her request/job için tek bir ID üretilip propagate edilir.

```ts
import { withCorrelationId, newCorrelationId, getCorrelationId } from '@/src/infrastructure/observability/correlation'

// API route (X-Request-ID header'dan okur)
getCorrelationId(request.headers)

// Inngest job
await withCorrelationId(newCorrelationId(), async () => {
  // Bu scope içindeki tüm getCorrelationId() çağrıları aynı ID'yi döner
})
```

**Öncelik sırası:** `X-Request-ID` header → AsyncLocalStorage → `undefined`

---

## Request Tracing (`src/infrastructure/api/middleware.ts`)

`withInternalAuth` HOF ile sarılmış her `/api/internal/*` endpoint otomatik olarak:

- `X-Request-ID` header'ı okur veya yeni UUID üretir
- `X-Duration-Ms` response header'ı ekler
- Request başlangıç/bitiş logunu yazar
- Hata durumunda yapılandırılmış error logu yazar

```ts
export function withInternalAuth(perm, handler) {
  // → req.headers['x-request-id'] || crypto.randomUUID()
  // → logger.info({ method, url, request_id }, 'api request')
  // → response headers: X-Request-ID, X-Duration-Ms
}
```

---

## Slow Query Tracking (`src/infrastructure/observability/slow-query.ts`)

```ts
import { trackedQuery } from '@/src/infrastructure/observability/slow-query'

const { data } = await trackedQuery('attendance.findHistory', () =>
  supabase.from('attendance').select('*').eq('class_id', classId)
)
```

Eşik değerleri (`src/infrastructure/observability/metrics.ts`):
- `PERF.DB_WARN_MS` — uyarı eşiği
- `PERF.DB_ERROR_MS` — kritik eşiği (severity: 'error')

Her aşılan sorgu için log:
```json
{
  "label": "attendance.findHistory",
  "duration_ms": 1240,
  "threshold_ms": 500,
  "correlation_id": "...",
  "severity": "warn"
}
```

> **Dikkat:** Her DB sorgusuna ekleme. Yalnızca bilinen yüksek-maliyetli sorgulara ekle.

---

## Export Failure Logging

`src/domains/export/functions/exportDeadLetter.ts`

Export job max retry'dan sonra başarısız olursa:

1. `ExportRepository.markDeadLetter(jobId, errorMessage)`
2. `logger.error(...)` — structured log
3. `securityLog('export.dead_letter', {...})` — güvenlik logu
4. `withCorrelationId(newCorrelationId(), ...)` ile correlation context açılır

---

## Auth Anomaly Logging

`src/shared/authorization/server.ts` → `requireAbility()`

Oturumsuz bir Server Action çağrısı gelirse:
```ts
securityLog('auth.unauthenticated_server_action', {})
throw new AuthorizationError({ code: 'UNAUTHENTICATED', permission: '*' })
```

`securityLog` event listesi:
| Event | Nerede |
|---|---|
| `auth.unauthenticated_server_action` | `requireAbility()` |
| `export.dead_letter` | `exportDeadLetterFn` |
| Diğerleri | `logger.ts` içindeki mevcut çağrılar |

---

## Health Endpoints

### `GET /api/live`

**Amaç:** Process alive mi?  
**Kontrol:** Yok — sadece 200 döner.  
**Kullanım:** Load balancer crash/hang tespiti.

```json
{ "ok": true }
```

### `GET /api/ready`

**Amaç:** Sistem trafik almaya hazır mı?  
**Kontrol:** Supabase REST endpoint (3 sn timeout).  
**Kullanım:** Deployment sonrası trafik yönlendirmeden önce.

```json
{ "ok": true }
// veya
{ "ok": false, "reason": "supabase 503" }
```

HTTP: `200` / `503`

### `GET /api/health`

**Amaç:** Detaylı sistem durumu.  
**Kontrol:** DB ping + latency ölçümü.  
**Kullanım:** Dashboard, alerting, manuel tanılama.

```json
{
  "status": "healthy",
  "uptime_ms": 3600000,
  "duration_ms": 42,
  "checks": {
    "db": {
      "status": "ok",
      "latency_ms": 38
    }
  }
}
// veya
{
  "status": "degraded",
  "checks": {
    "db": { "status": "error", "latency_ms": 3001, "error": "The operation was aborted due to timeout" }
  }
}
```

HTTP: `200` / `503`

---

## Vercel Dashboard Önerileri

### Log Drains

Vercel Log Drains ile tüm pino JSON logları dışarı aktarılabilir:

- **Datadog:** `DATADOG_API_KEY` env ile `vercel log-drain add`
- **Logtail / Better Stack:** structured log analizi için
- **Grafana Loki:** self-hosted tercih için

### Önerilen Alert Kuralları

| Metric | Eşik | Aksiyon |
|---|---|---|
| `slow query` log count | > 10/dak | Slack alert |
| `export.dead_letter` event | herhangi biri | Immediate alert |
| `/api/ready` 503 | 2 ardışık | Deployment durdur |
| `auth.unauthenticated_server_action` | > 50/saat | Security review |
| DB latency > `DB_ERROR_MS` | > 5/dak | DBA bilgilendir |

### Önerilen Dashboard Panelleri

1. **Request Rate** — `/api/internal/*` endpoint'leri bazında RPS
2. **Error Rate** — 4xx / 5xx oranı
3. **P50/P95/P99 Latency** — `X-Duration-Ms` header'larından
4. **Slow Queries** — label bazında frekans ve süre
5. **Export Queue** — pending / processing / failed job sayısı
6. **Auth Anomalies** — `securityLog` event'leri zaman serisi
7. **DB Health** — `/api/health` latency_ms trendi
