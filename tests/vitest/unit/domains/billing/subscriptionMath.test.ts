import { describe, it, expect } from 'vitest'
import { subscriptionState, kalanGun, UYARI_ESIGI_GUN } from '@/src/domains/billing/subscriptionMath'

const TODAY = '2026-07-09'

describe('kalanGun', () => {
  it('bugün biten için 0 döner', () => {
    expect(kalanGun('2026-07-09', TODAY)).toBe(0)
  })
  it('yarın biten için 1 döner', () => {
    expect(kalanGun('2026-07-10', TODAY)).toBe(1)
  })
  it('dün bitmiş için -1 döner', () => {
    expect(kalanGun('2026-07-08', TODAY)).toBe(-1)
  })
})

describe('subscriptionState', () => {
  it('suspended status her şeyi ezer (access_until gelecekte olsa bile)', () => {
    expect(subscriptionState({ status: 'suspended', access_until: '2027-01-01' }, TODAY)).toBe('suspended')
  })
  it('cancelled status suspended sayılır', () => {
    expect(subscriptionState({ status: 'cancelled', access_until: null }, TODAY)).toBe('suspended')
  })
  it('access_until null → süresiz erişim (geriye uyumluluk)', () => {
    expect(subscriptionState({ status: 'active', access_until: null }, TODAY)).toBe('active')
  })
  it('access_until bugün → hâlâ açık ama expiring (dahil son gün)', () => {
    expect(subscriptionState({ status: 'active', access_until: '2026-07-09' }, TODAY)).toBe('expiring')
  })
  it('access_until dün → expired', () => {
    expect(subscriptionState({ status: 'active', access_until: '2026-07-08' }, TODAY)).toBe('expired')
  })
  it('tam 14 gün kala → expiring (sınır dahil)', () => {
    expect(subscriptionState({ status: 'active', access_until: '2026-07-23' }, TODAY)).toBe('expiring')
  })
  it('15 gün kala → active', () => {
    expect(subscriptionState({ status: 'active', access_until: '2026-07-24' }, TODAY)).toBe('active')
  })
  it('trial status da aynı mekanizmadan geçer', () => {
    expect(subscriptionState({ status: 'trial', access_until: '2026-07-01' }, TODAY)).toBe('expired')
  })
  it('eşik sabiti 14', () => {
    expect(UYARI_ESIGI_GUN).toBe(14)
  })
})
