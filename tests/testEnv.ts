import fs from 'fs'
import dotenv from 'dotenv'

/**
 * Test ortamı: .env.local + (doluysa) .env.test. .env.test'te service anahtarı varsa Supabase
 * değerleri test projesine (edudesk-test) döner → e2e/integration canlı veritabanına yazmaz.
 * Playwright webServer bu process.env'i miras alır; Next dosyadaki değerle EZMEZ.
 */
dotenv.config({ path: '.env.local', quiet: true })
if (fs.existsSync('.env.test')) {
  const t = dotenv.parse(fs.readFileSync('.env.test'))
  if (t.SUPABASE_SERVICE_ROLE_KEY) Object.assign(process.env, t)
}

export const testProjesi = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('ozllydtpgixzgwuegbnd') ?? false
