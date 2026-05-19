'use client'

import type JsPDF from 'jspdf'

export type PdfDoc = InstanceType<typeof JsPDF> & { lastAutoTable?: { finalY?: number } }

const CDN = 'https://cdn.jsdelivr.net/npm/roboto-fontface@0.10.0/fonts/roboto'

let regularB64: string | null = null
let mediumB64:  string | null = null

async function toBase64(url: string): Promise<string> {
  const res = await fetch(url)
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

  // Load once, cache for session — each fetch is ~170 KB
  if (!regularB64) regularB64 = await toBase64(`${CDN}/Roboto-Regular.ttf`)
  if (!mediumB64)  mediumB64  = await toBase64(`${CDN}/Roboto-Medium.ttf`)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = new JsPDF(options as any) as PdfDoc

  doc.addFileToVFS('Roboto-Regular.ttf', regularB64)
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')

  doc.addFileToVFS('Roboto-Medium.ttf', mediumB64)
  doc.addFont('Roboto-Medium.ttf', 'Roboto', 'bold')

  doc.setFont('Roboto', 'normal')

  return doc
}
