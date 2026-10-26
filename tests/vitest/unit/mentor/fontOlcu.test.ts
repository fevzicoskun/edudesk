// tests/vitest/unit/mentor/fontOlcu.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { metinGenisligi } from '@/src/domains/mentor/lib/fontOlcu'

const kalin = readFileSync(path.join(process.cwd(), 'assets/fonts/BricolageGrotesque-ExtraBold.ttf'))

describe('metinGenisligi (TTF cmap + hmtx)', () => {
  it('boş metin 0; genişlik puntoyla orantılı', () => {
    expect(metinGenisligi(kalin, '', 34)).toBe(0)
    expect(metinGenisligi(kalin, 'Edebiyat', 68)).toBeCloseTo(2 * metinGenisligi(kalin, 'Edebiyat', 34), 5)
  })
  it('geniş harf dar harften geniş; Türkçe harfler ölçülür', () => {
    expect(metinGenisligi(kalin, 'WWW', 34)).toBeGreaterThan(metinGenisligi(kalin, 'iii', 34))
    expect(metinGenisligi(kalin, 'İngilizce', 34)).toBeGreaterThan(metinGenisligi(kalin, 'ngilizce', 34))
  })
  it('makul aralıkta: 34px "Edebiyat" ~ 140–190px (eski görselde ölçülen ~150)', () => {
    const w = metinGenisligi(kalin, 'Edebiyat', 34)
    expect(w).toBeGreaterThan(140); expect(w).toBeLessThan(190)
  })
})

describe('bölünmez boşluk (girinti için)', () => {
  const normal = readFileSync(path.join(process.cwd(), 'assets/fonts/BricolageGrotesque-Regular.ttf'))
  it('NBSP fontta var ve normal boşlukla aynı genişlikte (glif 0 / .notdef değil)', () => {
    const nb = metinGenisligi(normal, ' ', 34)
    expect(nb).toBeGreaterThan(4)
    expect(nb).toBeCloseTo(metinGenisligi(normal, ' ', 34), 5)
  })
})
