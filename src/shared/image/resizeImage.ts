export interface CropBox { sx: number; sy: number; size: number }

// Merkezden en büyük kareyi al (yatay/dikey görseli kare avatara kırpar). Saf matematik → test edilebilir.
export function computeSquareCrop(width: number, height: number): CropBox {
  const size = Math.min(width, height)
  return { sx: Math.floor((width - size) / 2), sy: Math.floor((height - size) / 2), size }
}

const OUTPUT = 256

// Tarayıcıda: görsel Blob → 256² webp (merkez-kare kırpma + downscale). Sadece client'ta çağrılır.
export async function resizeImage(file: Blob, output = OUTPUT): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const { sx, sy, size } = computeSquareCrop(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = output
  canvas.height = output
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas desteklenmiyor')
  ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, output, output)
  bitmap.close?.()
  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/webp', 0.85))
  if (!blob) throw new Error('Görüntü dönüştürülemedi')
  return blob
}
