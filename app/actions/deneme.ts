// app/actions/deneme.ts
'use server'

import { revalidatePath } from 'next/cache'
import { UUID, excelImportFileSchema } from '@/src/shared/validation'
import { excelCellToString } from '@/src/domains/classes/services/studentImportParser'
import { logger } from '@/src/infrastructure/observability/logger'
import { DenemeService, type Onizleme } from '@/src/domains/mentor/deneme/DenemeService'
import { KAPALI } from '@/src/domains/mentor/deneme/denemeSema'
import { TakipService } from '@/src/domains/mentor/services/TakipService'

/** Stoys Excel'i → önizleme. Hiçbir şey yazmaz. */
export async function denemeOnizle(formData: FormData): Promise<{ error: string } | Onizleme> {
  // Kapı Excel okunmadan önce: kapalı kullanıcı dosya ayrıştırtamasın (servis yine ayrıca denetler)
  if (!(await TakipService.acikMi())) return { error: KAPALI }
  const dosya = excelImportFileSchema.safeParse(formData.get('file'))
  if (!dosya.success) return { error: dosya.error.issues[0]?.message ?? 'Geçersiz dosya' }
  // exceljs lazy-load — bundle'a girmesin (classes.ts ile aynı kalıp)
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(await dosya.data.arrayBuffer())
  } catch {
    return { error: 'Excel dosyası okunamadı. Dosyanın bozuk olmadığından emin ol.' }
  }
  const sayfa = wb.worksheets[0]
  if (!sayfa) return { error: 'Excel dosyasında sayfa bulunamadı.' }
  const rows: string[][] = []
  sayfa.eachRow({ includeEmpty: true }, (row, n) => {
    const v = row.values as unknown[] // exceljs: 1 tabanlı sparse dizi
    const hucreler: string[] = []
    for (let c = 1; c < v.length; c++) hucreler.push(excelCellToString(v[c]))
    rows[n - 1] = hucreler
  })
  return DenemeService.onizle(Array.from(rows, r => r ?? []))
}

export async function denemeKaydet(girdi: unknown): Promise<{ error?: string; kaydedilen?: number }> {
  try {
    const r = await DenemeService.kaydet(girdi)
    if (!r.error) revalidatePath('/mentorluk/denemeler')
    return r
  } catch (e) {
    logger.error({ err: e instanceof Error ? e.message : String(e) }, 'denemeKaydet başarısız')
    return { error: 'Deneme kaydedilemedi. Lütfen tekrar dene.' }
  }
}

export async function denemeSil(sinavId: string, sinifId: string): Promise<{ error?: string }> {
  if (!UUID.safeParse(sinavId).success || !UUID.safeParse(sinifId).success) return { error: 'Geçersiz ID' }
  try {
    const r = await DenemeService.sil(sinavId, sinifId)
    if (!r.error) revalidatePath('/mentorluk/denemeler')
    return r
  } catch (e) {
    logger.error({ err: e instanceof Error ? e.message : String(e) }, 'denemeSil başarısız')
    return { error: 'Silinemedi. Lütfen tekrar dene.' }
  }
}
