import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
const require = createRequire('C:/Users/mehme/edudesk/package.json')
const { chromium } = require('playwright')
const [, , girdi, cikti, png] = process.argv
const b = await chromium.launch()
const p = await b.newPage()
await p.goto(pathToFileURL(girdi).href, { waitUntil: 'networkidle' })
await p.evaluate(() => document.fonts.ready)
await p.pdf({ path: cikti, format: 'A4', printBackground: true, preferCSSPageSize: true })
if (png) { await p.setViewportSize({ width: 794, height: 1123 }); await p.screenshot({ path: png, fullPage: true }) }
await b.close()
