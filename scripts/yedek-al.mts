// Elle yedek: `npm run yedek`
// Gece yedeğiyle aynı içeriği (yedekTopla) alır; 1) bu bilgisayara yazar (Supabase dışı kopya),
// 2) Storage'daki 'yedekler' kovasına da koyar. Varsayılan klasör C:\Users\<kullanıcı>\EduDesk-Yedekler
// (repo DIŞI — öğrenci/veli verisi git'e girmesin). Klasör: YEDEK_KLASORU ortam değişkeni.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { yedekTopla } from '../src/domains/notifications/yedekTopla'
import { yedekDosyaAdi } from '../src/domains/notifications/yedekMath'

for (const satir of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = satir.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, '')
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anahtar = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !anahtar) throw new Error('.env.local içinde NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY yok')

const db = createClient(url, anahtar, { auth: { persistSession: false } })
const { simdi, basarisiz, satirlar, govde } = await yedekTopla(db)

const klasor = process.env.YEDEK_KLASORU ?? path.join(os.homedir(), 'EduDesk-Yedekler')
fs.mkdirSync(klasor, { recursive: true })
// yerel dosya saatli: aynı gün birden çok elle yedek birbirini ezmesin
const yerel = path.join(klasor, yedekDosyaAdi(simdi).replace('-yedek.json', `-${simdi.toISOString().slice(11, 16).replace(':', '')}-yedek.json`))
fs.writeFileSync(yerel, govde)

const { error } = await db.storage.from('yedekler').upload(yedekDosyaAdi(simdi), govde, { contentType: 'application/json', upsert: true })

console.log(`Yerel yedek: ${yerel} (${(govde.length / 1024).toFixed(0)} KB)`)
console.log(error ? `UYARI: Storage'a yüklenemedi: ${error.message}` : `Storage: yedekler/${yedekDosyaAdi(simdi)}`)
console.log('Satırlar:', JSON.stringify(satirlar))
if (basarisiz.length) { console.error('EKSİK TABLOLAR:', basarisiz.join(', ')); process.exit(1) }
