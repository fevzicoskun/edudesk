# Öğrenci 360 Tamamlama (Veli Görüşmeleri + Zaman Çizelgesi) — Tasarım

**Tarih:** 2026-07-04
**Durum:** Onaylandı
**Amaç:** Öğrenci detay sayfasını "okulun hafızası" yapmak (retention #4). Sayfanın ~%80'i zaten mevcut (performans özeti, devamsızlık paneli, ödev/not geçmişi, rehberlik raporları, veli analitiği/iletişim kaydı). Bu iş İKİ eksiği kapatır: veli görüşmeleri bölümü + tüm kaynakları birleştiren kronolojik zaman çizelgesi.

## Karar Özeti (kullanıcı onaylı)

| Soru | Karar |
|---|---|
| Kapsam | Mevcut sayfaya 2 bölüm eklenir (tam yeniden tasarım YOK) |
| Zaman çizelgesi içeriği | Yalnız kayda değer olaylar ("mevcut" günler ve "yapıldı" ödevler girmez) |
| Görüşme görünürlüğü | RLS SELECT genişletilir: sahip öğretmen + müdür/MY (okul-geneli); yazma sahip-özel kalır |

## Sayfa: `app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/page.tsx`

Sayfanın zaten çektiği veriler (keşifte doğrulandı, yeni sorgu maliyeti ~sıfır):
- `attendance`: `{ date, status }` — yalnız absent/late/excused, `schoolYearStart()`'tan beri
- `homework_submissions`: `{ id, status, updated_at, homeworks(id, title, subject, due_date) }`
- `grade_entries`: `{ score, grade_columns!inner(title, grade_type, max_score, exam_date, class_id) }`
- `parent_contact_logs`: `{ id, note, contact_method, contacted_at, teacher_id }` (limit 50)
- `student_notes`: `{ id, body, created_at }`
- `MentorService.getMentorReportsByStudent(studentId)` — yalnız `canSeeMentorReports` (mentor VEYA müdür/MY/zümre başkanı) ise
- YENİ: `parent_meetings` (aşağıda)

## 1) RLS Genişletme — tek migration

Mevcut `parent_meetings_own` (FOR ALL, sahip-özel) İKİYE ayrılır:
- **SELECT:** `teacher_id = (select auth.uid())` **VEYA** aynı okulda müdür/MY (mevcut `lesson_schedules`/`teacher_duties` SELECT deseni birebir; `(select auth.uid())` initplan sarması korunur)
- **INSERT/UPDATE/DELETE:** sahip-özel, mevcut USING+WITH CHECK mantığı aynen (yazma davranışı DEĞİŞMEZ)

Yeni kolon yok → `database.types.ts` regen GEREKMEZ. Migration sonrası: advisor kontrolü + SQL impersonation doğrulaması (öğretmen=kendi, müdür=okul, yabancı okul=0 — teacher_duties'teki doğrulama deseni).

## 2) Veli Görüşmeleri bölümü

- `MeetingRepository.listByStudent(studentId: string, schoolId: string)` — `id, meet_date, period, status, note, teacher_id` + öğretmen adı için `profiles` ayrı sorguyla map'lenir (teacher_id → auth FK embed edilemez; DutyRepository.listSchoolDuties deseni). Sıralama `meet_date desc, period desc`. Görünürlüğü RLS kırpar (öğretmen kendi, müdür/MY hepsi).
- `VeliGorusmeleriSection.tsx` (server component): tarih + `{period}. ders` + durum rozeti (planlandı=mavi/yapıldı=yeşil/iptal=soluk) + öğretmen adı + not. Kayıt yoksa boş-durum: "Bu öğrenciyle kayıtlı veli görüşmesi yok."
- Sorgu hatası → bölüm "Görüşmeler yüklenemedi" gösterir, sayfa çökmez.

## 3) Zaman Çizelgesi bölümü

**Saf mantık (TDD):** `src/domains/classes/lib/timelineMath.ts`
- `TimelineEvent { date: string; kind: TimelineKind; label: string }`,
  `TimelineKind = 'devamsizlik' | 'odev' | 'not' | 'gorusme' | 'rehberlik' | 'veli_iletisim' | 'ogretmen_notu'`
- `buildStudentTimeline(sources, windowStart: string): TimelineEvent[]` — 7 kaynağı tek tipe çevirir, `windowStart`'tan eski ve tarihi bozuk/boş kayıtları eler, yeni→eski sıralar.
- Kaynak → olay dönüşümü:
  - attendance absent/late/excused → `devamsizlik`: "Devamsız" / "Geç geldi" / "Özürlü"
  - submissions yapilmadi/eksik/gec (tarih = `homeworks.due_date`) → `odev`: '"{title}" ödevi yapılmadı/eksik/geç' — yapildi/mazeretli girmez
  - grade_entries (tarih = `exam_date`, null ise elenir) → `not`: '"{title}": {score}/{max_score}'
  - parent_meetings (tarih = `meet_date`; iptal girmez) → `gorusme`: "Veli görüşmesi ({durum}) — {öğretmen adı}"
  - mentor raporları → `rehberlik`: "Rehberlik görüşmesi" (içerik detayı listelenmez; kapı: yalnız `canSeeMentorReports` ise kaynağa dahil edilir)
  - parent_contact_logs (tarih = `contacted_at`) → `veli_iletisim`: "Veli iletişimi ({contact_method})"
  - student_notes (tarih = `created_at`) → `ogretmen_notu`: not gövdesinin ilk ~80 karakteri
- Pencere: `donemBasi()` (mevcut helper, `src/shared/utils`) → bugüne.

**UI:** `ZamanCizelgesiSection.tsx` ('use client' — yalnız "tümünü göster" aç/kapa için): dikey çizelge, her olayda kind-renkli nokta + tarih (`formatDateTR` benzeri mevcut format) + etiket. İlk 30 olay + varsa "Tümünü göster (N)" butonu (client aç/kapa, sayfalama YOK). Olay yoksa bölüm render edilmez. Sayfanın en altına eklenir.

**Renkler (WCAG, mevcut rozet dili):** devamsizlik=kırmızı, odev=turuncu, not=mavi, gorusme=yeşil, rehberlik=mor, veli_iletisim=teal, ogretmen_notu=gri (soluk metin `text-gray-500 dark:text-slate-400`).

## Test

- `timelineMath` unit: birleştirme + sıralama, pencere dışı eleme, bozuk/null tarih eleme, yapildi-ödev/mevcut-gün/iptal-görüşme girmez, etiket biçimleri, boş kaynaklar → [].
- RLS: SQL impersonation ile 3 senaryo (sahip görür / müdür görür / yabancı okul göremez).
- E2e: mevcut suite korunur; yeni bölümler için e2e yazılmaz (sayfa zaten test kapsamında değilse eklenmez — YAGNI).

## Hata Yönetimi

- Görüşme sorgusu hatası → bölüm-içi hata mesajı (sayfa çökmez).
- Timeline saf fonksiyon — geçersiz kayıtları sessizce eler (kritik yol değil).

## Bilinçli Dışarıda (sonraki iterasyonlar)

- PDF "öğrenci raporu" çıktısı (veli toplantısı çıktısı)
- Sekmeli tam yeniden tasarım
- Sayfalama / sonsuz kaydırma
- Zaman çizelgesinde filtreleme (kind bazlı)
