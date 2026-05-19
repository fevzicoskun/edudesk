# Domain-Driven Design Analysis

## Bounded Context Haritası

```
┌─────────────────────────────────────────────────────────────────────────┐
│  IDENTITY CONTEXT                                                        │
│  auth · rbac · sessions                                                  │
│  Dil: user, role, permission, session, school                            │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ Tüm contextler buna bağımlı
          ┌─────────────────────┼────────────────────────────┐
          │                     │                            │
┌─────────▼──────────┐ ┌────────▼────────┐ ┌───────────────▼──────────┐
│  ACADEMICS CONTEXT │ │ MENTOR CONTEXT  │ │  ADMINISTRATION CONTEXT  │
│                    │ │  (ÇIKARILACAK)  │ │                          │
│  homework          │ │  mentor_reports │ │  school                  │
│  attendance        │ │  lesson_sched.  │ │  users                   │
│  classes+students  │ │                 │ │  tokens                  │
│  notes             │ └────────┬────────┘ └──────────────────────────┘
│  zumre (curriculum)│          │ class/student ID okur
└─────────┬──────────┘          │ (ClassRepo'ya bağımlı değil,
          │                     │  sadece FK ilişkisi)
┌─────────▼──────────────────────▼────────────────────────────────────┐
│  REPORTING CONTEXT                                                   │
│  export · raporlar pages                                             │
│  Sadece READ — tüm contexte sorgu atar, hiçbirine import yapmaz     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 1. Bounded Contexts

### Identity Context
**Modüller:** `auth`, `rbac`, `sessions`  
**Sorumluluk:** Kim girdi, hangi yetkiye sahip, hangi okula ait.  
**Dil:** user, role, permission, school_id, session  
**Durum:** Temiz. auth → sessions bağımlılığı (login/logout için session oluşturma) tek justified cross-context import.

### Academics Context
**Modüller:** `homework`, `attendance`, `classes` (students dahil), `notes`, `zumre` (curriculum + exams + zumre meetings)  
**Sorumluluk:** Sınıf içi tüm pedagojik süreçler.  
**Dil:** class, student, homework, submission, attendance, curriculum, exam  
**Durum:** homework + attendance sadece `class_id` / `student_id` FK kullanır, ClassRepository'ye import yok — bu doğru.  
**Problem:** `zumre` içinde 3 farklı sub-domain (curriculum, exams, zumre meetings) tek domain altında. Bakılabilir ama breaking değil.

### Mentor Context
**Modüller:** Şu an yok — `classes` repository içine gömülü, `app/actions/` altında dağınık.  
**Sorumluluk:** Mentor-öğrenci ilişkisi, rapor yazımı, ders programı.  
**Dil:** mentor, mentee, report, schedule  
**Durum:** **En büyük extraction fırsatı** (aşağıda detay).

### Reporting Context
**Modüller:** `export`, `app/(dashboard)/raporlar/`  
**Sorumluluk:** Cross-context aggregation, PDF/Excel export, özet görünümler.  
**Dil:** report, export, aggregate  
**Durum:** Doğru pattern — sadece okuma, hiçbir context'e import etmiyor (doğrudan DB sorgusu).

### Administration Context
**Modüller:** `school`, `users`, `tokens`  
**Sorumluluk:** Okul yönetimi, kullanıcı davet/silme, token yönetimi.  
**Dil:** school, teacher, principal, invite, revoke  
**Durum:** Temiz.

---

## 2. Coupling Noktaları

| Bağımlılık | Nereden | Nereye | Seviye | Değerlendirme |
|---|---|---|---|---|
| auth → sessions | AuthService | SessionRepository | Import | Justified — session lifecycle |
| tüm servisler → rbac | HomeworkService vb. | PermissionService / Ability | Shared Kernel | Doğru pattern |
| mentor_reports → classes | DB FK | `mentor_teacher_id`, `class_id` | DB FK | Risk (aşağıda) |
| app/actions/classes.ts | addMentorReport | Inline Supabase | Action layer | Yanlış yer |
| export → tüm tablolar | ExportService | Direct SQL | DB | Acceptable for reporting |

### Kritik coupling: Mentor + Classes
`mentor_teacher_id` kolonu `classes` tablosundadır. `mentor_reports` ise ayrı tablodadır ama sınıfa FK'ı var. Bu, mentor kavramının iki farklı yerde yaşadığı anlamına gelir:
- `ClassRepository.ts` — `mentor_teacher_id` assign/unassign
- `app/actions/classes.ts` — `addMentorReport` ve `deleteMentorReport` inline sorguları

---

## 3. Extraction Boundary Önerileri

### Öncelik 1: Mentor Domain Çıkarma
**Ne:** `app/actions/classes.ts` içindeki `addMentorReport` + `deleteMentorReport` + `assignMentor` + `app/actions/mentorluk.ts` + `app/actions/schedules.ts`  
**Nereye:** `src/domains/mentor/`  
**Nasıl:**
```
src/domains/mentor/
├── services/
│   ├── MentorService.ts      (assignMentor, addReport, deleteReport)
│   └── ScheduleService.ts    (lesson schedule CRUD)
├── repositories/
│   ├── MentorRepository.ts   (mentor_reports table)
│   └── ScheduleRepository.ts (lesson_schedules table)
├── types/index.ts
└── validators/index.ts
```
`mentor_teacher_id` assign işlemi `classes` tablosuna yazar — bu ClassRepository üzerinden veya direkt Supabase sorgusu olarak kalabilir. MentorService, ClassRepository'yi import etmez; sadece `school_id` + `class_id` parametre olarak alır.  
**Risk:** Düşük — sınır nettir, FK yeterli.

### Öncelik 2: Notes Domain Kararı
**Seçenek A:** Academics context'e merge et (notes → classes domain altında StudentNotes).  
**Seçenek B:** Şimdilik bırak, domain çok ince ama izole ve temiz.  
**Öneri:** B — breaking change değil, ileride genişleyebilir.

### Öncelik 3: lib/supabase/ Shim Temizliği
`lib/supabase/` yalnızca `app/actions/classes.ts` ve birkaç eski dosya tarafından kullanılıyor. Yeni kod doğrudan `@/src/infrastructure/supabase/server` kullanıyor. Bu shim zamanla kaldırılabilir.

### Öncelik 4: Zumre Sub-context Ayrımı (uzun vadeli)
```
zumre/ (mevcut)
├── curriculum  → CurriculumService, CurriculumRepository
├── exams       → ExamService, ExamRepository
└── meetings    → ZumreMeetingService (şu an school/ altında karışıyor!)
```
**Problem:** `school/` domain'i `MeetingService` ve `SchoolInfoService` içeriyor ama okul toplantıları zümre toplantılarıyla aynı kavramsal alan değil. Müdür toplantıları (school context) vs zümre toplantıları (academics/zumre context) — şu an ikisi `school/` altında.

---

## 4. Shared Logic Doğru Konumu

| Şu an | Doğru yer | Durum |
|---|---|---|
| `src/shared/types/` — Profile, Class, Student, Homework | Doğru | ✓ |
| `src/shared/auth/` — getCurrentUser, getCurrentProfile | Doğru | ✓ |
| `src/shared/authorization/` — Ability engine | Doğru | ✓ |
| `src/shared/permissions/` — P constants | Doğru | ✓ |
| `src/shared/validation/` — Zod schemas | Doğru | ✓ |
| `src/shared/utils/getEgitimYili` | Doğru — ortak hesaplama | ✓ |
| `app/actions/classes.ts` — addMentorReport inline Supabase | **Yanlış** — domain service'e taşınmalı | ✗ |
| `src/domains/school/services/MeetingService.ts` | Tartışmalı — zumre context? | ~ |

---

## 5. Circular Dependency Riskleri

**Şu an:** Sıfır circular dependency.

**Potansiyel riskler:**

| Senaryo | Risk | Önlem |
|---|---|---|
| Mentor domain çıkarılırsa + ClassRepo import ederse | mentor ↔ classes döngüsü | MentorService ClassRepo'yu import etmez; sadece DB FK |
| Reporting bir domain service'i import ederse | reporting ↔ domain döngüsü | Reporting context sadece Supabase'e sorgu atar |
| rbac, başka bir domain'i import ederse | Tüm contextler çöker | rbac sadece shared/auth'u kullanır, hiçbir feature domain'ine dokunmaz |

**Korunma stratejisi:** Yeni domain ekleneceğinde şu kuralı uygula:
- Domain A, Domain B'nin `Service` veya `Repository`'sini import edemez
- Sadece `types/` veya `shared/*` import edilebilir
- Cross-context veri ihtiyacı varsa → event veya shared query (direct Supabase)

---

## 6. Mimari Diyagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        NEXT.JS APP ROUTER                           │
│  app/(dashboard)/  ←  Server Components + Server Actions           │
│  app/actions/*.ts  ←  "use server" boundary, validation, revalidate │
└────────────────────────────┬────────────────────────────────────────┘
                             │ calls
     ┌───────────────────────┼──────────────────────────────────────┐
     │                       │                                      │
┌────▼──────────┐   ┌────────▼──────────┐   ┌──────────────────────▼─┐
│   IDENTITY    │   │    ACADEMICS      │   │   ADMINISTRATION        │
│   CONTEXT     │   │    CONTEXT        │   │   CONTEXT               │
│               │   │                   │   │                         │
│ AuthService   │   │ HomeworkService   │   │ SchoolService           │
│ SessionRepo   │   │ AttendanceService │   │ UserService             │
│ PermSvc (rbac)│   │ ClassService      │   │ TokenService            │
│ Ability engine│   │ NoteService       │   │ MeetingService          │
│               │   │ CurriculumService │   │                         │
└───────┬───────┘   │ ExamService       │   └──────────────────────┬──┘
        │           └────────┬──────────┘                          │
        │                    │                                      │
        │         ┌──────────▼──────────┐                          │
        │         │   MENTOR CONTEXT    │                          │
        │         │   (ÇIKARILACAK)     │                          │
        │         │                     │                          │
        │         │ MentorService       │                          │
        │         │ ScheduleService     │                          │
        │         └──────────┬──────────┘                          │
        │                    │                                      │
        └────────────────────┼──────────────────────────────────────┘
                             │ All contexts depend on
          ┌──────────────────▼────────────────────────────────────┐
          │                  SHARED KERNEL                        │
          │  auth · types · permissions · validation              │
          │  authorization · audit · utils · perf                 │
          └──────────────────────────────────────────────────────┘
                             │
          ┌──────────────────▼────────────────────────────────────┐
          │               INFRASTRUCTURE                          │
          │  supabase · inngest · tokens · observability          │
          │  security/revocation                                  │
          └──────────────────────────────────────────────────────┘
          
          ┌────────────────────────────────────────────────────────┐
          │  REPORTING CONTEXT (cross-cutting, read-only)          │
          │  export · raporlar pages                               │
          │  → Direkt DB sorgusu, domain service import yok       │
          └────────────────────────────────────────────────────────┘
```

---

## 7. Teknik Borçlar

| # | Borç | Etki | Öncelik |
|---|---|---|---|
| **T1** | `app/actions/classes.ts` içinde `addMentorReport` + `deleteMentorReport` inline Supabase sorgusu | Service layer bypass, test edilemez | Yüksek |
| **T2** | Mentor kavramı domain yok — `classes` repo + `app/actions` + `lesson_schedules` dağınık | Ownership belirsiz, büyütmek zor | Yüksek |
| **T3** | `lib/supabase/` shim katmanı — bazı dosyalar bunu kullanıyor (eski yol) | İki import path için kafa karışıklığı | Orta |
| **T4** | `school/` altında `MeetingService` (zümre toplantıları school context'inde) | Kavramsal yanlış yerleşim | Orta |
| **T5** | `zumre/` altında 3 sub-domain (curriculum + exams + meetings) tek service değil ama tek klasör | Büyüdükçe ayırt etmek zorlaşır | Düşük |
| **T6** | `export` domain'i direkt `profiles`, `homework_submissions` vb. tablolara sorgu atıyor — domain contract yok | Schema değişince export kırılır sessizce | Düşük |
| **T7** | `onboarding` yalnızca `app/` altında — domain service yok | Logic app katmanında sıkışmış | Düşük |

### Hemen Yapılabilecek (breaking change yok)
- **T1:** `addMentorReport` + `deleteMentorReport` → `src/domains/mentor/services/MentorService.ts` çıkar, action'lar onu çağırır
- **T3:** `lib/supabase/` kullanan dosyaları `@/src/infrastructure/supabase/server` yoluna güncelle

### Sonraki Sprint
- **T2:** Mentor domain çıkar (T1 bunu tetikler)
- **T4:** `MeetingService` → `src/domains/zumre/services/` altına taşı

### Uzun Vadeli
- **T5:** Zumre sub-contexts
- **T6:** Export domain için typed view veya repository pattern
