import { describe, it, expect } from 'vitest'
import { parseStudentRows, excelCellToString } from '@/src/domains/classes/services/studentImportParser'

// ─────────────────────────────────────────────────────────────
describe('parseStudentRows() — başlık algılama', () => {
  it('standart e-Okul formatı: "Okul No" + "Adı Soyadı"', () => {
    const result = parseStudentRows([
      ['Okul No', 'Adı Soyadı'],
      ['15', 'Ahmet Yılmaz'],
      ['23', 'Ayşe Demir'],
    ])
    expect(result.errors).toEqual([])
    expect(result.students).toEqual([
      { full_name: 'Ahmet Yılmaz', student_number: '15' },
      { full_name: 'Ayşe Demir', student_number: '23' },
    ])
  })

  it.each([
    ['Ad Soyad'],
    ['Adı Soyadı'],
    ['ADI SOYADI'],
    ['ad soyad'],
    ['Öğrenci Adı Soyadı'],
    ['Adı'],
  ])('ad sütunu varyasyonu tanınır: "%s"', (header) => {
    const result = parseStudentRows([
      [header],
      ['Mehmet Kaya'],
    ])
    expect(result.errors).toEqual([])
    expect(result.students).toEqual([{ full_name: 'Mehmet Kaya', student_number: null }])
  })

  it.each([
    ['Öğrenci No'],
    ['Okul No'],
    ['OKUL NO'],
    ['Numara'],
    ['No'],
    ['Okul Numarası'],
    ['Öğrenci Numarası'],
  ])('numara sütunu varyasyonu tanınır: "%s"', (header) => {
    const result = parseStudentRows([
      [header, 'Adı Soyadı'],
      ['42', 'Fatma Şahin'],
    ])
    expect(result.errors).toEqual([])
    expect(result.students).toEqual([{ full_name: 'Fatma Şahin', student_number: '42' }])
  })

  it('büyük harf Türkçe İ/I doğru normalize edilir (ADI SOYADI, ÖĞRENCİ NO)', () => {
    const result = parseStudentRows([
      ['ÖĞRENCİ NO', 'ADI SOYADI'],
      ['7', 'Zeynep Arslan'],
    ])
    expect(result.errors).toEqual([])
    expect(result.students).toEqual([{ full_name: 'Zeynep Arslan', student_number: '7' }])
  })

  it('başlıkta fazladan boşluk/noktalama tolere edilir', () => {
    const result = parseStudentRows([
      [' Okul No :', ' Adı  Soyadı '],
      ['3', 'Ali Can'],
    ])
    expect(result.errors).toEqual([])
    expect(result.students).toEqual([{ full_name: 'Ali Can', student_number: '3' }])
  })

  it('başlık satırı üstündeki başlıksız satırlar (e-Okul rapor başlığı) atlanır', () => {
    const result = parseStudentRows([
      ['T.C. MİLLÎ EĞİTİM BAKANLIĞI'],
      ['9-A Sınıf Listesi', ''],
      ['Okul No', 'Adı Soyadı'],
      ['1', 'Ahmet Yılmaz'],
    ])
    expect(result.errors).toEqual([])
    expect(result.students).toEqual([{ full_name: 'Ahmet Yılmaz', student_number: '1' }])
  })

  it('ilgisiz ek sütunlar (Sınıfı, Cinsiyeti) göz ardı edilir', () => {
    const result = parseStudentRows([
      ['Sıra', 'Okul No', 'Adı Soyadı', 'Sınıfı', 'Cinsiyeti'],
      ['1', '15', 'Ahmet Yılmaz', '9-A', 'Erkek'],
    ])
    expect(result.errors).toEqual([])
    expect(result.students).toEqual([{ full_name: 'Ahmet Yılmaz', student_number: '15' }])
  })

  it('başlık satırı yoksa hata döndürür, ilk sütun=ad varsayımı yapmaz', () => {
    const result = parseStudentRows([
      ['Ahmet Yılmaz', '15'],
      ['Ayşe Demir', '23'],
    ])
    expect(result.students).toEqual([])
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].row).toBe(1)
    expect(result.errors[0].message).toContain('Başlık satırı bulunamadı')
  })

  it('boş dosya → başlık hatası', () => {
    const result = parseStudentRows([])
    expect(result.students).toEqual([])
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('Başlık satırı bulunamadı')
  })
})

// ─────────────────────────────────────────────────────────────
describe('parseStudentRows() — Adı / Soyadı ayrı sütunlar', () => {
  it('Adı ve Soyadı sütunları birleştirilir', () => {
    const result = parseStudentRows([
      ['Okul No', 'Adı', 'Soyadı'],
      ['5', 'Ahmet', 'Yılmaz'],
      ['6', 'Ayşe Nur', 'Demir'],
    ])
    expect(result.errors).toEqual([])
    expect(result.students).toEqual([
      { full_name: 'Ahmet Yılmaz', student_number: '5' },
      { full_name: 'Ayşe Nur Demir', student_number: '6' },
    ])
  })

  it('Ad / Soyad varyasyonu da birleştirilir', () => {
    const result = parseStudentRows([
      ['No', 'Ad', 'Soyad'],
      ['1', 'Mehmet', 'Kaya'],
    ])
    expect(result.errors).toEqual([])
    expect(result.students).toEqual([{ full_name: 'Mehmet Kaya', student_number: '1' }])
  })

  it('soyadı boşsa sadece ad kullanılır (geçerliyse)', () => {
    const result = parseStudentRows([
      ['Adı', 'Soyadı'],
      ['Aysel', ''],
    ])
    expect(result.errors).toEqual([])
    expect(result.students).toEqual([{ full_name: 'Aysel', student_number: null }])
  })
})

// ─────────────────────────────────────────────────────────────
describe('parseStudentRows() — satır işleme', () => {
  it('boş satırlar sessizce atlanır', () => {
    const result = parseStudentRows([
      ['Okul No', 'Adı Soyadı'],
      ['1', 'Ahmet Yılmaz'],
      ['', ''],
      [],
      ['2', 'Ayşe Demir'],
    ])
    expect(result.errors).toEqual([])
    expect(result.students).toHaveLength(2)
  })

  it('adı boş ama numarası dolu satır → satır hatası (Excel satır numarasıyla)', () => {
    const result = parseStudentRows([
      ['Okul No', 'Adı Soyadı'],
      ['1', 'Ahmet Yılmaz'],
      ['2', ''],
    ])
    expect(result.students).toHaveLength(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].row).toBe(3)
    expect(result.errors[0].message).toContain('Ad soyad boş')
  })

  it('2 karakterden kısa ad → satır hatası', () => {
    const result = parseStudentRows([
      ['Adı Soyadı'],
      ['X'],
      ['Ali Veli'],
    ])
    expect(result.students).toEqual([{ full_name: 'Ali Veli', student_number: null }])
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].row).toBe(2)
    expect(result.errors[0].message).toContain('en az 2 karakter')
  })

  it('isimler trim edilir, içteki fazla boşluklar tekilleştirilir', () => {
    const result = parseStudentRows([
      ['Adı Soyadı'],
      ['  Mehmet   Ali   Kaya  '],
    ])
    expect(result.students).toEqual([{ full_name: 'Mehmet Ali Kaya', student_number: null }])
  })

  it('numara sütunu yoksa student_number null olur', () => {
    const result = parseStudentRows([
      ['Adı Soyadı'],
      ['Ahmet Yılmaz'],
    ])
    expect(result.students[0].student_number).toBeNull()
  })

  it('numara hücresi boşsa null olur', () => {
    const result = parseStudentRows([
      ['Okul No', 'Adı Soyadı'],
      ['  ', 'Ahmet Yılmaz'],
    ])
    expect(result.students[0].student_number).toBeNull()
  })

  it('numara trim edilir', () => {
    const result = parseStudentRows([
      ['Okul No', 'Adı Soyadı'],
      [' 42 ', 'Ahmet Yılmaz'],
    ])
    expect(result.students[0].student_number).toBe('42')
  })

  it('başlık satırından sonra hiç geçerli öğrenci yoksa students boş döner', () => {
    const result = parseStudentRows([
      ['Okul No', 'Adı Soyadı'],
    ])
    expect(result.students).toEqual([])
    expect(result.errors).toEqual([])
  })

  it('hatalı satırlar geçerli satırların eklenmesini engellemez', () => {
    const result = parseStudentRows([
      ['Okul No', 'Adı Soyadı'],
      ['1', 'Ahmet Yılmaz'],
      ['2', 'A'],
      ['3', ''],
      ['4', 'Ayşe Demir'],
    ])
    expect(result.students).toHaveLength(2)
    expect(result.errors).toHaveLength(2)
    expect(result.errors.map((e) => e.row)).toEqual([3, 4])
  })
})

// ─────────────────────────────────────────────────────────────
describe('excelCellToString()', () => {
  it('null/undefined → boş string', () => {
    expect(excelCellToString(null)).toBe('')
    expect(excelCellToString(undefined)).toBe('')
  })

  it('string olduğu gibi döner', () => {
    expect(excelCellToString('Ahmet')).toBe('Ahmet')
  })

  it('sayı string\'e çevrilir', () => {
    expect(excelCellToString(42)).toBe('42')
  })

  it('richText hücresi düz metne çevrilir', () => {
    expect(
      excelCellToString({ richText: [{ text: 'Adı ' }, { text: 'Soyadı' }] })
    ).toBe('Adı Soyadı')
  })

  it('hyperlink hücresi text alanını kullanır', () => {
    expect(excelCellToString({ text: 'Ali Can', hyperlink: 'http://x' })).toBe('Ali Can')
  })

  it('formül hücresi result alanını kullanır', () => {
    expect(excelCellToString({ formula: 'A1&B1', result: 'Ahmet Yılmaz' })).toBe('Ahmet Yılmaz')
  })

  it('boolean string\'e çevrilir', () => {
    expect(excelCellToString(true)).toBe('true')
  })
})
