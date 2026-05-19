'use client'

import type JsPDF from 'jspdf'

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
  options?: { orientation?: string; unit?: string; format?: string | number[] },
): Promise<PdfDoc> {
  const { default: JsPDF } = await import('jspdf')

  // Served from /public/fonts — same origin, no CORS, cached by browser
  if (!regularB64) regularB64 = await toBase64('/fonts/Roboto-Regular.ttf')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = new JsPDF(options as any) as PdfDoc

  doc.addFileToVFS('Roboto-Regular.ttf', regularB64)
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'bold')
  doc.setFont('Roboto', 'normal')

  return doc
}
