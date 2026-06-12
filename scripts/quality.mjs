#!/usr/bin/env node
/**
 * Cross-platform kalite kontrolü — bash gerektirmez.
 * Çalıştır: npm run quality
 */
import { readdirSync, readFileSync } from 'fs'
import { join, extname } from 'path'
import { spawnSync } from 'child_process'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')

const SKIP = ['node_modules', '.next', '.git', 'dist', 'coverage']
const SKIP_FILE = ['test', 'spec', 'database.types']
const EXTS = new Set(['.ts', '.tsx'])

/** Dizini özyinelemeli tarar, filtreli dosya listesi döner */
function walkFiles(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.includes(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      walkFiles(full, files)
    } else if (EXTS.has(extname(entry.name))) {
      if (!SKIP_FILE.some(s => entry.name.includes(s))) files.push(full)
    }
  }
  return files
}

const CAST_RE = /as unknown as|as any\b|: any\b|<any>/g

function countCasts(files) {
  let total = 0
  for (const f of files) {
    const src = readFileSync(f, 'utf8')
    const m = src.match(CAST_RE)
    if (m) total += m.length
  }
  return total
}

function findLargeFiles(files, threshold = 300) {
  const results = []
  for (const f of files) {
    const lines = readFileSync(f, 'utf8').split('\n').length
    if (lines > threshold) results.push({ file: f.replace(ROOT, ''), lines })
  }
  return results.sort((a, b) => b.lines - a.lines)
}

// ── Tarama ───────────────────────────────────────────────────────────────────
const srcFiles = walkFiles(join(ROOT, 'src'))
const appFiles = walkFiles(join(ROOT, 'app'))
const allFiles = [...srcFiles, ...appFiles]

// 1. TypeScript unsafe cast'ler
const casts = countCasts(allFiles)
console.log(`\n=== TypeScript Unsafe Cast'ler ===`)
console.log(`Toplam: ${casts}  (hedef ≤ 6 → 10 puan)`)

// 2. 300+ satır dosyalar
const large = findLargeFiles(allFiles)
console.log(`\n=== 300+ Satır Dosyalar (${large.length} adet) ===`)
if (large.length === 0) {
  console.log('Yok ✓')
} else {
  for (const { file, lines } of large) console.log(`  ${lines.toString().padStart(4)}  ${file}`)
}

// 3. Unit testler
console.log(`\n=== Unit Testler ===`)
// Windows'ta npm.cmd bir shell script; cmd.exe /c ile shell:true gerekmeden çalışır.
const [testCmd, testArgs] = process.platform === 'win32'
  ? ['cmd.exe', ['/c', 'npm', 'run', 'test:unit']]
  : ['npm',     ['run', 'test:unit']]
const result = spawnSync(testCmd, testArgs, { cwd: ROOT, encoding: 'utf8' })
const out = (result.stdout ?? '') + (result.stderr ?? '')
const match = out.match(/Tests\s+(\d+[^\n]*)/)
if (result.status === 0) {
  console.log(match ? match[1].trim() : 'Geçti ✓')
} else {
  console.log(`HATA: ${match ? match[1].trim() : 'testler başarısız'}`)
  process.exitCode = 1
}

console.log()
