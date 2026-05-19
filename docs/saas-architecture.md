# SaaS Architecture

## Tenant Modeli

Her okul bir **tenant**'tır. Tüm veriler `school_id` ile izole edilir. Bu yapı migration öncesinde kurulmuş olup bu belge üzerine inşa edilen tenant yönetim katmanını açıklar.

### Tenant Yaşam Döngüsü

```
trial ──────────────────→ active ──────────────────→ cancelled
  │                          │
  │                          ├──→ suspended ──→ active (yeniden)
  │                          │
  └──────────────────────────┘
         (upgrade)
```

| Durum | Açıklama |
|---|---|
| `trial` | Deneme süresi, sınırlı kota |
| `active` | Normal erişim, plan kotası geçerli |
| `suspended` | Erişim kısıtlı (ödeme sorunu, ihlal) |
| `cancelled` | Hesap kapatıldı |

---

## Tablolar

### `platform_admins`

Cross-tenant visibility'ye sahip süper-adminler. School RBAC ile bağımsız.

```sql
platform_admins (
  id         uuid references auth.users,
  email      text,
  created_at timestamptz
)
```

RLS: `false` — yalnızca `service_role` erişimi.

### `schools` (eklenen kolonlar)

```sql
status        text  -- 'active' | 'suspended' | 'trial' | 'cancelled'
plan          text  -- 'free' | 'starter' | 'pro' | 'enterprise'
suspended_at  timestamptz
suspended_by  uuid references auth.users
trial_ends_at timestamptz
```

### `school_quotas`

Her okul için kaynak kotaları. Okul oluşturulduğunda seed edilir.

```sql
school_quotas (
  school_id       uuid references schools,
  max_teachers    int  default 20,
  max_students    int  default 500,
  max_storage_mb  int  default 1024,
  used_storage_mb int  default 0,
  updated_at      timestamptz
)
```

### `tenant_metrics` (view)

Super-admin dashboard için cross-school aggregate. `service_role` ile okunur.

---

## Platform Admin API

Base: `/api/internal/admin/`

**Auth:** `Authorization: Bearer <token>` + `platform_admins` tablosunda kayıt.

### `GET /api/internal/admin/tenants`

Tüm okulları metriklerle listeler.

```json
{
  "ok": true,
  "data": {
    "tenants": [
      {
        "school_id": "...",
        "school_name": "Atatürk İlkokulu",
        "status": "active",
        "plan": "pro",
        "teacher_count": 18,
        "student_count": 340,
        "max_teachers": 30,
        "failed_exports_7d": 0
      }
    ]
  }
}
```

### `GET /api/internal/admin/:schoolId`

Tek okul detay + kota bilgisi.

### `PATCH /api/internal/admin/:schoolId`

| action | Body | Açıklama |
|---|---|---|
| `suspend` | `{ action, reason }` | Okulu askıya al |
| `activate` | `{ action }` | Okulu aktifleştir |
| `set_plan` | `{ action, plan }` | Plan değiştir |
| `set_quota` | `{ action, max_teachers?, max_students?, max_storage_mb? }` | Kota güncelle |

---

## Quota Sistemi

`QuotaService` gerçek zamanlı kota kontrolü sağlar.

```ts
// Öğretmen daveti öncesi
const result = await QuotaService.checkTeacherQuota(schoolId)
if (!result.allowed) {
  throw new Error(`Öğretmen limiti aşıldı (${result.current}/${result.max})`)
}

// Dosya yükleme öncesi
const result = await QuotaService.checkStorageQuota(schoolId, fileSizeMb)
if (!result.allowed) {
  throw new Error('Depolama limiti aşıldı')
}

// Yükleme sonrası kullanımı güncelle
await QuotaService.updateStorageUsage(schoolId, fileSizeMb)
```

### Plan Limitleri (önerilen)

| Plan | Öğretmen | Öğrenci | Depolama |
|---|---|---|---|
| free | 5 | 100 | 256 MB |
| starter | 15 | 300 | 512 MB |
| pro | 30 | 800 | 2 GB |
| enterprise | ∞ | ∞ | ∞ |

> Bu limitler `school_quotas` tablosuna plan değişiminde yazılır. `QuotaService` tabloyu okur, plan enum'ını değil.

---

## Güvenlik

### School Isolation

Mevcut RLS politikaları `school_id` bazlı izolasyonu korur. Suspended okullar için:

```sql
-- school_is_active() helper — mevcut RLS'e entegre edilebilir
create function school_is_active(sid uuid) returns boolean ...
```

Kritik endpoint'lerde `TenantService.isActive(schoolId)` ile suspended kontrolü eklenebilir.

### Cross-Tenant Erişim Yok

- `platform_admins` dışındaki hiçbir kullanıcı başka okulun datasını göremez
- Tüm `withInternalAuth` handler'ları `ability.schoolId` ile kendi okuluna kilitli
- Admin API'si ayrı auth mekanizması kullanır (`service_role` token doğrulama)

---

## Billing-Ready Mimari

Stripe entegrasyonu için zemin hazır:

1. **`school_quotas.plan`** → Stripe product ID ile eşleştirilir
2. **`TenantService.changePlan()`** → Stripe webhook tetikleyicisi olur
3. **`QuotaService.setQuotaLimits()`** → Plan upgrade/downgrade sonrası çağrılır
4. **`school_quotas.used_storage_mb`** → Usage-based billing metriği olarak kullanılır

Örnek Stripe webhook akışı:
```
Stripe "customer.subscription.updated" webhook
  → /api/webhooks/stripe (henüz yok)
  → TenantService.changePlan(schoolId, newPlan, 'stripe-webhook')
  → QuotaService.setQuotaLimits(schoolId, PLAN_LIMITS[newPlan])
```

---

## Tenant Metrics & Alerting

`tenant_metrics` view'undaki `failed_exports_7d` kolonunu izle:

- > 3 başarısız export → okul adminine bildirim
- Öğretmen sayısı `max_teachers`'a yaklaşıyorsa → upsell fırsatı
- `trial_ends_at` yaklaşıyorsa → otomatik email (future)

Önerilen cron:
```sql
-- Günlük trial expiry kontrolü (Supabase cron)
select cron.schedule('check-trial-expiry', '0 9 * * *', $$
  update schools
  set status = 'suspended'
  where status = 'trial'
  and trial_ends_at < now()
$$);
```
