# Haftalık Çalışma Planı — Tasarım (2026-09-09)

## Sorun
12. sınıfta her öğrenci farklı kaynaktan (soru bankası) çalışır ve bireysel bir
programı vardır. Mevcut ödev modeli sınıf-bazlı ve tek kaynaklıdır; öğrenciye
özel talimatı her ödevin açıklamasına elle yazmak sürdürülemez.

## Karar
Ödev sisteminden **bağımsız**, öğrenci-bazlı haftalık plan tablosu. Ödev
listesi, widget'lar, veli portalı ve bildirimler **dokunulmaz**. Özellik
feature branch'te geliştirilir; migration rollback bloğu taşır (geri alınabilir).

Reddedilen: bireysel `homeworks` satırı üretmek (ödev listesi kirlenir, sınıf
bazlı tüm sorgular `student_id` ayrımı öğrenmek zorunda kalır); koçluk modülü
(plan başlığı + şablon + hedef takibi — YAGNI, sonra üstüne eklenebilir).

## Kapsam (v1)
- Öğrencinin kitap defteri (`student_sources`) — bir kez kaydedilir, editörde seçilir.
- Haftalık plan maddeleri (`study_plan_items`) — öğrenci × öğretmen × hafta.
- Sınıf haftalık tablosu `/siniflar/[id]/plan` + hafta editörü (drawer).
- Öğrenci 360'ta "Haftalık Çalışma Planı" bölümü (aynı editör).
- "Geçen haftayı kopyala".
- Durum takibi mevcut sözlükle: yapıldı / eksik / yapılmadı (+ not).

v1 dışı (v2 adayları): veli portalında plan görünümü, veli bildirimi, plan
şablonları, aynı planı birden çok öğrenciye uygulama, zaman çizelgesi entegrasyonu,
soru sayısı/net takibi.

## Veri modeli
Migration: `supabase/migrations/20260909120000_study_plan.sql` (sonunda yorumlu
`-- ROLLBACK` bloğu: `drop table if exists study_plan_items, student_sources`).

```sql
student_sources (
  id uuid pk, school_id uuid not null, student_id uuid fk students cascade,
  subject text not null, name text not null, active bool default true,
  created_by uuid fk profiles, created_at timestamptz
)
study_plan_items (
  id uuid pk, school_id uuid not null,
  student_id uuid fk students cascade, teacher_id uuid fk profiles cascade,
  subject text not null,
  week_start date not null,          -- Pazartesi (TR)
  plan_date date null,               -- null = "hafta içinde"; check: week_start..week_start+6
  source text null,                  -- defterden seçilince metin snapshot'ı, elle de yazılır
  description text not null,         -- konu/miktar: "Türev 40 soru"
  status text not null default 'planlandi'  -- planlandi|yapildi|eksik|yapilmadi (check)
  note text null,
  created_at, updated_at timestamptz
)
idx: study_plan_items(student_id, week_start), (teacher_id, week_start), student_sources(student_id) where active
```
RLS: iki tabloda da `parent_contact_logs` deseni — `for all to authenticated`
using/with check `school_id = caller school_id`. Öğretmen-sınıf kapsamı ve
"yalnız kendi maddesi" kuralı **servis katmanında** (teacher_classes + teacher_id
eşitliği). DB tipleri migration'dan sonra regen edilir (tsc bağımlılığı).

Ders (`subject`): öğretmenin `profiles.subject` değeri; null ise "Genel".

## Saf mantık — `src/domains/studyPlan/lib/planMath.ts`
- `weekStartOf(iso: string): string` — verilen günün Pazartesi'si (ISO string aritmetiği, TZ bağımsız).
- `shiftWeek(weekStart, delta)`; `weekDays(weekStart)` 7 gün listesi; `isInWeek(date, weekStart)`.
- `copyWeek(items, targetWeek)` — status `planlandi`, note null, plan_date aynı haftagününe kaydırılır.
- `weekSummary(items)` → `{ toplam, yapildi, eksik, yapilmadi, yuzde }` (yüzde = yapıldı/toplam, toplam 0 → 0).
- `groupBySubject(items)` — Öğrenci 360 için.

## Servis — `StudyPlanService` / `StudyPlanRepository`
Yetki: mevcut `P.HOMEWORK.*` (yeni RBAC satırı yok). Okuma `HOMEWORK.READ`;
yazma `HOMEWORK.CREATE/UPDATE/DELETE` + öğrencinin sınıfı `teacher_classes`'ta
olmalı (müdür/MY yazamaz, salt-okunur — v1 bilinçli). Güncelleme/silme yalnız
`teacher_id = ability.userId` maddelerde.

Metotlar:
- `getClassWeek(classId, weekStart)` → öğrenci listesi + o öğretmenin maddeleri (sınıf tablosu).
- `getStudentWeek(studentId, weekStart)` → tüm öğretmenlerin maddeleri (Öğrenci 360).
- `getSources(studentId)`, `addSource(studentId, name)`, `removeSource(id)`.
- `addItem`, `updateItem` (description/source/plan_date/status/note), `deleteItem`.
- `copyPreviousWeek(studentId, weekStart)` — kendi maddelerini önceki haftadan kopyalar; hedef haftada zaten madde varsa hata ("Bu hafta boş değil").

Server action'lar (`src/domains/studyPlan/actions`): zod — description 1..300,
source ≤120, note ≤300, status enum, tarih `YYYY-MM-DD`; `school_id`/`teacher_id`
daima ability'den. Hata: repo hatası logger + Türkçe mesaj, fail-closed.

## Yüzeyler
1. `/siniflar/[id]/plan?hafta=YYYY-MM-DD` (server page, varsayılan bu hafta):
   başlık + hafta ileri/geri; tablo satır = öğrenci: madde sayısı, tamamlanma
   çubuğu, son madde özeti. Satır tıklanınca `HaftaEditoru` drawer (client).
2. `HaftaEditoru`: madde listesi (gün chip'i Pzt..Paz/Hafta, kaynak seçici
   `<datalist>` defterden + serbest metin, talimat input, durum chip'leri, not),
   "+ madde", "+ kitap ekle" (defter), "Geçen haftayı kopyala" (hafta boşsa).
   Kaydetme madde-bazlı server action; optimistic değil, basit `useActionState`.
3. Öğrenci 360 (`siniflar/[id]/ogrenciler/[studentId]`): "Haftalık Çalışma Planı"
   bölümü — bu hafta, derse göre gruplu; kendi maddeleri düzenlenebilir, diğer
   öğretmenlerinki salt-okunur (öğretmen adı ile).
4. Sınıf sayfasına "Haftalık Plan" linki; `loading.tsx` + `title` mevcut desen.
5. `featureMap.ts` + DB usage whitelist'e `plan` eklenir (kullanım metriği kuralı).

## Test
- Unit (vitest): planMath (hafta sınırı, yıl geçişi, Pazar→Pazartesi, kopyalama,
  özet 0/0), StudyPlanService (izin reddi, teacher_classes dışı sınıf, başkasının
  maddesini düzenleme reddi, kopyalamada dolu hafta hatası).
- E2E (1 spec `plan.spec.ts`): öğretmen sınıf plan sayfasında madde ekler →
  Öğrenci 360'ta görünür → durum yapıldı → tabloda çubuk güncellenir.
- Kanıt: tsc temiz, unit sayısı, build exit 0, 75+1 e2e.
