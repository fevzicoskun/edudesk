# Performans Ölçüm Taraması — Tasarım

**Tarih:** 2026-06-14
**Tür:** Kalite / teknik borç — ölçüm (measurement-first)
**Durum:** Onaylandı, plana hazır

---

## 1. Amaç & Kapsam

Güncel kod tabanının ve canlı sitenin (`myedudesk.com.tr`) gerçek performans durumunu **ölçmek** ve dosya-doğru, önceliklendirilmiş taze bir `docs/performance-report.md` üretmek.

**Bu turda düzeltme yapılmaz.** İlke: "ölç, sonra karar ver". Düzeltmeler, bu raporun bulgularına göre ayrı bir tur olarak planlanır.

### Neden
Mevcut `docs/performance-report.md` (2026-05-19) **ölü**: referans verdiği dosyaların tamamı (`DersProgramiWidget`, `MudurDashboard`, `MudurYardimcisiDashboard`, `MentorSinifimWidget`, `raporlar/mentor`, `raporlar/ogrenci`, `src/shared/perf`) sonraki refactor'larda silinmiş. Önerileri uygulanamaz. Ayrıca `2026-06-07-performance-transformation-design.md` turunda perf instrumentation eklenip sonradan kaldırılmış. Bu yüzden taze ölçüm şart.

Eski rapor bu raporla **değiştirilir** ve başına "superseded" notu konur.

---

## 2. Ölçüm Metodolojisi — 3 katman

### Katman 1 — Veritabanı (Supabase MCP)
- `get_advisors(type: performance)` → eksik/kullanılmayan index, RLS performans uyarıları
- `list_tables` + `pg_indexes` sorgusu → mevcut index envanteri
- En sıcak sorgularda `EXPLAIN ANALYZE` (en az: `attendance` WHERE school_id+date+status; `homework`/`homeworks` WHERE school_id+teacher_id) → index gerçekten kullanılıyor mu, seq scan var mı
- `get_logs(service: postgres)` → üretimde yavaş/sık sorgu sinyali

### Katman 2 — Sunucu sorgu denetimi (statik, güncel dosyalar)
Sıcak rotaların Server Component'leri ve bağlı widget'ları taranır:
- `app/(dashboard)/anasayfa` (rol bazlı tüm dashboard + widget dosyaları)
- `app/(dashboard)/odevler` ve `odevler/sinif/[classId]` (matris)
- `app/(dashboard)/yoklama` ve `yoklama/cizelge`
- `app/(dashboard)/rapor/devamsizlik` ve `rapor/ogretmen-aktivite`
- `app/platform` (eski ROADMAP'te N+1 borcu işaretliydi — doğrula)

Her sayfa için ölçülecek: sorgu sayısı; paralel vs waterfall (ardışık bağımlı `await` zinciri); over-fetch (UI'de kullanılmayan kolon, limitsiz `select`); duplicate sorgu; `getCurrentUser()` cache bypass (`supabase.auth.getUser()` doğrudan çağrısı).

### Katman 3 — İstemci (Chrome DevTools MCP, canlı + yerel)
Lighthouse + performans trace ile toplanacak: LCP, INP/TBT, CLS, toplam JS (KB), render-blocking kaynak, görsel boyutlandırma.

- **Public rotalar** (landing `/`, `/login`, `/gizlilik`): canlı `myedudesk.com.tr` üzerinde ölç.
- **Authenticated sıcak rotalar** (`anasayfa`, `odevler`, `yoklama`): **yerel dev** (`npm run dev`) + Playwright test girişi ile ölç. Test kullanıcıları `tests/playwright/setup/global-setup.ts` üzerinden servis client ile seed edilir (`TEST_EMAIL_OGRETMEN`/`TEST_PASSWORD_OGRETMEN`, fallback `test_ogretmen@test.example` / `Test1234!`). Seed/giriş çalışmazsa bu rotalar için Katman 2 + üretim loglarına dayanılır.
- Hangi yöntemin kullanıldığı (canlı / yerel / sadece statik) raporda her rota için açıkça belirtilir.

---

## 3. Çıktı (Deliverable)

`docs/performance-report.md` baştan yazılır:
1. Başlık: tarih, kapsam, yöntem, kullanılan araçlar (Supabase MCP, Chrome DevTools MCP, statik analiz)
2. Eski raporun "superseded" notu
3. Katman bazlı bulgu tabloları (DB / Sunucu / İstemci)
4. **Önceliklendirilmiş aksiyon listesi** (🔴/🟡/🟢), her madde `dosya:satır` veya somut metrik referanslı — **hayalet dosya yok**
5. **Baseline metrik tablosu** — düzeltme sonrası kıyas için bugünkü sayılar: sayfa başına sorgu sayısı, LCP/INP/CLS, bundle KB, kritik index durumu
6. Sonraki tur için "yeniden-ölçüm" yönergesi (aynı komutlarla tekrar ölç)

---

## 4. Başarı Kriterleri

- Her bulgu bugün var olan bir dosya/satıra veya gerçekten ölçülmüş bir metriğe dayanır (ölü referans yok — eski raporun düştüğü tuzak tekrarlanmaz)
- Önceliklendirme net: etki × efor gerekçeli
- Baseline sayılar kayıtlı → sonraki turda iyileşme objektif ölçülebilir
- Authenticated rotalarda kullanılan ölçüm yöntemi şeffaf belirtilmiş

---

## 5. Kapsam Dışı (YAGNI)

- Bulunan sorunların **düzeltilmesi** (ayrı tur — bu raporun çıktısına göre planlanır)
- Kalıcı APM / instrumentation kurulumu (perf timer geçici olabilir, kalıcı altyapı kurulmaz)
- Yük testi (ayrı `docs/load-testing.md` kapsamında)
- Frontend görsel/font asset üretimi veya yeniden tasarım

---

## 6. Riskler & Varsayımlar

- **Authenticated Lighthouse**: yerel dev + seed çalışmazsa o rotalarda istemci metriği eksik kalır → Katman 2 ile telafi, raporda not düşülür.
- **Supabase MCP erişimi**: `get_advisors` / `get_logs` proje üzerinde çalışmalı (proje ID `agijvfrcudpzsofgfogu`). Erişim yoksa `EXPLAIN ANALYZE` + `pg_indexes` `execute_sql` ile yürütülür.
- **Üretim trafiği düşük**: log tabanlı yavaş sorgu sinyali zayıf olabilir; statik denetim + EXPLAIN birincil kanıt kaynağı.
