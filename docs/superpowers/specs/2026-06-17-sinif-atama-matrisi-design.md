# Toplu Sınıf Atama Matrisi — Tasarım

**Tarih:** 2026-06-17
**Durum:** Onaylandı, uygulamaya hazır

## Bağlam

Müdür/müdür yardımcısı öğretmenleri sınıflara (`teacher_classes` = branş ilişkisi) atıyor.
Mevcut akış öğretmen-merkezli: `/kullanicilar` tablosunda her satırda belirsiz küçük bir
ikon → `TeacherClassModal` açıyor, tüm sınıfları checkbox listeler. Sorunlar: keşfedilebilirlik
düşük, tabloda atama durumu görünmüyor, tüm okulu kurmak için öğretmenler tek tek açılıyor,
sınıf-merkezli bakış yok.

Çözüm: tek ekranda **öğretmen × sınıf** matrisi.

## Kapsam

1. `/kullanicilar` içinde sekme: **Liste** (mevcut) / **Sınıf Atamaları** (matris).
2. Matris UI — hücre tıkla, yerel bekleyen değişiklik, toplu **Kaydet**.
3. Batch kaydetme action + servisi (diff bazlı, RBAC + okul/rol doğrulamalı).
4. Birim testi.

Kapsam dışı: rehber (`mentor_teacher_id`) ataması (sınıf detayında ayrı yaşıyor), öğrenci-sınıf.

## 1. Yerleşim & veri

- `app/(dashboard)/kullanicilar/page.tsx` halihazırda `users`, `allClasses` (`ClassRow`),
  `teacherAssignments` (`Record<teacherId, classId[]>`) yüklüyor — matris için **ekstra sorgu yok**.
- Sayfa kapsayıcısı `max-w-3xl` → `max-w-6xl` (matris genişliği için; liste tablosu de geniş çalışır).
- Sekme state'i `KullaniciFiltreli.tsx` içinde tutulur (zaten `classes` + `teacherAssignments` alıyor).
  "Sınıf Atamaları" sekmesi aktifken tablo yerine matris render edilir.
- Satırdaki `TeacherClassModal` ve tetikleyici ikon **kaldırılır** (import dahil). `TeacherClassModal.tsx` silinir.

## 2. Matris — `SinifAtamaMatrisi.tsx` (client)

- **Props:** `teachers` (yalnızca `ogretmen` + `zumre_baskani`), `classes` (grade→ad sıralı),
  `initialAssignments: Record<teacherId, classId[]>`.
- **State:** `working: Map<teacherId, Set<classId>>`, initial'dan klonlanır. Dirty = working vs initial farkı.
- **Render:** çizelgedeki desen — sticky ilk sütun (öğretmen adı), sticky başlık satırı (sınıf adı, grade etiketli),
  dış kapsayıcı `overflow-x-auto`. Hücre = checkbox; working state'i yansıtır. Değişen hücre görsel işaretlenir.
- **Toggle:** yalnızca yerel state'i değiştirir (yazma yok).
- **Footer:** "N değişiklik bekliyor" + **Kaydet** (transition) + **Vazgeç** (working'i initial'a sıfırlar).
  Dirty yoksa Kaydet pasif.
- **Boş durumlar:** öğretmen yok / sınıf yok → bilgi metni.

## 3. Batch kaydetme

- **Action** (`app/actions/users.ts`): `saveTeacherClassChanges(changes: { teacherId: string; classId: string; assigned: boolean }[]): Promise<ActionResult>`.
  - UUID doğrulama; `UserService.saveTeacherClassChanges` çağırır; başarıda `revalidatePath('/kullanicilar')`.
- **Servis** (`UserService.saveTeacherClassChanges`):
  - `requireAbility()`; `cannot(P.USERS.UPDATE)` → `{ error: 'Yetki yok' }`.
  - Okul içi geçerli **öğretmen id seti** (`role ∈ {ogretmen, zumre_baskani}`) ve **sınıf id seti** iki sorguyla çekilir.
  - Her değişiklik bu setlere göre doğrulanır; geçersiz olan reddedilir (cross-tenant/rol koruması).
  - `assigned=true` çiftleri tek `upsert` (array, `ignoreDuplicates`); `assigned=false` çiftleri `Promise.all` ile `delete`.
  - Yeni repo metotları: `addTeacherClasses(pairs)`, `removeTeacherClass` (mevcut, loop ile çağrılır) — veya gerekirse `removeTeacherClasses`.
- Yalnızca **değişen** hücreler gönderilir (client diff hesaplar).

## 4. Hata yönetimi

- Action `ActionResult` döner; matris footer'da inline gösterir.
- Kısmi başarısızlıkta: ilk hata döndürülür, client baseline güncellenmez (kullanıcı tekrar dener).

## 5. Test

- Unit (`tests/vitest/unit/users/`): `saveTeacherClassChanges`
  - öğretmen olmayan hedef / başka okul sınıfı → reddedilir, yazma yapılmaz.
  - geçerli ekleme + çıkarma karışımı → upsert + delete doğru çağrılır.
