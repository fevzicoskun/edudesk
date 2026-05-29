import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/src/infrastructure/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // next parametresinin dışarıya redirect açmaması için doğrula:
      // yalnızca tek / ile başlayan, // veya /\ içermeyen, : barındırmayan path'lere izin ver
      const rawNext = searchParams.get('next') ?? '/anasayfa'
      const safeNext =
        rawNext.startsWith('/') &&
        !rawNext.startsWith('//') &&
        !rawNext.startsWith('/\\') &&
        !rawNext.includes(':')
          ? rawNext
          : '/anasayfa'
      return NextResponse.redirect(new URL(safeNext, origin))
    }
  }

  return NextResponse.redirect(`${origin}/login?error=gecersiz-baglanti`)
}
