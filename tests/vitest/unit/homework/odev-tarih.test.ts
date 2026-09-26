import { describe, it, expect } from 'vitest'
import { odevTarihHatasi } from '@/src/domains/homework/lib/odev-tarih'

const BUGUN = '2026-09-26'

describe('odevTarihHatasi()', () => {
  it('bugün verilip ileri tarihe teslim: geçerli', () => {
    expect(odevTarihHatasi('2026-09-26', '2026-09-30', BUGUN)).toBeNull()
  })

  it('geçmişte verilmiş, teslimi de geçmiş ödev sonradan girilebilir (WhatsApp\'tan geç görülen)', () => {
    expect(odevTarihHatasi('2026-09-23', '2026-09-25', BUGUN)).toBeNull()
  })

  it('aynı gün teslim: geçerli', () => {
    expect(odevTarihHatasi('2026-09-23', '2026-09-23', BUGUN)).toBeNull()
  })

  it('verildiği tarih gelecekte olamaz', () => {
    expect(odevTarihHatasi('2026-09-27', '2026-09-30', BUGUN)).toMatch(/gelecekte/)
  })

  it('son teslim verildiği tarihten önce olamaz', () => {
    expect(odevTarihHatasi('2026-09-23', '2026-09-22', BUGUN)).toMatch(/verildiği tarihten önce/)
  })
})
