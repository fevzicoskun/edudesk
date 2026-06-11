// Excel'den toplu öğrenci içe aktarma — saf parse katmanı.
// e-Okul sınıf listesi çıktıları hedef format: rapor başlığı satırları,
// esnek sütun başlıkları ("Adı Soyadı" / "Ad Soyad" / "Okul No" / "Numara" ...)
// ve ayrı "Adı" + "Soyadı" sütunları desteklenir.

export type ParsedStudent = { full_name: string; student_number: string | null }
export type ImportRowError = { row: number; message: string }
export type StudentImportResult = { students: ParsedStudent[]; errors: ImportRowError[] }

/** Başlık araması yapılan maksimum satır sayısı (e-Okul rapor başlıkları için tolerans). */
const HEADER_SCAN_LIMIT = 10

// Normalize edilmiş başlık anahtarları (küçük harf, Türkçe karakterler ASCII'ye indirgenmiş,
// boşluk/noktalama atılmış). Tam eşleşme aranır — "Notu" gibi sütunlar "No" ile karışmaz.
const FULL_NAME_KEYS  = new Set(['adisoyadi', 'adsoyad', 'adisoyad', 'adsoyadi', 'ogrenciadisoyadi', 'ogrencininadisoyadi', 'isimsoyisim'])
const FIRST_NAME_KEYS = new Set(['adi', 'ad', 'isim', 'ogrenciadi'])
const LAST_NAME_KEYS  = new Set(['soyadi', 'soyad', 'soyisim', 'ogrencisoyadi'])
const NUMBER_KEYS     = new Set(['ogrencino', 'okulno', 'numara', 'no', 'okulnumarasi', 'ogrencinumarasi', 'ogrno', 'numarasi'])

const TR_MAP: Record<string, string> = {
  ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', İ: 'i',
  ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u',
}

/** Başlık hücresini karşılaştırma anahtarına çevirir: "ÖĞRENCİ NO " → "ogrencino" */
function normalizeHeader(cell: string): string {
  return cell
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (ch) => TR_MAP[ch] ?? ch)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

type HeaderInfo = {
  rowIndex: number
  fullNameCol: number
  firstNameCol: number
  lastNameCol: number
  numberCol: number
}

function detectHeader(rows: string[][]): HeaderInfo | null {
  const limit = Math.min(rows.length, HEADER_SCAN_LIMIT)
  for (let i = 0; i < limit; i++) {
    const keys = (rows[i] ?? []).map(normalizeHeader)
    const fullNameCol  = keys.findIndex((k) => FULL_NAME_KEYS.has(k))
    const firstNameCol = keys.findIndex((k) => FIRST_NAME_KEYS.has(k))
    const lastNameCol  = keys.findIndex((k) => LAST_NAME_KEYS.has(k))
    const numberCol    = keys.findIndex((k) => NUMBER_KEYS.has(k))

    if (fullNameCol !== -1 || firstNameCol !== -1) {
      return { rowIndex: i, fullNameCol, firstNameCol, lastNameCol, numberCol }
    }
  }
  return null
}

/** Fazla boşlukları tekilleştirip kırpar. */
function cleanName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

/**
 * Satır dizisini (ilk sayfanın hücre metinleri) öğrenci listesine çevirir.
 * Satır numaraları Excel'deki gibi 1 tabanlıdır (dizin + 1).
 */
export function parseStudentRows(rows: string[][]): StudentImportResult {
  const header = detectHeader(rows)
  if (!header) {
    return {
      students: [],
      errors: [{
        row: 1,
        message: "Başlık satırı bulunamadı. Dosyada 'Adı Soyadı' (veya 'Adı' + 'Soyadı') ve 'Okul No' gibi sütun başlıkları olmalı.",
      }],
    }
  }

  const students: ParsedStudent[] = []
  const errors: ImportRowError[] = []

  for (let i = header.rowIndex + 1; i < rows.length; i++) {
    const cells = rows[i] ?? []
    const excelRow = i + 1

    // Tamamen boş satırlar sessizce atlanır
    if (cells.every((c) => !c || !c.trim())) continue

    let fullName: string
    if (header.fullNameCol !== -1) {
      fullName = cleanName(cells[header.fullNameCol] ?? '')
    } else {
      const first = cleanName(cells[header.firstNameCol] ?? '')
      const last  = header.lastNameCol !== -1 ? cleanName(cells[header.lastNameCol] ?? '') : ''
      fullName = cleanName(`${first} ${last}`)
    }

    if (!fullName) {
      errors.push({ row: excelRow, message: 'Ad soyad boş. Lütfen bu satırı kontrol et.' })
      continue
    }
    if (fullName.length < 2) {
      errors.push({ row: excelRow, message: 'Ad soyad en az 2 karakter olmalı.' })
      continue
    }

    const rawNumber = header.numberCol !== -1 ? (cells[header.numberCol] ?? '').trim() : ''
    students.push({ full_name: fullName, student_number: rawNumber || null })
  }

  return { students, errors }
}

/**
 * ExcelJS hücre değerini düz metne çevirir (richText, hyperlink, formül vb.).
 * Saf yardımcı — server action exceljs satırlarını string[][]'e indirgerken kullanır.
 */
export function excelCellToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    const v = value as { richText?: { text: string }[]; text?: unknown; result?: unknown }
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text ?? '').join('')
    if (v.text !== undefined) return excelCellToString(v.text)
    if (v.result !== undefined) return excelCellToString(v.result)
  }
  return String(value)
}
