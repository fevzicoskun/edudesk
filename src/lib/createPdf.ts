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

/** Her sayfaya çapraz, soluk okul adı (en son çağrılır: tablo zeminlerinin üstünde, yarı saydam). */
export async function filigranEkle(doc: InstanceType<typeof JsPDF>, metin: string | null | undefined): Promise<void> {
  if (!metin) return
  const { GState } = await import('jspdf')
  const aci = 35
  const rad = (aci * Math.PI) / 180
  for (let i = 1; i <= doc.getNumberOfPages(); i++) {
    doc.setPage(i)
    const w = doc.internal.pageSize.getWidth()
    const h = doc.internal.pageSize.getHeight()
    doc.saveGraphicsState()
    doc.setGState(new GState({ opacity: 0.07 }))
    doc.setFontSize(54)
    doc.setTextColor(0, 0, 0)
    // Döndürülmüş yazının ortası sayfa ortasına gelsin (align:center açıyla güvenilir değil)
    const yari = doc.getTextWidth(metin) / 2
    doc.text(metin, w / 2 - Math.cos(rad) * yari, h / 2 + Math.sin(rad) * yari, { angle: aci })
    doc.restoreGraphicsState()
  }
}
