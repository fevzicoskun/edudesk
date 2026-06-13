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
