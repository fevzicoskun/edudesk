import { describe, it, expect } from 'vitest'
import { computeSquareCrop } from '@/src/shared/image/resizeImage'

describe('computeSquareCrop', () => {
  it('kare girdide kırpma yok', () => {
    expect(computeSquareCrop(500, 500)).toEqual({ sx: 0, sy: 0, size: 500 })
  })

  it('yatay görselde yatay merkezden kırpar', () => {
    expect(computeSquareCrop(800, 400)).toEqual({ sx: 200, sy: 0, size: 400 })
  })

  it('dikey görselde dikey merkezden kırpar', () => {
    expect(computeSquareCrop(400, 800)).toEqual({ sx: 0, sy: 200, size: 400 })
  })

  it('tek sayı farkta floor uygular', () => {
    expect(computeSquareCrop(101, 100)).toEqual({ sx: 0, sy: 0, size: 100 })
  })
})
