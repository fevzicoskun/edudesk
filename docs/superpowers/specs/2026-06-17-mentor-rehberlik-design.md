# Sınıf Rehberliği (Mentor Raporları) — Tasarım

**Tarih:** 2026-06-17
**Durum:** Onaylandı, uygulamaya hazır

## Bağlam

Mentor/rehberlik özelliğinin **backend'i zaten tamamlanmış** ama UI bağlanmamış:

- `mentor_reports` ve `mentor_students` tabloları + RLS (baseline.sql) mevcut.
- `MentorRepository`, `MentorService`, `app/actions/mentor.ts` (Zod doğrulamalı) tam.
- **Kritik boşluk:** `classes.mentor_teacher_id` hiçbir yerde *atanmıyor* — sadece okunuyor (yoklama hatırlatıcısı, çizelge). Atama akışı eksik.

Bu spec yalnızca **sınıf rehberliği (A)** kapsamını ele alır. Kişisel öğrenci defteri (`mentor_students`, "B") bilinçli olarak kapsam dışıdır.

## Kapsam

1. Sınıfa rehber öğretmen atama akışı (eksik ön koşul).
2. Öğrenci profilinde rehberlik raporları UI'ı (ekle / listele / sil).
3. Görünürlük kuralları (RLS ile aynı).
4. Birim testleri.

## 1. Sınıfa rehber öğretmen atama

- **Servis:** `MentorService.assignClassMentor(classId, teacherId | null)`.
  - `requireAbility()` ile yetki: yalnızca `mudur`, `mudur_yardimcisi`, `admin`. Aksi → `{ error: 'Bu işlem için yetkiniz yok' }`.
  - `teacherId` verildiyse: o kullanıcının aynı okulda ve öğretmen rolünde olduğunu doğrula.
  - `classes.mentor_teacher_id` set eder (school_id eşleşmesiyle).
- **Action:** `assignClassMentor(classId, teacherId | null)` → `ActionResult`, UUID doğrulama, `revalidatePath('/siniflar/[id]')`.
- **UI:** `/siniflar/[id]` sayfasında **yalnızca yöneticiye** görünen "Rehber Öğretmen" kartı: okul öğretmenlerinden dropdown + "Kaldır". Öğretmen rolü bu kartı görmez.

## 2. Öğrenci profilinde rehberlik raporları

- **Yer:** `/siniflar/[id]/ogrenciler/[studentId]` → yeni `RehberlikRaporlariSection.tsx`.
- **Görünürlük (sunucuda hesaplanır, RLS ile birebir):** Sadece (a) öğrencinin sınıfının atanmış mentörü ve (b) yöneticiler (`mudur`, `mudur_yardimcisi`, `zumre_baskani`) görür. Diğer öğretmenler hiç görmez.
- **Yazma:** Yalnızca atanmış mentör rapor ekler (içerik 5–2000 karakter, tarih `YYYY-MM-DD`, bugüne varsayılan). `MentorService.addMentorReport` zaten kısıtlıyor.
- **Listeleme/Silme:** Raporlar `report_date` azalan sıralı; raporu yazan mentör kendi raporunu silebilir.
- Mentör atanmamış sınıfta: yöneticiye "Bu sınıfa henüz rehber öğretmen atanmadı" bilgisi; öğretmene hiç görünmez.

## 3. Hata yönetimi

- Tüm action'lar `ActionResult` (`{ error? }`) döner; UI inline gösterir (mevcut form deseni).
- Yetkisiz atama/yazma serviste sessizce `{ error }`; RLS ikinci savunma hattı.

## 4. Test

- Unit: `assignClassMentor` (yönetici değilse atayamaz; başka okul/öğretmen olmayan reddedilir) ve mentör görünürlük yardımcısı.
- Mevcut `mentor-rls.test.ts` korunur; test başındaki "UI yazılmamıştır" notu güncellenir.

## Keşfedilebilirlik

Ayrı nav öğesi eklenmez (YAGNI). Özellik bağlamında yaşar: yönetici sınıf detayında atar, mentör/yönetici öğrenci profilinde raporları görür.

## Kapsam dışı (bilinçli)

Kişisel öğrenci defteri (B), sınıf-geneli rapor görünümü, ayrı menü. İhtiyaç olursa sonra.
