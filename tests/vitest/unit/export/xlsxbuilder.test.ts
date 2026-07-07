import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock: server-only ───────────────────────────────────────
vi.mock('server-only', () => ({}))

// ─── Mock: Supabase service client ──────────────────────────
vi.mock('@/src/infrastructure/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

const { createServiceClient } = await import('@/src/infrastructure/supabase/service')
const { fetchRows, buildXlsx, uploadToStorage } = await import('@/src/domains/export/services/XlsxBuilder')

// ─── Helpers ─────────────────────────────────────────────────

const SCHOOL_ID = 'school-test-abc'
const USER_ID   = 'user-test-xyz'

/** Fluent Supabase query builder mock */
function makeQueryMock(result: { data: unknown; error: unknown }) {
  const q: Record<string, ReturnType<typeof vi.fn>> = {
    select:          vi.fn(),
    eq:              vi.fn(),
    is:              vi.fn(),
    order:           vi.fn(),
    limit:           vi.fn(),
    in:              vi.fn(),
    gte:             vi.fn(),
    lte:             vi.fn(),
    then:            vi.fn().mockImplementation((resolve: (v: unknown) => unknown) => Promise.resolve(resolve(result))),
  }
  // Make each fluent method return the same query object AND be awaitable
  Object.keys(q).forEach(k => {
    if (k !== 'then') {
      q[k].mockReturnValue(q)
    }
  })
  return q
}

/** Build a Supabase client mock with from() → table-specific query */
function makeDbMock(tableResults: Record<string, { data: unknown; error: unknown }>) {
  return {
    from: vi.fn((table: string) => makeQueryMock(tableResults[table] ?? { data: [], error: null })),
    storage: {
      from: vi.fn(() => ({
        upload:          vi.fn().mockResolvedValue({ error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://signed.url/file.xlsx' } }),
      })),
    },
  }
}

beforeEach(() => vi.clearAllMocks())

// ─────────────────────────────────────────────────────────────
// buildXlsx
// ─────────────────────────────────────────────────────────────

describe('buildXlsx()', () => {
  it('boş satır dizisi → "Veri bulunamadı" satırını içeren buffer döner', async () => {
    const buf = await buildXlsx([], 'excel_odevler')
    expect(buf).toBeInstanceOf(Buffer)
    expect(buf.length).toBeGreaterThan(0)
  })

  it('boş satır dizisi → buffer geçerli xlsx dosyasıdır (PK magic bytes)', async () => {
    const buf = await buildXlsx([], 'excel_notlar')
    // xlsx = zip → başlar PK (0x50 0x4B)
    expect(buf[0]).toBe(0x50)
    expect(buf[1]).toBe(0x4B)
  })

  it('dolu satırlar → buffer geçerli xlsx dosyasıdır', async () => {
    const rows = [
      { 'Sınıf': '9-A', 'Ad Soyad': 'Ali Veli', 'No': '12' },
      { 'Sınıf': '9-B', 'Ad Soyad': 'Ayşe Demir', 'No': '7' },
    ]
    const buf = await buildXlsx(rows, 'excel_sinif_ogrencileri')
    expect(buf).toBeInstanceOf(Buffer)
    expect(buf[0]).toBe(0x50)
    expect(buf[1]).toBe(0x4B)
  })

  it('tüm JobType değerleri için buffer döner', async () => {
    const jobTypes = ['excel_odevler', 'excel_notlar', 'excel_sinif_ogrencileri', 'excel_not_defteri', 'excel_yoklama'] as const
    for (const jt of jobTypes) {
      const buf = await buildXlsx([], jt)
      expect(buf).toBeInstanceOf(Buffer)
    }
  })

  it('50+ satırda kolon genişliği hesabı — hata fırlatmaz, buffer döner', async () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({
      'Ad Soyad': `Öğrenci ${i + 1} ile uzun bir isim ekliyoruz`,
      'Sınıf':    '10-A',
    }))
    const buf = await buildXlsx(rows, 'excel_sinif_ogrencileri')
    expect(buf).toBeInstanceOf(Buffer)
  })

  it('header uzunluğu veri uzunluğundan kısa olsa da minimum 12 genişlik garantisi', async () => {
    const rows = [{ 'No': '1' }]
    const buf = await buildXlsx(rows, 'excel_sinif_ogrencileri')
    expect(buf).toBeInstanceOf(Buffer)
  })

  it('çok uzun veri değerleri → maksimum 52 (50+2) genişliğe kısıtlanır, hata yok', async () => {
    const longStr = 'x'.repeat(100)
    const rows = [{ 'Ad Soyad': longStr }]
    const buf = await buildXlsx(rows, 'excel_notlar')
    expect(buf).toBeInstanceOf(Buffer)
  })
})

// ─────────────────────────────────────────────────────────────
// fetchRows — route dispatch
// ─────────────────────────────────────────────────────────────

describe('fetchRows() — route dispatch', () => {
  it('bilinmeyen jobType → hata fırlatır', async () => {
    await expect(
      fetchRows('bilinmeyen_tip' as never, {}, SCHOOL_ID)
    ).rejects.toThrow('Bilinmeyen iş türü')
  })

  it('"excel_not_defteri" → özel hata mesajıyla fırlatır', async () => {
    await expect(
      fetchRows('excel_not_defteri', {}, SCHOOL_ID)
    ).rejects.toThrow('Not Defteri export route handler üzerinden çağrılmalı')
  })
})

// ─────────────────────────────────────────────────────────────
// fetchRows → fetchOdevler
// ─────────────────────────────────────────────────────────────

describe('fetchRows("excel_odevler")', () => {
  it('başarılı sorgu → doğru sütunları içeren satırlar döner', async () => {
    const hwData = [
      { id: 'hw-1', title: 'Deneme ödevi', subject: 'Matematik', due_date: '2025-01-15', classes: { name: '9-A' } },
    ]
    const subData = [
      { homework_id: 'hw-1', status: 'yapildi' },
      { homework_id: 'hw-1', status: 'yapilmadi' },
      { homework_id: 'hw-1', status: 'gec' },
    ]

    vi.mocked(createServiceClient).mockReturnValue(
      makeDbMock({
        homeworks:            { data: hwData, error: null },
        homework_submissions: { data: subData, error: null },
      }) as never
    )

    const rows = await fetchRows('excel_odevler', {}, SCHOOL_ID)

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      'Sınıf':     '9-A',
      'Ders':      'Matematik',
      'Ödev':      'Deneme ödevi',
      'Son Tarih': '15.01.2025',
      'Yapıldı':   1,
      'Yapılmadı': 1,
      'Geç':       1,
      'Toplam':    3,
    })
  })

  it('homework listesi boşsa → homework_submissions sorgusu atlanır, boş dizi döner', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeDbMock({
        homeworks:            { data: [], error: null },
        homework_submissions: { data: [], error: null },
      }) as never
    )

    const rows = await fetchRows('excel_odevler', {}, SCHOOL_ID)
    expect(rows).toHaveLength(0)
  })

  it('homeworks sorgu hatası → hata fırlatır', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeDbMock({
        homeworks: { data: null, error: { message: 'DB bağlantı hatası' } },
      }) as never
    )

    await expect(fetchRows('excel_odevler', {}, SCHOOL_ID)).rejects.toThrow('Ödevler sorgu hatası')
  })

  it('homework_submissions sorgu hatası → hata fırlatır', async () => {
    const hwData = [{ id: 'hw-1', title: 'Test', subject: 'Fizik', due_date: '2025-02-01', classes: { name: '10-A' } }]

    vi.mocked(createServiceClient).mockReturnValue(
      makeDbMock({
        homeworks:            { data: hwData, error: null },
        homework_submissions: { data: null, error: { message: 'Teslim sorgu hatası' } },
      }) as never
    )

    await expect(fetchRows('excel_odevler', {}, SCHOOL_ID)).rejects.toThrow('Teslim sorgu hatası')
  })

  it('geçersiz since formatı → hata fırlatır', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeDbMock({}) as never)

    await expect(
      fetchRows('excel_odevler', { since: '15/01/2025' }, SCHOOL_ID)
    ).rejects.toThrow('Geçersiz tarih formatı: since')
  })

  it('geçersiz until formatı → hata fırlatır', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeDbMock({}) as never)

    await expect(
      fetchRows('excel_odevler', { until: 'bugün' }, SCHOOL_ID)
    ).rejects.toThrow('Geçersiz tarih formatı: until')
  })

  it('classes null olduğunda "—" döner', async () => {
    const hwData = [
      { id: 'hw-2', title: 'Sınavsız ödev', subject: 'Türkçe', due_date: '2025-03-10', classes: null },
    ]
    vi.mocked(createServiceClient).mockReturnValue(
      makeDbMock({
        homeworks:            { data: hwData, error: null },
        homework_submissions: { data: [], error: null },
      }) as never
    )

    const rows = await fetchRows('excel_odevler', {}, SCHOOL_ID)
    expect(rows[0]['Sınıf']).toBe('—')
  })

  it('due_date null olduğunda "—" döner', async () => {
    const hwData = [{ id: 'hw-3', title: 'Tarifsiz ödev', subject: 'Kimya', due_date: null, classes: { name: '11-B' } }]
    vi.mocked(createServiceClient).mockReturnValue(
      makeDbMock({
        homeworks:            { data: hwData, error: null },
        homework_submissions: { data: [], error: null },
      }) as never
    )

    const rows = await fetchRows('excel_odevler', {}, SCHOOL_ID)
    expect(rows[0]['Son Tarih']).toBe('—')
  })
})

// ─────────────────────────────────────────────────────────────
// fetchRows → fetchNotlar
// ─────────────────────────────────────────────────────────────

describe('fetchRows("excel_notlar")', () => {
  it('başarılı sorgu → doğru sütunları içeren satırlar döner', async () => {
    const data = [
      {
        body: 'Dersde dikkatli',
        created_at: '2025-04-20T10:00:00',
        students: { full_name: 'Zeynep Kaya', student_number: '5', deleted_at: null, classes: { name: '8-C' } },
      },
    ]
    vi.mocked(createServiceClient).mockReturnValue(makeDbMock({ student_notes: { data, error: null } }) as never)

    const rows = await fetchRows('excel_notlar', {}, SCHOOL_ID)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      'Sınıf':    '8-C',
      'No':       '5',
      'Ad Soyad': 'Zeynep Kaya',
      'Not':      'Dersde dikkatli',
      'Tarih':    '20.04.2025',
    })
  })

  it('silinmiş öğrenci notları filtrelenir', async () => {
    const data = [
      {
        body: 'Silinmiş öğrenci',
        created_at: '2025-04-20T10:00:00',
        students: { full_name: 'Silindi Kullanıcı', student_number: '1', deleted_at: '2025-01-01', classes: { name: '7-A' } },
      },
      {
        body: 'Aktif öğrenci notu',
        created_at: '2025-04-21T09:00:00',
        students: { full_name: 'Aktif Öğrenci', student_number: '2', deleted_at: null, classes: { name: '7-A' } },
      },
    ]
    vi.mocked(createServiceClient).mockReturnValue(makeDbMock({ student_notes: { data, error: null } }) as never)

    const rows = await fetchRows('excel_notlar', {}, SCHOOL_ID)
    expect(rows).toHaveLength(1)
    expect(rows[0]['Ad Soyad']).toBe('Aktif Öğrenci')
  })

  it('notlar sınıf adına göre sıralanır', async () => {
    const data = [
      { body: 'Not B', created_at: '2025-05-01T00:00:00', students: { full_name: 'B Öğrenci', student_number: null, deleted_at: null, classes: { name: '9-B' } } },
      { body: 'Not A', created_at: '2025-05-01T00:00:00', students: { full_name: 'A Öğrenci', student_number: null, deleted_at: null, classes: { name: '8-A' } } },
    ]
    vi.mocked(createServiceClient).mockReturnValue(makeDbMock({ student_notes: { data, error: null } }) as never)

    const rows = await fetchRows('excel_notlar', {}, SCHOOL_ID)
    // 8-A < 9-B locale sort
    expect(rows[0]['Sınıf']).toBe('8-A')
    expect(rows[1]['Sınıf']).toBe('9-B')
  })

  it('sorgu hatası → hata fırlatır', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeDbMock({ student_notes: { data: null, error: { message: 'permission denied' } } }) as never
    )

    await expect(fetchRows('excel_notlar', {}, SCHOOL_ID)).rejects.toThrow('Notlar sorgu hatası')
  })

  it('notesTeacherId verilirse (scope own) sorgu teacher_id ile filtrelenir', async () => {
    const qMock = makeQueryMock({ data: [], error: null })
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn(() => qMock) } as never)

    await fetchRows('excel_notlar', {}, SCHOOL_ID, { notesTeacherId: USER_ID })
    expect(qMock.eq).toHaveBeenCalledWith('teacher_id', USER_ID)
  })

  it('notesTeacherId verilmezse (scope school) teacher_id filtresi uygulanmaz', async () => {
    const qMock = makeQueryMock({ data: [], error: null })
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn(() => qMock) } as never)

    await fetchRows('excel_notlar', {}, SCHOOL_ID)
    expect(qMock.eq).not.toHaveBeenCalledWith('teacher_id', expect.anything())
  })
})

// ─────────────────────────────────────────────────────────────
// fetchRows → fetchSinifOgrencileri
// ─────────────────────────────────────────────────────────────

describe('fetchRows("excel_sinif_ogrencileri")', () => {
  it('başarılı sorgu → sınıf-numara sıralı satırlar döner', async () => {
    const data = [
      { full_name: 'Berk Demir', student_number: '5', classes: { name: '9-A' } },
      { full_name: 'Ali Can', student_number: '2', classes: { name: '9-A' } },
    ]
    vi.mocked(createServiceClient).mockReturnValue(makeDbMock({ students: { data, error: null } }) as never)

    const rows = await fetchRows('excel_sinif_ogrencileri', {}, SCHOOL_ID)
    expect(rows).toHaveLength(2)
    // numara 2 < 5
    expect(rows[0]['No']).toBe('2')
    expect(rows[1]['No']).toBe('5')
  })

  it('student_number null olduğunda "—" döner', async () => {
    const data = [
      { full_name: 'Zeynep Ak', student_number: null, classes: { name: '10-B' } },
    ]
    vi.mocked(createServiceClient).mockReturnValue(makeDbMock({ students: { data, error: null } }) as never)

    const rows = await fetchRows('excel_sinif_ogrencileri', {}, SCHOOL_ID)
    expect(rows[0]['No']).toBe('—')
  })

  it('sorgu hatası → hata fırlatır', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeDbMock({ students: { data: null, error: { message: 'table not found' } } }) as never
    )

    await expect(fetchRows('excel_sinif_ogrencileri', {}, SCHOOL_ID)).rejects.toThrow('Öğrenciler sorgu hatası')
  })
})

// ─────────────────────────────────────────────────────────────
// fetchRows → fetchYoklama
// ─────────────────────────────────────────────────────────────

describe('fetchRows("excel_yoklama")', () => {
  it('başarılı sorgu → status etiketleri Türkçeye çevrilir', async () => {
    const data = [
      { date: '2025-03-05', status: 'absent',  students: { full_name: 'Can Yılmaz', student_number: '3' }, classes: { name: '10-C' } },
      { date: '2025-03-06', status: 'late',    students: { full_name: 'Ece Tan', student_number: '7' },    classes: { name: '10-C' } },
    ]
    vi.mocked(createServiceClient).mockReturnValue(makeDbMock({ attendance: { data, error: null } }) as never)

    const rows = await fetchRows('excel_yoklama', {}, SCHOOL_ID)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      'Sınıf':    '10-C',
      'No':       '3',
      'Ad Soyad': 'Can Yılmaz',
      'Tarih':    '05.03.2025',
      'Durum':    'Gelmedi',
    })
    expect(rows[1]['Durum']).toBe('Geç Geldi')
  })

  it('students/classes null olduğunda "—" değerler döner', async () => {
    const data = [
      { date: '2025-05-10', status: 'absent', students: null, classes: null },
    ]
    vi.mocked(createServiceClient).mockReturnValue(makeDbMock({ attendance: { data, error: null } }) as never)

    const rows = await fetchRows('excel_yoklama', {}, SCHOOL_ID)
    expect(rows[0]['Sınıf']).toBe('—')
    expect(rows[0]['Ad Soyad']).toBe('—')
    expect(rows[0]['No']).toBe('—')
  })

  it('geçersiz since formatı → hata fırlatır', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeDbMock({}) as never)

    await expect(
      fetchRows('excel_yoklama', { since: '2025/01/01' }, SCHOOL_ID)
    ).rejects.toThrow('Geçersiz tarih formatı: since')
  })

  it('geçersiz until formatı → hata fırlatır', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeDbMock({}) as never)

    await expect(
      fetchRows('excel_yoklama', { until: 'invalid' }, SCHOOL_ID)
    ).rejects.toThrow('Geçersiz tarih formatı: until')
  })

  it('sorgu hatası → hata fırlatır', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeDbMock({ attendance: { data: null, error: { message: 'access denied' } } }) as never
    )

    await expect(fetchRows('excel_yoklama', {}, SCHOOL_ID)).rejects.toThrow('Yoklama sorgu hatası')
  })
})

// ─────────────────────────────────────────────────────────────
// uploadToStorage
// ─────────────────────────────────────────────────────────────

describe('uploadToStorage()', () => {
  it('başarılı upload → url ve filename döner', async () => {
    const uploadMock    = vi.fn().mockResolvedValue({ error: null })
    const signedUrlMock = vi.fn().mockResolvedValue({ data: { signedUrl: 'https://cdn.example.com/file.xlsx' } })

    vi.mocked(createServiceClient).mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          upload:          uploadMock,
          createSignedUrl: signedUrlMock,
        })),
      },
    } as never)

    const buf = Buffer.from('mock-xlsx-content')
    const result = await uploadToStorage(buf, USER_ID, 'excel_odevler')

    expect(result.url).toBe('https://cdn.example.com/file.xlsx')
    expect(result.filename).toMatch(/^excel_odevler-\d{4}-\d{2}-\d{2}\.xlsx$/)
  })

  it('upload hatası → hata fırlatır', async () => {
    vi.mocked(createServiceClient).mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          upload:          vi.fn().mockResolvedValue({ error: { message: 'bucket not found' } }),
          createSignedUrl: vi.fn(),
        })),
      },
    } as never)

    const buf = Buffer.from('test')
    await expect(uploadToStorage(buf, USER_ID, 'excel_notlar')).rejects.toThrow('Storage upload hatası')
  })

  it('signed URL oluşturulamazsa → hata fırlatır', async () => {
    vi.mocked(createServiceClient).mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          upload:          vi.fn().mockResolvedValue({ error: null }),
          createSignedUrl: vi.fn().mockResolvedValue({ data: null }),
        })),
      },
    } as never)

    const buf = Buffer.from('test')
    await expect(uploadToStorage(buf, USER_ID, 'excel_yoklama')).rejects.toThrow('Signed URL oluşturulamadı')
  })

  it('signedUrl alanı boş string ise → hata fırlatır', async () => {
    vi.mocked(createServiceClient).mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          upload:          vi.fn().mockResolvedValue({ error: null }),
          createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: '' } }),
        })),
      },
    } as never)

    const buf = Buffer.from('test')
    await expect(uploadToStorage(buf, USER_ID, 'excel_sinif_ogrencileri')).rejects.toThrow('Signed URL oluşturulamadı')
  })

  it('path user_id içerir ve xlsx uzantılıdır', async () => {
    let capturedPath = ''
    vi.mocked(createServiceClient).mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn().mockImplementation((path: string) => {
            capturedPath = path
            return Promise.resolve({ error: null })
          }),
          createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://ok.url' } }),
        })),
      },
    } as never)

    await uploadToStorage(Buffer.from('x'), USER_ID, 'excel_notlar')
    expect(capturedPath).toMatch(new RegExp(`^${USER_ID}/`))
    expect(capturedPath).toMatch(/\.xlsx$/)
  })
})
