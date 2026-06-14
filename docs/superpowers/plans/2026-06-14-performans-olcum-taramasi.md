# Performans Ölçüm Taraması — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Güncel EduDesk kod tabanını ve canlı siteyi üç katmanda ölçüp, dosya-doğru ve önceliklendirilmiş taze bir `docs/performance-report.md` üretmek (düzeltme yapılmaz).

**Architecture:** Ölçüm-önce yaklaşım. Üç bağımsız katman — (1) DB: Supabase advisors + `EXPLAIN ANALYZE` + index envanteri, (2) Sunucu: güncel Server Component'lerin statik sorgu denetimi, (3) İstemci: Chrome DevTools Lighthouse (public canlı + authenticated yerel dev). Her katman kendi bulgularını rapora ekler; son task'ta sentez + baseline tablosu yazılır.

**Tech Stack:** Next.js 16 App Router, Supabase (PostgreSQL/RLS), Supabase MCP, Chrome DevTools MCP, Playwright test-seed (authenticated ölçüm için), grep/statik analiz.

> **Not (bu plan kod değil ölçüm üretir):** Klasik TDD (failing test → implement) burada uygulanmaz; "test" yerine her task somut ölçüm komutu/araç çağrısı çalıştırıp **kanıtı** rapora yazar. Bite-sized adımlar ve sık commit korunur. Spec: `docs/superpowers/specs/2026-06-14-performans-olcum-taramasi-design.md`.

---

## Sıcak Rota Dosya Envanteri (denetim hedefleri)

- **anasayfa:** `app/(dashboard)/anasayfa/page.tsx` + widget'lar: `OgretmenDashboard.tsx`, `OdevCockpit.tsx`, `OdevTamamlanmaWidget.tsx`, `OdevTamamlanmaChart.tsx`, `BugunYapilacaklarWidget.tsx`, `MudurOgretmenAktivite.tsx`, `MYSolSutunWidget.tsx`, `MYStatsWidget.tsx`, `RiskUyarilariWidget.tsx`, `HizliAksiyonlar.tsx`
- **odevler:** `app/(dashboard)/odevler/page.tsx`, `app/(dashboard)/odevler/sinif/[classId]/page.tsx` (+ `matris/`)
- **yoklama:** `app/(dashboard)/yoklama/page.tsx`, `app/(dashboard)/yoklama/cizelge/page.tsx`
- **rapor:** `app/(dashboard)/rapor/devamsizlik/page.tsx`, `app/(dashboard)/rapor/ogretmen-aktivite/page.tsx`
- **platform:** `app/platform/page.tsx`, `app/platform/actions.ts`

---

## Task 1: Rapor iskeleti + eski raporu superseded işaretle

**Files:**
- Modify: `docs/performance-report.md` (baştan yazılır)

- [ ] **Step 1: Eski raporun ilk satırlarını yedek olarak oku**

Run: `head -6 docs/performance-report.md`
Expected: 2026-05-19 tarihli eski başlık görünür (referans için).

- [ ] **Step 2: Yeni rapor iskeletini yaz**

`docs/performance-report.md` içeriğini şu iskeletle değiştir (bölümler sonraki task'larda doldurulacak):

```markdown
# Performans Analiz Raporu

**Analiz tarihi:** 2026-06-14
**Kapsam:** anasayfa (rol bazlı), odevler, odevler/sinif/[classId], yoklama, yoklama/cizelge, rapor/devamsizlik, rapor/ogretmen-aktivite, platform
**Yöntem:** Supabase MCP (advisors + EXPLAIN ANALYZE), Chrome DevTools Lighthouse, statik sorgu denetimi
**Supabase proje ID:** agijvfrcudpzsofgfogu

> ⚠️ Bu rapor 2026-05-19 tarihli önceki raporun yerini alır. Eski rapor **superseded**:
> referans verdiği tüm dosyalar (DersProgramiWidget, MudurDashboard, MudurYardimcisiDashboard,
> MentorSinifimWidget, raporlar/mentor, raporlar/ogrenci, src/shared/perf) sonraki
> refactor'larda silinmişti ve önerileri uygulanamıyordu.

---

## 1. Veritabanı Katmanı
_(Task 2)_

## 2. Sunucu Sorgu Denetimi
_(Task 3)_

## 3. İstemci (Lighthouse)
_(Task 4)_

## 4. Önceliklendirilmiş Aksiyon Listesi
_(Task 5)_

## 5. Baseline Metrikler
_(Task 5)_

## 6. Yeniden Ölçüm Yönergesi
_(Task 5)_
```

- [ ] **Step 3: Commit**

```bash
git add docs/performance-report.md
git commit -m "docs(perf): reset performance report skeleton, mark old report superseded"
```

---

## Task 2: Katman 1 — Veritabanı ölçümü

**Files:**
- Modify: `docs/performance-report.md` (Bölüm 1)

- [ ] **Step 1: Performans advisor'larını çalıştır**

Supabase MCP: `mcp__plugin_supabase__get_advisors` { project_id: "agijvfrcudpzsofgfogu", type: "performance" }
Expected: eksik index / kullanılmayan index / RLS init-plan uyarıları listesi. Çıktıyı not al.

- [ ] **Step 2: Mevcut index envanterini çek**

Supabase MCP: `mcp__plugin_supabase__execute_sql` { project_id: "agijvfrcudpzsofgfogu", query:
```sql
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('attendance','homeworks','homework_submissions','students','classes','profiles')
ORDER BY tablename, indexname;
```
}
Expected: her tablonun mevcut index tanımları. Hangi sıcak filtrelerin (school_id+date+status, school_id+teacher_id) index'i var/yok belirle.

- [ ] **Step 3: En sıcak iki sorguda EXPLAIN ANALYZE**

Supabase MCP: `execute_sql` ile (bir gerçek school_id seç: `SELECT id FROM schools LIMIT 1`):
```sql
EXPLAIN ANALYZE
SELECT student_id, class_id, date FROM attendance
WHERE school_id = '<id>' AND status = 'absent' AND date >= (CURRENT_DATE - 30);
```
ve
```sql
EXPLAIN ANALYZE
SELECT id FROM homeworks WHERE school_id = '<id>' AND teacher_id = '<id>';
```
Expected: plan çıktısında `Seq Scan` mı `Index Scan` mı, satır sayısı, süre. Seq scan = eksik index bulgusu.

- [ ] **Step 4: Üretim yavaş sorgu sinyali**

Supabase MCP: `mcp__plugin_supabase__get_logs` { project_id: "agijvfrcudpzsofgfogu", service: "postgres" }
Expected: varsa yavaş/sık sorgu satırları. Trafik düşükse "anlamlı sinyal yok" diye not düş.

- [ ] **Step 5: Bölüm 1'i yaz**

`docs/performance-report.md` Bölüm 1'i doldur: advisor bulguları tablosu, eksik index listesi (tablo+kolon+gerekçe), EXPLAIN sonuçları (seq scan'ler), log notu. Her bulgu somut (tablo/index adı).

- [ ] **Step 6: Commit**

```bash
git add docs/performance-report.md
git commit -m "docs(perf): add DB layer findings (advisors, indexes, EXPLAIN)"
```

---

## Task 3: Katman 2 — Sunucu sorgu denetimi (statik)

**Files:**
- Modify: `docs/performance-report.md` (Bölüm 2)
- Read-only audit: yukarıdaki "Sıcak Rota Dosya Envanteri" dosyaları

- [ ] **Step 1: Tüm sıcak rotalarda Supabase çağrılarını listele**

Run:
```bash
grep -rnE "\.from\('[a-z_]+'\)|supabase\.auth\.getUser\(\)|getCurrentUser\(\)" \
  "app/(dashboard)/anasayfa" "app/(dashboard)/odevler" "app/(dashboard)/yoklama" \
  "app/(dashboard)/rapor" "app/platform" 2>/dev/null
```
Expected: dosya:satır bazında tüm tablo sorguları + auth çağrıları. Bunu ham envanter olarak kullan.

- [ ] **Step 2: Her sıcak sayfa için sorgu sayımı ve sınıflandırma**

Her sayfa (anasayfa rol bazlı, odevler, matris, yoklama, cizelge, rapor x2, platform) için kodu oku ve belirle:
- Toplam sorgu sayısı
- Paralel mi (`Promise.all`) seri mi (bağımlı ardışık `await`)
- Over-fetch: UI'de kullanılmayan `select` kolonu, limitsiz sorgu (`.limit()` yok)
- Duplicate sorgu (aynı tablo+filtre birden fazla bileşende)
- `supabase.auth.getUser()` doğrudan çağrısı (cache bypass) — Step 1 çıktısından

- [ ] **Step 3: `platform/actions.ts` N+1 borcunu doğrula**

Run: `grep -n "for\|map\|\.from(" app/platform/actions.ts app/platform/page.tsx`
Expected: ROADMAP'teki "N+1" hâlâ var mı yok mu kesinleştir (döngü içinde sorgu var mı). Bulguyu (var/yok + dosya:satır) not al.

- [ ] **Step 4: Bölüm 2'yi yaz**

Bölüm 2'ye sayfa-başına tablo (Sayfa | Toplam Sorgu | Paralel | Seri | Sorun) + her somut bulgu için `dosya:satır` + kısa açıklama. Yalnızca bugün var olan dosyalara referans ver.

- [ ] **Step 5: Commit**

```bash
git add docs/performance-report.md
git commit -m "docs(perf): add server-side query audit findings"
```

---

## Task 4: Katman 3 — İstemci Lighthouse

**Files:**
- Modify: `docs/performance-report.md` (Bölüm 3)

- [ ] **Step 1: Public rotaları canlıda ölç**

Chrome DevTools MCP: her biri için
- `mcp__plugin_chrome-devtools-mcp_chrome-devtools__new_page` / `navigate_page` → `https://myedudesk.com.tr/`, `/login`, `/gizlilik`
- `mcp__plugin_chrome-devtools-mcp_chrome-devtools__lighthouse_audit` (kategori: performance)
Expected: her rota için LCP, INP/TBT, CLS, toplam JS (KB), render-blocking. Sayıları not al.

- [ ] **Step 2: Authenticated rotalar için yerel dev + test girişi hazırla**

Run (arka planda): `npm run dev`
Sonra test kullanıcısıyla giriş: `tests/playwright/setup/global-setup.ts` referans — `TEST_EMAIL_OGRETMEN`/`TEST_PASSWORD_OGRETMEN` (fallback `test_ogretmen@test.example` / `Test1234!`). `.env.local`'da set değilse `upsertTestUser` mantığıyla seed gerekir.
Chrome DevTools MCP ile `http://localhost:3000/login` → `#email`/`#password` doldur → giriş.
Expected: `/anasayfa`'ya yönlenme. Başarısızsa Step 3'ü atla, raporda "yerel authenticated ölçüm yapılamadı, Katman 2 esas alındı" notu düş.

- [ ] **Step 3: Authenticated sıcak rotaları ölç**

Giriş başarılıysa `lighthouse_audit` veya `performance_start_trace`/`performance_stop_trace` ile: `/anasayfa`, `/odevler`, `/yoklama`.
Expected: LCP/INP/CLS/JS sayıları. Not al.

- [ ] **Step 4: Bölüm 3'ü yaz**

Bölüm 3'e rota başına metrik tablosu (Rota | Ölçüm yöntemi [canlı/yerel/statik] | LCP | INP | CLS | JS KB | Sorun). Hangi rotanın hangi yöntemle ölçüldüğü açık.

- [ ] **Step 5: Commit**

```bash
git add docs/performance-report.md
git commit -m "docs(perf): add client-side Lighthouse findings"
```

---

## Task 5: Sentez — aksiyon listesi + baseline + yeniden ölçüm

**Files:**
- Modify: `docs/performance-report.md` (Bölüm 4, 5, 6)

- [ ] **Step 1: Önceliklendirilmiş aksiyon listesi (Bölüm 4)**

Tüm katman bulgularını tek listede topla: her madde 🔴/🟡/🟢 + `dosya:satır` veya metrik + beklenen kazanım + tahmini efor. Sıra: etki/efor oranı.

- [ ] **Step 2: Baseline metrik tablosu (Bölüm 5)**

Bugünkü sayıları sabitle: sayfa başına sorgu sayısı, sıcak rotaların LCP/INP/CLS/JS KB, kritik index var/yok durumu. (Sonraki tur bunlarla kıyaslayacak.)

- [ ] **Step 3: Yeniden ölçüm yönergesi (Bölüm 6)**

Aynı ölçümü tekrar üretmek için kısa checklist: hangi MCP çağrıları, hangi grep komutu, hangi rotalar. Düzeltme turundan sonra "before/after" için.

- [ ] **Step 4: Commit**

```bash
git add docs/performance-report.md
git commit -m "docs(perf): add prioritized actions, baseline, re-measure guide"
```

---

## Task 6: Öz-denetim — hayalet referans taraması

**Files:**
- Modify: `docs/performance-report.md` (gerekirse düzeltme)

- [ ] **Step 1: Rapordaki her dosya referansının bugün var olduğunu doğrula**

Run:
```bash
grep -oE "app/[A-Za-z0-9_()/\[\].-]+\.tsx?|src/[A-Za-z0-9_/.-]+\.tsx?" docs/performance-report.md \
  | sort -u | while read f; do [ -e "$f" ] && echo "VAR  $f" || echo "YOK  $f"; done
```
Expected: tüm satırlar `VAR`. `YOK` çıkan her referansı düzelt veya kaldır (eski raporun düştüğü tuzak tam burası).

- [ ] **Step 2: Başarı kriterleri kontrolü**

Spec'in 4. bölümündeki kriterleri elle doğrula: her bulgu somut referanslı mı, önceliklendirme gerekçeli mi, baseline kayıtlı mı, authenticated yöntem şeffaf mı.

- [ ] **Step 3: Final commit + push**

```bash
git add docs/performance-report.md
git commit -m "docs(perf): self-review — verify no ghost file references"
git push origin main
```
