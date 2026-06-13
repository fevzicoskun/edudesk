# Kullanıcı Davet Maili Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Müdür/müdür yardımcısı yeni kullanıcı oluşturduğunda o kullanıcıya e-posta ile giriş bilgilerini otomatik olarak ilet.

**Architecture:** `buildInviteEmail()` builder `src/lib/email-utils.ts`'e eklenir; `inviteUser` action'ı `UserService.invite()` başarılı dönünce `getCurrentProfile()` ile okul adını çekip `mailer.sendMail()` çağırır. Mail başarısız olursa `logger.error` ile loglanır ama action yine `{ success: true, tempPassword }` döner (non-blocking, müdür şifreyi ekranda da görür).

**Tech Stack:** TypeScript, Next.js App Router server actions, Resend (mailer), Vitest 4.x (node env)

---

## Dosya haritası

| İşlem | Dosya | Ne değişiyor |
|-------|-------|--------------|
| Modify | `src/lib/email-utils.ts` | `buildInviteEmail()` fonksiyonu eklendi |
| Modify | `app/actions/users.ts` | `inviteUser` → mail gönderimi eklendi |
| Create | `tests/vitest/unit/email/email-utils.test.ts` | `buildInviteEmail` için 2 birim test |
| Create | `tests/vitest/unit/users/invite-action.test.ts` | `inviteUser` action için 3 entegrasyon test |

---

### Task 1: `buildInviteEmail()` builder + testleri

**Files:**
- Modify: `src/lib/email-utils.ts`
- Create: `tests/vitest/unit/email/email-utils.test.ts`

- [ ] **Step 1: Failing testleri yaz**

`tests/vitest/unit/email/email-utils.test.ts` dosyasını oluştur:

```ts
import { describe, it, expect } from 'vitest'
import { buildInviteEmail } from '@/src/lib/email-utils'

describe('buildInviteEmail()', () => {
  it('kullanıcı verilerini HTML içinde esc ile render eder', () => {
    const html = buildInviteEmail({
      fullName:     'Ali Veli',
      schoolName:   'Test Okulu',
      email:        'ali@test.com',
      tempPassword: 'Abc123!',
    })
    expect(html).toContain('Ali Veli')
    expect(html).toContain('Test Okulu')
    expect(html).toContain('ali@test.com')
    expect(html).toContain('Abc123!')
    expect(html).toContain('https://myedudesk.com.tr/login')
  })

  it('<script> ve özel karakterler esc ile kaçırılır', () => {
    const html = buildInviteEmail({
      fullName:     '<script>alert(1)</script>',
      schoolName:   'Okul & Test',
      email:        'x@test.com',
      tempPassword: 'Pass"Word',
    })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('Okul &amp; Test')
    expect(html).toContain('Pass&quot;Word')
  })
})
```

- [ ] **Step 2: Testin fail ettiğini doğrula**

```bash
npx vitest run tests/vitest/unit/email/email-utils.test.ts
```

Beklenen: FAIL — `buildInviteEmail is not a function`

- [ ] **Step 3: `buildInviteEmail()` fonksiyonunu yaz**

`src/lib/email-utils.ts` dosyasının sonuna ekle (mevcut `buildMissedEmail` sonrasına):

```ts
export function buildInviteEmail(opts: {
  fullName:     string
  schoolName:   string
  email:        string
  tempPassword: string
}): string {
  const { fullName, schoolName, email, tempPassword } = opts
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>${BASE_CSS}
h2{margin:0 0 16px;color:#1f2937}
table{width:100%;border-collapse:collapse;margin:16px 0}
td{padding:8px;border-bottom:1px solid #e5e7eb}
td:first-child{color:#6b7280;width:40%}
.btn{display:inline-block;background:#10b981;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600}
.hint{color:#6b7280;font-size:14px}
</style></head>
<body><div class="box">
<h2>Hoş Geldiniz, ${esc(fullName)}!</h2>
<p><strong>${esc(schoolName)}</strong> için EduDesk hesabınız oluşturuldu.</p>
<table>
  <tr><td>E-posta</td><td><strong>${esc(email)}</strong></td></tr>
  <tr><td>Geçici Şifre</td><td><strong>${esc(tempPassword)}</strong></td></tr>
</table>
<p><a href="https://myedudesk.com.tr/login" class="btn">Giriş Yap</a></p>
<p class="hint">İlk girişten sonra şifrenizi değiştirmenizi öneririz.</p>
<div class="footer">EduDesk — Okul Takip Sistemi</div>
</div></body></html>`
}
```

- [ ] **Step 4: Testlerin geçtiğini doğrula**

```bash
npx vitest run tests/vitest/unit/email/email-utils.test.ts
```

Beklenen: PASS (2/2)

- [ ] **Step 5: Commit**

```bash
git add src/lib/email-utils.ts tests/vitest/unit/email/email-utils.test.ts
git commit -m "feat: add buildInviteEmail() to email-utils"
```

---

### Task 2: `inviteUser` action'a mail gönderimi + testleri

**Files:**
- Modify: `app/actions/users.ts`
- Create: `tests/vitest/unit/users/invite-action.test.ts`

- [ ] **Step 1: Failing testleri yaz**

`tests/vitest/unit/users/invite-action.test.ts` dosyasını oluştur:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/src/domains/users/services/UserService', () => ({
  UserService: { invite: vi.fn() },
}))

vi.mock('@/src/lib/mailer', () => ({
  mailer: { sendMail: vi.fn() },
}))

vi.mock('@/src/shared/auth', () => ({
  getCurrentProfile: vi.fn(),
}))

vi.mock('@/src/infrastructure/observability/logger', () => ({
  logger: { error: vi.fn() },
}))

const { UserService }       = await import('@/src/domains/users/services/UserService')
const { mailer }            = await import('@/src/lib/mailer')
const { getCurrentProfile } = await import('@/src/shared/auth')
const { inviteUser }        = await import('@/app/actions/users')

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData()
  Object.entries(data).forEach(([k, v]) => fd.append(k, v))
  return fd
}

const VALID_FD = makeFormData({
  email:     'ogretmen@test.com',
  full_name: 'Test Öğretmen',
  role:      'ogretmen',
})

beforeEach(() => { vi.clearAllMocks() })

describe('inviteUser — mail davranışı', () => {
  it('başarılı invite → mailer.sendMail doğru to ve subject ile çağrılır', async () => {
    vi.mocked(UserService.invite).mockResolvedValue({ success: true, tempPassword: 'TmpPass123' })
    vi.mocked(getCurrentProfile).mockResolvedValue({
      schools: { name: 'Mevlana Ortaokulu', slug: 'mevlana' },
    } as never)
    vi.mocked(mailer.sendMail).mockResolvedValue(undefined)

    const result = await inviteUser(undefined, VALID_FD)

    expect(result.success).toBe(true)
    expect(mailer.sendMail).toHaveBeenCalledOnce()
    expect(mailer.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to:      'ogretmen@test.com',
        subject: 'EduDesk — Giriş Bilgileriniz',
      })
    )
  })

  it('mailer hatası fırlatırsa action yine success: true döner (non-blocking)', async () => {
    vi.mocked(UserService.invite).mockResolvedValue({ success: true, tempPassword: 'TmpPass123' })
    vi.mocked(getCurrentProfile).mockResolvedValue({
      schools: { name: 'Test Okulu', slug: 'test' },
    } as never)
    vi.mocked(mailer.sendMail).mockRejectedValue(new Error('SMTP bağlantı hatası'))

    const result = await inviteUser(undefined, VALID_FD)

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('UserService.invite hata döndürünce mailer hiç çağrılmaz', async () => {
    vi.mocked(UserService.invite).mockResolvedValue({ error: 'Bu e-posta zaten kayıtlı' })

    const result = await inviteUser(undefined, VALID_FD)

    expect(result.error).toBe('Bu e-posta zaten kayıtlı')
    expect(mailer.sendMail).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Testin fail ettiğini doğrula**

```bash
npx vitest run tests/vitest/unit/users/invite-action.test.ts
```

Beklenen: FAIL — `mailer.sendMail` çağrılmıyor (henüz action'a eklenmedi)

- [ ] **Step 3: `inviteUser` action'a mail mantığını ekle**

`app/actions/users.ts` import bloğunu güncelle:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { UUID } from '@/src/shared/validation'
import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import { logger } from '@/src/infrastructure/observability/logger'
import { z } from 'zod'
import { profileSchema, AssignableRole } from '@/src/domains/users/validators'
import { UserService } from '@/src/domains/users/services/UserService'
import { mailer } from '@/src/lib/mailer'
import { buildInviteEmail } from '@/src/lib/email-utils'
import type { Role } from '@/src/shared/types'
import type { InviteResult } from '@/src/domains/users/types'
import type { ActionResult } from '@/src/shared/types'
```

`inviteUser` fonksiyonunu güncelle (`result` döndürmeden önceki kısmı):

```ts
export async function inviteUser(_: unknown, formData: FormData): Promise<InviteResult> {
  const parsed = inviteSchema.safeParse({
    email:     String(formData.get('email') ?? '').trim().toLowerCase(),
    full_name: String(formData.get('full_name') ?? '').trim(),
    subject:   String(formData.get('subject') ?? '').trim() || undefined,
    role:      String(formData.get('role') ?? ''),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const result = await UserService.invite({
    email:     parsed.data.email,
    full_name: parsed.data.full_name,
    subject:   parsed.data.subject ?? null,
    role:      parsed.data.role as Role,
  })

  if (result.success) {
    revalidatePath('/kullanicilar')
    if (result.tempPassword) {
      const profile    = await getCurrentProfile()
      const schoolName = profile?.schools?.name ?? 'Okulunuz'
      try {
        await mailer.sendMail({
          to:      parsed.data.email,
          subject: 'EduDesk — Giriş Bilgileriniz',
          html:    buildInviteEmail({
            fullName:     parsed.data.full_name,
            schoolName,
            email:        parsed.data.email,
            tempPassword: result.tempPassword,
          }),
        })
      } catch (err) {
        logger.error(
          { event: 'invite_mail_failed', email: parsed.data.email, err: err instanceof Error ? err.message : String(err) },
          'Davet maili gönderilemedi'
        )
      }
    }
  }

  return result
}
```

- [ ] **Step 4: Testlerin geçtiğini doğrula**

```bash
npx vitest run tests/vitest/unit/users/invite-action.test.ts
```

Beklenen: PASS (3/3)

- [ ] **Step 5: Tüm testlerin hâlâ geçtiğini doğrula**

```bash
npm run test:unit
```

Beklenen: tüm testler PASS (önceki sayı + 5 yeni = toplam artış)

- [ ] **Step 6: Commit**

```bash
git add app/actions/users.ts tests/vitest/unit/users/invite-action.test.ts
git commit -m "feat: send welcome email with credentials on user invite"
```

---

## Doğrulama özeti

| Gereksinim | Doğrulama |
|-----------|-----------|
| Mail başarılı invite'ta gider | Test 1 |
| Mail başarısız → action başarılı döner | Test 2 |
| Hatalı invite → mail atılmaz | Test 3 |
| Kullanıcı verileri XSS'e karşı korunur | email-utils Test 2 |
| Okul adı `getCurrentProfile()` ile çekilir | Test 1 — `schoolName` mock'tan geliyor |
| Fallback: okul bulunamazsa `'Okulunuz'` | `profile?.schools?.name ?? 'Okulunuz'` |
