// app/api/ders-programi/gorsel/route.tsx
import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getCurrentProfile } from '@/src/shared/auth'
import { isTeachingRole } from '@/src/shared/types'
import { ScheduleService } from '@/src/domains/schedule/services/ScheduleService'
import { ProgramGorseli, GENISLIK, gorunenSaatler, programGorselYuksekligi } from '@/src/domains/schedule/programGorseli'
import { logger } from '@/src/infrastructure/observability/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BASLIKLAR = { 'Cache-Control': 'private, no-store' }
const font = (ad: string) => readFile(path.join(process.cwd(), 'assets/fonts', ad))
// Okul logosu filigranı — bülten görselleriyle aynı dosya ve opaklık (app/api/bulten/gorsel)
const FILIGRAN_G = 540, FILIGRAN_Y = Math.round(540 * 382 / 402)
const filigran = () => readFile(path.join(process.cwd(), 'public/filigran.png')).then(b => `data:image/png;base64,${b.toString('base64')}`)

/** Oturumdaki öğretmenin kendi ders programı (başka kimse için parametre yok). */
export async function GET() {
  const profile = await getCurrentProfile()
  if (!profile?.school_id) return Response.json({ error: 'Giriş gerekli' }, { status: 401 })
  if (!isTeachingRole(profile.role)) return Response.json({ error: 'Yetki yok' }, { status: 403 })

  try {
    const { periods, slots, classes } = await ScheduleService.getMySchedule()
    if (slots.length === 0) return Response.json({ error: 'Program boş' }, { status: 404 })
    const saatler = gorunenSaatler(periods, slots)
    const height = programGorselYuksekligi(saatler.length)
    const [normal, kalin, logo] = await Promise.all([font('BricolageGrotesque-Regular.ttf'), font('BricolageGrotesque-ExtraBold.ttf'), filigran()])
    const el = (
      <div style={{ display: 'flex', position: 'relative', width: '100%', height: '100%' }}>
        <ProgramGorseli
          ad={profile.full_name ?? ''}
          brans={profile.subject ?? ''}
          okul={profile.schools?.name ?? ''}
          periods={saatler}
          slots={slots}
          sinifAdi={new Map(classes.map(c => [c.id, c.name]))}
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori yalnız <img> çizer */}
        <img src={logo} width={FILIGRAN_G} height={FILIGRAN_Y} alt=""
          style={{ position: 'absolute', left: (GENISLIK - FILIGRAN_G) / 2, top: (height - FILIGRAN_Y) / 2, opacity: 0.06 }} />
      </div>
    )
    // Tamamen okunur ki çizim hatası da catch'e düşsün (200 + kopuk gövde olmasın)
    const png = await new ImageResponse(el, {
      width: GENISLIK, height,
      fonts: [{ name: 'Bricolage', data: normal, weight: 400, style: 'normal' }, { name: 'Bricolage', data: kalin, weight: 800, style: 'normal' }],
    }).arrayBuffer()
    return new Response(png, { headers: { 'Content-Type': 'image/png', ...BASLIKLAR } })
  } catch (e) {
    logger.error({ event: 'ders_programi_gorsel_hatasi', err: e instanceof Error ? e.message : String(e) }, 'Ders programı görseli üretilemedi')
    return Response.json({ error: 'Görsel oluşturulamadı' }, { status: 500 })
  }
}
