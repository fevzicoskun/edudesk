import { describe, it, expect } from 'vitest'
import { avatarYolu } from '@/src/domains/users/lib/avatarYolu'

const BASE = 'https://x.supabase.co/storage/v1/object/public/avatars/'
const BEN = '11111111-1111-4111-8111-111111111111'
const KOLEGA = '22222222-2222-4222-8222-222222222222'

describe('avatarYolu', () => {
  it('kendi klasöründeki dosyanın yolunu verir', () => {
    expect(avatarYolu(`${BASE}${BEN}/1700.webp?t=1`, BEN)).toBe(`${BEN}/1700.webp`)
  })
  it('başkasının dosyasını gösteren URL → null (silinmez)', () => {
    expect(avatarYolu(`${BASE}${KOLEGA}/1700.webp`, BEN)).toBeNull()
  })
  it('klasörden çıkma denemesi → null', () => {
    expect(avatarYolu(`${BASE}${BEN}/..%2F${KOLEGA}/1700.webp`, BEN)).toBeNull()
  })
  it('boş/tanımsız URL → null', () => {
    expect(avatarYolu(null, BEN)).toBeNull()
    expect(avatarYolu('https://baska.site/resim.png', BEN)).toBeNull()
  })
})
