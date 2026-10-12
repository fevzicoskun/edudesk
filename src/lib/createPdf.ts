'use client'

import type JsPDF from 'jspdf'
import type { jsPDFOptions } from 'jspdf'

export type PdfDoc = InstanceType<typeof JsPDF> & { lastAutoTable?: { finalY?: number } }

let regularB64: string | null = null

async function toBase64(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Font yüklenemedi: ${url} (${res.status})`)
  const buf = await res.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

export async function createDoc(
  options?: jsPDFOptions,
): Promise<PdfDoc> {
  const { default: JsPDF } = await import('jspdf')

  // Served from /public/fonts — same origin, no CORS, cached by browser
  if (!regularB64) regularB64 = await toBase64('/fonts/Roboto-Regular.ttf')

  const doc = new JsPDF(options) as PdfDoc

  doc.addFileToVFS('Roboto-Regular.ttf', regularB64)
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'bold')
  doc.setFont('Roboto', 'normal')

  return doc
}

let filigranB64: string | null = null

/** Her sayfanın ortasına soluk okul logosu (en son çağrılır: tablo zeminlerinin üstünde, yarı saydam).
 *  Opaklık yazdırılan sayfalarla aynı (globals.css .filigran). Logo yüklenemezse PDF filigransız iner. */
export async function filigranEkle(doc: InstanceType<typeof JsPDF>): Promise<void> {
  try {
    if (!filigranB64) filigranB64 = await toBase64('/filigran.png')
  } catch {
    return
  }
  const { GState } = await import('jspdf')
  const { width: iw, height: ih } = doc.getImageProperties(filigranB64)
  for (let i = 1; i <= doc.getNumberOfPages(); i++) {
    doc.setPage(i)
    const w = doc.internal.pageSize.getWidth()
    const h = doc.internal.pageSize.getHeight()
    const gen = Math.min(w, h) * 0.5
    const yuk = gen * (ih / iw)
    doc.saveGraphicsState()
    doc.setGState(new GState({ opacity: 0.06 }))
    doc.addImage(filigranB64, 'PNG', (w - gen) / 2, (h - yuk) / 2, gen, yuk, 'filigran')
    doc.restoreGraphicsState()
  }
}
