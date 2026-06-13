# EduDesk — Mevcut Özellik İyileştirme Sprinti

**Tarih:** 2026-06-11  
**Kapsam:** Tier 1 (2-3) + Tier 2 (tümü) + Tier 3 (tümü) — 8 özellik  

---

## Genel Mimari Notu

Tüm mutation'lar mevcut `app/actions/` → `domains/*/services/` → `domains/*/repositories/` → Supabase akışını takip eder. Tek yeni DB tablosu: `parent_contact_logs`. Diğer tüm özellikler mevcut tablolarla çalışır.

---

## Özellik 1 — StatusBoard Seçim Modu (Tier 1-2)

### Problem
`StatusBoardToolbar` zaten "Tümünü güncelle" butonlarına sahip. Eksik olan: belirli öğrencileri seçip sadece onları güncellemek. Örnek senaryo: 25 öğrenciden 7'si mazeretli — önce tümü "yapıldı" yapıp sonra 7'yi tek tek düzeltmek yerine, 7'yi seçip bir adımda "mazeretli" yapmak.

### Tasarım

`StatusBoard.tsx`'e `selectionMode` state eklenir. `StudentRow`'a checkbox eklenir (seçim modunda görünür). Seçili öğrenciler için floating action bar aşağıda belirir.

**State değişiklikleri (`StatusBoard.tsx`):**
```ts
const [selectionMode, setSelectionMode] = useState(false)
const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set())
```

**`StatusBoardToolbar`'a yeni prop:**
```ts
onToggleSelectMode: () => void
selectModeActive: boolean
```

**Floating bar (seçim modunda):**
- `N öğrenci seçildi` etiketi
- Her status için buton: "Seçilenleri Yapıldı / Yapılmadı / ..." 
- "Tümünü Seç / Seçimi Temizle" kısayolu
- "Seçim Modundan Çık" butonu

**`StudentRow`'a:**
- `selectionMode: boolean` prop
- `selected: boolean` prop  
- `onToggleSelect: (id: string) => void` prop
- Satırın sol tarafında checkbox (sadece `selectionMode=true` iken görünür)

**Action:** Mevcut `updateAllSubmissionStatuses` action'ı zaten var — sadece `studentIds` array'i değişecek (tüm öğrenciler yerine seçililer).

### Dosya değişiklikleri
- `StatusBoard.tsx` — state + seçim mantığı
- `statusboard/StatusBoardToolbar.tsx` — seçim modu toggle butonu eklenir
- `statusboard/StudentRow.tsx` — checkbox prop'ları eklenir
- `statusboard/types.ts` — gerekirse tip güncellemeleri

---

## Özellik 2 — Veli İletişim Günlüğü (Tier 1-3)

### Problem
`students` tablosunda `veli_email/veli_telefon/veli_ad` var ama "ne zaman iletişim kuruldu, ne konuşuldu" kaydı yok. Okul yönetimi ve veli toplantılarında bu bilgi kritik.

### DB Migrasyonu

```sql
CREATE TABLE IF NOT EXISTS parent_contact_logs (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id      UUID NOT NULL,
  student_id     UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  note           TEXT NOT NULL,
  contact_method TEXT NOT NULL DEFAULT 'diger',
  contacted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_parent_contact_logs_student ON parent_contact_logs(student_id, contacted_at DESC);
ALTER TABLE parent_contact_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pcl_school" ON parent_contact_logs FOR ALL TO authenticated
  USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));
```

`contact_method` değerleri: `'email' | 'telefon' | 'whatsapp' | 'yuz_yuze' | 'diger'`

### Domain Katmanı

**`src/domains/classes/repositories/ClassRepository.ts`'e eklenir:**
```ts
insertParentContactLog(data: { school_id, student_id, teacher_id, note, contact_method, contacted_at })
getParentContactLogs(studentId: string, schoolId: string): Promise<ParentContactLog[]>
```

**`src/domains/classes/actions/index.ts`'e eklenir:**
```ts
addParentContactLog(studentId: string, classId: string, formData: FormData)
```

### UI

`app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/page.tsx`'e yeni bir bölüm eklenir, `VeliIletisimForm`'un hemen altına.

Bileşen: `ParentContactLogSection.tsx` (server component — log listesi)
Form: `AddParentContactForm.tsx` (client component — log ekleme)

**Form alanları:**
- `contact_method` → dropdown (E-posta / Telefon / WhatsApp / Yüz Yüze / Diğer)
- `contacted_at` → date input (varsayılan: bugün)
- `note` → textarea (zorunlu)

**Log listesi:**
- Tarih + yöntem badge + not içeriği
- Sadece kendi notlarını silebilir öğretmen

---

## Özellik 3 — Yoklama "Alınmadı" Uyarısı (Tier 2-5)

### Problem
Yoklama sayfasında hangi sınıfların bugün yoklaması alınmış hangilerinin alınmamış görünmüyor. Öğretmen unutabilir.

### Tasarım

**`yoklama/page.tsx`'e ek sorgu:**
```ts
// Bugün yoklama alınan class_id'ler
const { data: takenToday } = await supabase
  .from('attendance')
  .select('class_id')
  .eq('school_id', profile.school_id)
  .eq('date', todayISO)
  .in('class_id', classes.map(c => c.id))
const takenClassIds = new Set((takenToday ?? []).map(r => r.class_id))
```

`YoklamaClient`'a `takenTodayIds: string[]` prop geçilir.

**`YoklamaClient.tsx`'te sınıf tab/seçici görünümü:**
- Mevcut sınıf: yeşil nokta (✓) = bugün alındı
- Alınmamış: kırmızı nokta = bugün alınmadı (haftaiçiyse)
- Hafta sonu: nötr (yoklama beklenmez)

**Ek:** Sayfa üstünde, "kendi sınıflarım" içinde bugün yoklaması alınmamış olanlar varsa küçük sarı banner: `"9-A, 10-B için bugün yoklama alınmadı"`

---

## Özellik 4 — Sınıf Listesinden Inline Not Ekleme (Tier 2-6)

### Problem
Öğrenci notunu `OgrenciListesi`'nden eklemek için tam profil sayfasına gitmek gerekiyor. Veli toplantısında veya sınıf geçerken hızlı not almak mümkün değil.

### Tasarım

`OgrenciSatiri`'ne yeni "Not" butonu eklenir. Mevcut "veli iletişim düzenle" inline panel pattern'ı aynen uygulanır.

**Buton:** Kalem simgesinin yanına küçük not simgesi eklenir.
**Açılan panel:**
```
[Hızlı not...                    ] [Kaydet] [İptal]
```
- `addStudentNote(studentId, classId, formData)` server action'ı çağrılır (zaten var)
- Kaydedilince panel kapanır, toast mesajı gösterilir

`OgrenciListesi.tsx`'e `schoolId` prop gerekmez — `classId` + `studentId` yeterli.

### Dosya değişiklikleri
- `OgrenciListesi.tsx` — `OgrenciSatiri`'ne not paneli eklenir

---

## Özellik 5 — Müdür Öğretmen Karşılaştırma Tablosu (Tier 2-7)

### Problem
`/odevler/analitik` müdür/MY için tüm ödevleri gösteriyor ama "hangi öğretmen ne kadar ödev verdi, tamamlanma oranı ne" diye bakamıyor.

### Tasarım

`analitik/page.tsx`'te `isManager` ise ek sorgu:
```ts
const { data: teacherProfiles } = await supabase
  .from('profiles')
  .select('id, full_name')
  .eq('school_id', sid)
  .in('role', ['ogretmen', 'zumre_baskani'])
```

Her öğretmen için `homeworks` listesinden `teacher_id` gruplandırması yapılır. Pure function: `computeTeacherStats(teachers, homeworks, submissions, students)`.

**Tablo sütunları:**
| Öğretmen | Ödev Sayısı | Ort. Tamamlanma | Risk Öğrenci |
|---|---|---|---|

Sıralama: varsayılan ödev sayısına göre azalan.

**Bileşen:** `analitik/OgretmenKarsilastirma.tsx` (yeni dosya)  
**Yardımcı fonksiyon:** `src/domains/homework/lib/analitik.ts`'e `computeTeacherStats` eklenir

---

## Özellik 6 — Takvim Sağ Panel Tamamlanma Oranı (Tier 3-8)

### Problem
Takvim'de güne tıklayınca ödev listesi görünüyor ama her ödevin tamamlanma oranı (%72 gibi) yok.

### Tasarım

**`takvim/page.tsx`'e ek sorgu** (sadece manager veya öğretmenin kendi ödevleri için):
```ts
// hw ID listesi hazır olduktan sonra submission sayıları
const { data: subCounts } = await supabase
  .from('homework_submissions')
  .select('homework_id, status')
  .in('homework_id', homeworkIds)
  .eq('school_id', sid)
```

Aynı sorgu basit completion map hesaplar: `{ [hwId]: { pct: number, yapildi: number, total: number } }`

`HomeworkCalendar`'a `completionMap: Record<string, { pct: number; yapildi: number; total: number }>` prop eklenir.

**Takvim hücresinde** (pill üzerinde, küçük sayı): Yer yoksa sadece sağ panelde gösterilir.
**Sağ panelde** her ödev satırına `%72` badge eklenir.

**Not:** Takvim sayfasında zaten öğrenci sayısı verisi yok — `pct` hesabı server side yapılır, `yapildi/total_submissions` olarak gösterilir (öğrenci sayısına normalize edilmez, basit tutuluyor).

---

## Özellik 7 — WeekLoadBanner Mobil Görünürlük (Tier 3-9)

### Problem  
WeekLoadBanner `danger` durumunda form içinde kaybolabiliyor, özellikle mobilde scroll gerekiyor.

### Tasarım

Mevcut `WeekLoadBanner.tsx`'te sadece iki değişiklik:

1. `danger` durumunda banner `sticky top-0 z-10` yapılır — scroll ederken görünür kalır
2. `danger` metnine `animate-pulse` sınıfı eklenir (başlık sadece)

Başka değişiklik yok — bileşen zaten iyi çalışıyor.

---

## Özellik 8 — Print Görünümü (Tier 3-10)

### Problem
`/odevler/[id]` sayfasında `PrintButton` var ama print CSS yok — sidebar, nav butonları çıktıya giriyor.

### Tasarım

`app/(dashboard)/odevler/[id]/page.tsx` veya global CSS'e `@media print` kuralları:

```css
@media print {
  nav, aside, [data-sidebar], .print\:hidden { display: none !important; }
  body { background: white; }
  .print\:block { display: block !important; }
}
```

Tailwind'de `print:hidden` class'ı Tailwind v4'te destekleniyor — mevcut kodda zaten `print:hidden` kullanılmış (PrintButton alanında). Yapılacak: 
- Sidebar/nav'ı `print:hidden` yapan global layout değişikliği
- Ödev detay sayfasına "print header" eklemek: okul adı, tarih, öğretmen adı
- `PrintButton` kullanıcıya görünür metinle: "Yazdır / PDF"

`app/(dashboard)/layout.tsx`'te sidebar+nav'a `print:hidden` eklenir.
`app/(dashboard)/odevler/[id]/page.tsx`'te print header `<div className="hidden print:block">` ile eklenir.

---

## Uygulama Sırası

Bağımlılık analizi:

| Sıra | Özellik | Bağımlılık |
|------|---------|------------|
| 1 | DB migration (parent_contact_logs) | Bağımsız |
| 2 | StatusBoard seçim modu | Bağımsız |
| 3 | Yoklama uyarısı | Bağımsız |
| 4 | Inline not ekleme | Bağımsız |
| 5 | Müdür karşılaştırma tablosu | Bağımsız |
| 6 | Takvim tamamlanma oranı | Bağımsız |
| 7 | WeekLoadBanner sticky | Bağımsız |
| 8 | Print görünümü | Bağımsız |
| 9 | Veli iletişim günlüğü UI | DB migration (1) bekler |

Özellik 9 (veli günlüğü UI), migration'ın Supabase'e uygulanmasını bekler. Diğerleri paralel çalıştırılabilir.

---

## Test Yaklaşımı

- **Özellik 1 (StatusBoard):** Unit test — seçim state mantığı, `selectedIds` Set operasyonları
- **Özellik 2 (Veli günlüğü):** Integration test — `addParentContactLog` action, `getParentContactLogs` repository
- **Özellikler 3-8:** UI değişikliği ağırlıklı, mevcut test coverage yeterli — sadece smoke tests

Her özellik için kendi commit'i, tüm özellikler bitince tek PR.
