// app/api/bulten/gorsel/route.tsx
import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { getAbility } from '@/src/shared/authorization/server'
import { P } from '@/src/shared/permissions'
import { BultenService } from '@/src/domains/mentor/services/BultenService'
import { pazartesiMi } from '@/src/domains/mentor/lib/bultenMath'
import { OdevlerGorseli, OzetGorseli, OgrenciGorseli, gorselYuksekligi } from '@/src/domains/mentor/lib/bultenGorselleri'
import { logger } from '@/src/infrastructure/observability/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const hafta = z.string().refine(pazartesiMi)
const Sorgu = z.discriminatedUnion('tur', [
  z.object({ tur: z.enum(['odevler', 'ozet']), hafta, sinif: z.string().uuid() }),
  z.object({ tur: z.literal('ogrenci'), hafta, ogrenci: z.string().uuid() }),
])
const BASLIKLAR = { 'Cache-Control': 'private, no-store' }
const font = (ad: string) => readFile(path.join(process.cwd(), 'assets/fonts', ad))

export async function GET(req: Request) {
  const ability = await getAbility()
  if (!ability) return Response.json({ error: 'Giriş gerekli' }, { status: 401 })
  if (ability.cannot(P.HOMEWORK.READ)) return Response.json({ error: 'Yetki yok' }, { status: 403 })
  const q = Sorgu.safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!q.success) return Response.json({ error: 'Geçersiz parametre' }, { status: 400 })

  try {
    const bulten = await BultenService.getBulten(q.data.hafta)
    let el: React.ReactElement, height: number
    if (q.data.tur === 'ogrenci') {
      const ogrenciId = q.data.ogrenci
      const ogrenci = bulten.ogrenciler.find(o => o.student_id === ogrenciId)
      if (!ogrenci) return Response.json({ error: 'Yetki yok' }, { status: 403 })
      const sinif = bulten.siniflar.find(s => s.class_id === ogrenci.class_id)!
      const dolu = sinif.gunler.filter(g => g.odevler.length)
      el = <OgrenciGorseli ogrenci={ogrenci} sinif={sinif} bulten={bulten} />
      height = gorselYuksekligi('ogrenci', { eksik: ogrenci.eksikler.length, gunler: dolu.map(g => g.odevler.length) })
    } else {
      const sinifId = q.data.sinif
      const sinif = bulten.siniflar.find(s => s.class_id === sinifId)
      if (!sinif) return Response.json({ error: 'Yetki yok' }, { status: 403 })
      el = q.data.tur === 'odevler' ? <OdevlerGorseli sinif={sinif} bulten={bulten} /> : <OzetGorseli sinif={sinif} bulten={bulten} />
      height = q.data.tur === 'odevler'
        ? gorselYuksekligi('odevler', { gunler: sinif.gunler.map(g => g.odevler.length) })
        : gorselYuksekligi('ozet', { ozet: sinif.ozet.length })
    }
    const [normal, kalin] = await Promise.all([font('BricolageGrotesque-Regular.ttf'), font('BricolageGrotesque-ExtraBold.ttf')])
    // ImageResponse çizimi akış içinde yapar; burada tamamen okunur ki çizim hatası da catch'e düşsün (200 + kopuk gövde olmasın)
    const png = await new ImageResponse(el, {
      width: 1080, height,
      fonts: [{ name: 'Bricolage', data: normal, weight: 400, style: 'normal' }, { name: 'Bricolage', data: kalin, weight: 800, style: 'normal' }],
    }).arrayBuffer()
    return new Response(png, { headers: { 'Content-Type': 'image/png', ...BASLIKLAR } })
  } catch (e) {
    logger.error({ event: 'bulten_gorsel_hatasi', err: e instanceof Error ? e.message : String(e) }, 'Bülten görseli üretilemedi')
    return Response.json({ error: 'Görsel oluşturulamadı' }, { status: 500 })
  }
}
